import {
  type CanvasDocumentV1,
  type CanvasElementTextStyle,
} from "@/shared/canvas";
import {
  createFabricShapeTextEditor,
  fabricCanvasToDocument,
  resolveFabricShapeTarget,
  type FabricApiLike,
  type FabricCanvasLike,
  type FabricEventLike,
  type FabricObjectLike,
} from "@/shared/canvas/adapters/fabric";
import {
  DEFAULT_TEXT_COLOR,
  applyFabricStyleChange,
  readFabricString,
  readFabricInteractionState,
  shapeTextStyleForEditing,
  textStylesEqual,
} from "@/modules/notes/lib/canvas-editor-style";
import {
  isCanvasShapeTextEditor,
  isCanvasShapeTextEditorTarget,
  isShapeElement,
  replaceShapeText,
} from "@/modules/notes/lib/canvas-editor-document";
import type {
  CanvasNoteTool,
  CanvasStyleChange,
  CanvasStyleControlValues,
  CanvasStyleDefaults,
  FabricInteractionState,
  SelectedCanvasStyle,
  ShapeCanvasElement,
} from "@/modules/notes/lib/canvas-editor-contract";

export type RuntimeRef<T> = { current: T };

export type EditableFabricTextObject = FabricObjectLike & {
  enterEditing?: () => void;
  exitEditing?: () => void;
  onDeselect?: (options?: {
    e?: PointerEvent;
    object?: FabricObjectLike;
  }) => boolean;
  selectAll?: () => void;
  hiddenTextarea?: HTMLTextAreaElement | null;
};

export type ShapeTextEditSession = {
  owner: FabricObjectLike;
  ownerState: FabricInteractionState;
  ownerText?: {
    object: FabricObjectLike;
    state: FabricInteractionState;
  };
  ownerId: string;
  originalElement: ShapeCanvasElement;
  document: CanvasDocumentV1;
  editor: EditableFabricTextObject;
  textStyle: CanvasElementTextStyle;
  styleChanged: boolean;
  cancelRequested: boolean;
  finishing: boolean;
  finalized: boolean;
  removeEscapeListener?: () => void;
};

type ShapeTextEditorRuntime = Pick<
  ShapeTextEditSession,
  "owner" | "ownerState" | "ownerText"
>;

export type ShapeTextEditorSessionDependencies = {
  canvas: FabricCanvasLike;
  fabric: FabricApiLike;
  sessionRef: RuntimeRef<ShapeTextEditSession | null>;
  toolRef: RuntimeRef<CanvasNoteTool>;
  styleDefaultsRef: RuntimeRef<CanvasStyleDefaults>;
  notifyDocument: (document: CanvasDocumentV1) => void;
  commitDocument: (document: CanvasDocumentV1) => void;
  applyDocument: () => void;
  setSelectedStyle: (style: SelectedCanvasStyle | null) => void;
  setShapeTextEditingStyle: (style: CanvasStyleControlValues | null) => void;
  reportError: (message: string | null) => void;
  shouldSkipCommit: () => boolean;
};

export type ShapeTextEditorSessionController = {
  start: (event: FabricEventLike) => void;
  flush: (cancel?: boolean) => void;
  cancel: () => void;
  finishFromPointer: (event: FabricEventLike) => void;
  handleTextChanged: (event: FabricEventLike) => void;
  handleTextEditingExited: (event: FabricEventLike) => void;
  applyStyleChange: (change: CanvasStyleChange) => boolean;
  dispose: () => void;
};

function isShapeTextEditor(
  object: FabricObjectLike | undefined,
): object is EditableFabricTextObject {
  return isCanvasShapeTextEditor(object);
}

function readShapeTextEditorRuntime(editor: EditableFabricTextObject) {
  return editor.get("canvasShapeTextRuntime") as ShapeTextEditorRuntime | undefined;
}

function clearDetachedShapeTextEditor(editor: EditableFabricTextObject) {
  const hiddenTextarea = editor.hiddenTextarea;
  hiddenTextarea?.blur();
  hiddenTextarea?.parentNode?.removeChild(hiddenTextarea);
  editor.hiddenTextarea = null;
  editor.set({ isEditing: false, selected: false });
}

function collectShapeTextEditors(
  canvas: FabricCanvasLike | null,
  session: ShapeTextEditSession | null,
  extra?: FabricObjectLike,
) {
  const candidates = [
    session?.editor,
    extra,
    canvas?.getActiveObject(),
    ...(canvas?.getObjects() ?? []),
  ];
  const editors: EditableFabricTextObject[] = [];
  const seen = new Set<FabricObjectLike>();

  candidates.forEach((candidate) => {
    if (
      !candidate ||
      seen.has(candidate) ||
      (candidate !== session?.editor && !isShapeTextEditor(candidate))
    ) {
      return;
    }
    seen.add(candidate);
    editors.push(candidate);
  });

  return editors;
}

function findShapeTextChild(owner: FabricObjectLike) {
  return (owner.getObjects?.() ?? []).find((object) => {
    const type = object.get("type");
    return type === "textbox" || type === "i-text" || typeof object.get("text") === "string";
  });
}

export function createShapeTextEditorSessionController(
  dependencies: ShapeTextEditorSessionDependencies,
): ShapeTextEditorSessionController {
  const {
    canvas,
    fabric,
    sessionRef,
    toolRef,
    styleDefaultsRef,
    notifyDocument,
    commitDocument,
    applyDocument,
    setSelectedStyle,
    setShapeTextEditingStyle,
    reportError,
    shouldSkipCommit,
  } = dependencies;

  const finish = (cancel = false, extraEditor?: FabricObjectLike) => {
    const session = sessionRef.current;
    const editors = collectShapeTextEditors(canvas, session, extraEditor);
    if (editors.length === 0 && (!session || session.finalized)) return;
    if (session?.finishing) return;

    if (session) {
      session.finishing = true;
      if (cancel) session.cancelRequested = true;
    }

    const shouldCancel = cancel || session?.cancelRequested === true;
    let lifecycleError: unknown;
    let nextDocument: CanvasDocumentV1 | null = null;

    const runSafely = (operation: () => void) => {
      try {
        operation();
      } catch (error) {
        lifecycleError ??= error;
      }
    };

    runSafely(() => {
      session?.removeEscapeListener?.();
      if (session) session.removeEscapeListener = undefined;
    });

    if (session && !shouldCancel) {
      runSafely(() => {
        const editor = session.editor;
        const textValue = readFabricString(editor, "text") ?? "";
        const textChanged = textValue !== (session.originalElement.text ?? "");
        const styleChanged =
          session.styleChanged &&
          Boolean(textValue.trim()) &&
          !textStylesEqual(session.textStyle, session.originalElement.textStyle);
        if (!textChanged && !styleChanged) return;

        const textStyle =
          session.styleChanged || textChanged
            ? session.textStyle
            : session.originalElement.textStyle;
        nextDocument = replaceShapeText(
          session.document,
          session.ownerId,
          textValue,
          textStyle,
        );
      });
    }

    // Fabric's default IText.onDeselect calls exitEditing. Shape text owns
    // the end-of-edit sequence, including detached-editor recovery.
    editors.forEach((editor) => {
      editor.onDeselect = () => false;
    });

    // exitEditing must run while an editor is attached to this Canvas. A
    // detached Fabric IText cannot fire its exit event safely.
    editors.forEach((editor) => {
      runSafely(() => {
        const isAttached = editor.get("canvas") === canvas;
        if (isAttached && editor.get("isEditing") === true) {
          editor.exitEditing?.();
        } else if (!isAttached && editor.get("isEditing") === true) {
          clearDetachedShapeTextEditor(editor);
        }
      });
    });

    // Clear Fabric's active reference before remove(). Repeat the pass so a
    // Fabric deselection hook cannot leave a second reference behind.
    for (let pass = 0; pass < 2; pass += 1) {
      editors.forEach((editor) => {
        runSafely(() => {
          if (canvas.getActiveObject() === editor) canvas.discardActiveObject();
        });
      });
      editors.forEach((editor) => {
        runSafely(() => {
          if (canvas.getObjects().includes(editor)) canvas.remove(editor);
        });
      });
    }

    editors.forEach((editor) => {
      const runtime = session?.editor === editor ? session : readShapeTextEditorRuntime(editor);
      if (!runtime) return;
      runSafely(() => runtime.owner.set(runtime.ownerState));
      if (runtime.ownerText) {
        runSafely(() => runtime.ownerText?.object.set(runtime.ownerText.state));
      }
    });
    runSafely(() => canvas.requestRenderAll?.());

    const remainingEditors = collectShapeTextEditors(canvas, null);
    if (remainingEditors.length > 0) {
      lifecycleError ??= new Error(
        "図形テキストのFabric参照を終了後に解放できませんでした。",
      );
    }

    if (session && remainingEditors.length === 0) {
      session.finalized = true;
      sessionRef.current = null;
    } else if (session) {
      session.finishing = false;
    }

    if (nextDocument) {
      commitDocument(nextDocument);
      applyDocument();
    } else if (session) {
      const documentAfterCleanup = shouldCancel
        ? replaceShapeText(
            session.document,
            session.ownerId,
            session.originalElement.text ?? "",
            session.originalElement.textStyle,
          )
        : session.document;
      notifyDocument(documentAfterCleanup);
    }
    if (session || editors.length > 0) setShapeTextEditingStyle(null);
    if (lifecycleError) {
      reportError(
        lifecycleError instanceof Error && lifecycleError.message
          ? lifecycleError.message
          : "図形テキストの編集を安全に終了できませんでした。",
      );
    }
  };

  const flush = (cancel = false) => {
    const session = sessionRef.current;
    if (cancel && session) session.cancelRequested = true;
    finish(cancel);
  };

  const finishFromPointer = (event: FabricEventLike) => {
    const session = sessionRef.current;
    if (
      toolRef.current !== "erase" &&
      isCanvasShapeTextEditorTarget(event, session?.editor)
    ) {
      return;
    }
    flush();
  };

  const start = (event: FabricEventLike) => {
    const activeTool = toolRef.current;
    if (
      (activeTool !== "select" && activeTool !== "rect" && activeTool !== "ellipse") ||
      sessionRef.current ||
      collectShapeTextEditors(canvas, null).length > 0
    ) {
      return;
    }

    const resolvedTarget = resolveFabricShapeTarget(event);
    if (!resolvedTarget) return;
    const { object: owner, element: targetElement } = resolvedTarget;
    const currentDocument = fabricCanvasToDocument(canvas);
    const currentElement = currentDocument.elements.find(
      (element) => element.id === targetElement.id,
    );
    if (!currentElement || !isShapeElement(currentElement)) return;

    const textStyle = shapeTextStyleForEditing(
      currentElement,
      styleDefaultsRef.current,
    );
    const editor = createFabricShapeTextEditor(fabric, {
      ...currentElement,
      textStyle,
    }) as EditableFabricTextObject;
    editor.onDeselect = () => false;
    const ownerText = findShapeTextChild(owner);
    const session: ShapeTextEditSession = {
      owner,
      ownerState: readFabricInteractionState(owner),
      ...(ownerText
        ? {
            ownerText: {
              object: ownerText,
              state: readFabricInteractionState(ownerText),
            },
          }
        : {}),
      ownerId: currentElement.id,
      originalElement: currentElement,
      document: currentDocument,
      editor,
      textStyle,
      styleChanged: false,
      cancelRequested: false,
      finishing: false,
      finalized: false,
    };

    editor.set({
      canvasShapeTextRuntime: {
        owner: session.owner,
        ownerState: session.ownerState,
        ...(session.ownerText ? { ownerText: session.ownerText } : {}),
      } satisfies ShapeTextEditorRuntime,
    });
    sessionRef.current = session;

    try {
      owner.set({ visible: true, selectable: false, evented: false });
      ownerText?.set({ visible: false, selectable: false, evented: false });
    } catch (error) {
      finish(true);
      reportError(
        error instanceof Error && error.message
          ? error.message
          : "図形テキストの編集を開始できませんでした。",
      );
      return;
    }

    setSelectedStyle(null);
    setShapeTextEditingStyle({
      strokeWidth: styleDefaultsRef.current.strokeWidth,
      color: textStyle.fill ?? DEFAULT_TEXT_COLOR,
      fontSize: textStyle.fontSize ?? styleDefaultsRef.current.fontSize,
      textAlign: textStyle.textAlign ?? "center",
    });
    try {
      canvas.add(editor);
      canvas.setActiveObject(editor);
      editor.enterEditing?.();
      editor.selectAll?.();
    } catch (error) {
      finish(true);
      reportError(
        error instanceof Error && error.message
          ? error.message
          : "図形テキストの編集を開始できませんでした。",
      );
      return;
    }

    const hiddenTextarea = editor.hiddenTextarea;
    if (hiddenTextarea) {
      const onKeyDown = (event: globalThis.KeyboardEvent) => {
        if (event.key !== "Escape") return;
        session.cancelRequested = true;
        event.preventDefault();
        event.stopPropagation();
        flush(true);
      };
      const onBlur = (event: globalThis.FocusEvent) => {
        const relatedTarget = event.relatedTarget ?? document.activeElement;
        if (
          relatedTarget instanceof Element &&
          relatedTarget.closest(".note-canvas-toolbar")
        ) {
          return;
        }
        if (editor.get("isEditing") === true && !session.cancelRequested) {
          flush();
        }
      };
      hiddenTextarea.addEventListener("keydown", onKeyDown, true);
      hiddenTextarea.addEventListener("blur", onBlur);
      session.removeEscapeListener = () =>
        hiddenTextarea.removeEventListener("keydown", onKeyDown, true);
      const removeBlurListener = session.removeEscapeListener;
      session.removeEscapeListener = () => {
        removeBlurListener?.();
        hiddenTextarea.removeEventListener("blur", onBlur);
      };
    }
    canvas.requestRenderAll?.();
  };

  const applyStyleChange = (change: CanvasStyleChange) => {
    const session = sessionRef.current;
    if (!session) return false;
    const { color, fontSize, textAlign } = change;
    if (
      color === undefined &&
      fontSize === undefined &&
      textAlign === undefined
    ) {
      return true;
    }

    applyFabricStyleChange(session.editor, "text", { color, fontSize, textAlign });
    canvas.requestRenderAll?.();
    if (color !== undefined) session.textStyle.fill = color;
    if (fontSize !== undefined) session.textStyle.fontSize = fontSize;
    if (textAlign !== undefined) session.textStyle.textAlign = textAlign;
    session.styleChanged = true;
    setShapeTextEditingStyle({
      strokeWidth: styleDefaultsRef.current.strokeWidth,
      color: session.textStyle.fill ?? DEFAULT_TEXT_COLOR,
      fontSize: session.textStyle.fontSize ?? styleDefaultsRef.current.fontSize,
      textAlign: session.textStyle.textAlign ?? "center",
    });
    session.document = replaceShapeText(
      session.document,
      session.ownerId,
      readFabricString(session.editor, "text") ?? "",
      session.textStyle,
    );
    notifyDocument(session.document);
    reportError(null);
    return true;
  };

  return {
    start,
    flush,
    cancel: () => flush(true),
    finishFromPointer,
    handleTextChanged: (event) => {
      const session = sessionRef.current;
      if (session && session.editor === event.target) {
        const textValue = readFabricString(session.editor, "text") ?? "";
        session.document = replaceShapeText(
          session.document,
          session.ownerId,
          textValue,
          session.textStyle,
        );
        notifyDocument(session.document);
        return;
      }
      if (!shouldSkipCommit()) commitDocument(fabricCanvasToDocument(canvas));
    },
    handleTextEditingExited: (event) => {
      const target = event.target;
      const session = sessionRef.current;
      if (session?.editor === target) {
        finish();
        return;
      }
      if (isShapeTextEditor(target)) {
        finish(false, target);
        return;
      }
      const textValue = target?.get("text");
      if (target && typeof textValue === "string" && !textValue.trim()) {
        if (canvas.getActiveObject() === target) canvas.discardActiveObject();
        canvas.remove(target);
        canvas.requestRenderAll?.();
        return;
      }
      if (!shouldSkipCommit()) commitDocument(fabricCanvasToDocument(canvas));
    },
    applyStyleChange,
    dispose: () => finish(true),
  };
}
