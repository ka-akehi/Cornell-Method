"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import {
  cloneCanvasDocument,
  createElementId,
  createEmptyCanvasDocument,
  getElementBounds,
  type CanvasElementTextStyle,
  type CanvasElementV1,
  type CanvasDocumentV1,
  type CanvasPageDimensions,
  type CanvasElementType,
  type CanvasTextAlign,
} from "@/shared/canvas";
import {
  applyFabricObjectStyle,
  createFabricObject,
  createFabricShapeTextEditor,
  fabricCanvasToDocument,
  fabricDocumentToCanvas,
  resolveFabricShapeTarget,
  type FabricApiLike,
  type FabricCanvasLike,
  type FabricEventLike,
  type FabricObjectLike,
} from "@/app/spikes/canvas/_lib/fabric-adapter";
import {
  createCanvasHistory,
  pushCanvasHistory,
  redoCanvasHistory,
  undoCanvasHistory,
  type CanvasHistoryState,
} from "@/app/spikes/canvas/_lib/canvas-history";
import {
  CANVAS_DEFAULT_FONT_SIZE,
  CANVAS_DEFAULT_STROKE_WIDTH,
  CANVAS_MAX_FONT_SIZE,
  CANVAS_MAX_STROKE_WIDTH,
  CANVAS_MIN_FONT_SIZE,
  CANVAS_MIN_STROKE_WIDTH,
  NoteCanvasToolbar,
  type CanvasStyleChange,
  type CanvasStyleControlValues,
  type CanvasStyleTarget,
  type CanvasNoteTool,
} from "./note-canvas-toolbar";

type NoteCanvasEditorProps = {
  initialDocument: CanvasDocumentV1 | null;
  apiError?: string;
  externalError?: string | null;
  onDocumentChange: (document: CanvasDocumentV1) => void;
  onError?: (message: string | null) => void;
};

type Point = { x: number; y: number };

type DragDraft = {
  tool: Extract<CanvasNoteTool, "line" | "arrow" | "rect" | "ellipse">;
  start: Point;
  current: Point;
  started: boolean;
};

type EraseSession = {
  deletedObjects: Set<FabricObjectLike>;
};

type EditableFabricTextObject = FabricObjectLike & {
  enterEditing?: () => void;
  exitEditing?: () => void;
  onDeselect?: (options?: {
    e?: PointerEvent;
    object?: FabricObjectLike;
  }) => boolean;
  selectAll?: () => void;
  hiddenTextarea?: HTMLTextAreaElement | null;
};

type ShapeCanvasElement = Extract<CanvasElementV1, { type: "rect" | "ellipse" }>;

type FabricInteractionState = {
  visible: boolean;
  selectable: boolean;
  evented: boolean;
};

type ShapeTextEditSession = {
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

function isShapeTextEditor(
  object: FabricObjectLike | undefined,
): object is EditableFabricTextObject {
  return object?.get("isCanvasShapeTextEditor") === true;
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

type CanvasStyleDefaults = {
  strokeWidth: number;
  strokeColor: string;
  textColor: string;
  fontSize: number;
  textAlign: CanvasTextAlign;
};

type SelectedCanvasStyle = CanvasStyleControlValues & {
  elementType: CanvasElementType;
};

const EMPTY_CANVAS_DOCUMENT = createEmptyCanvasDocument();
const DEFAULT_STROKE_COLOR = "#2f5544";
const DEFAULT_TEXT_COLOR = "#25302e";
const DEFAULT_FONT_FAMILY = "Arial, sans-serif";
const DRAW_DRAG_THRESHOLD = 4;
const INITIAL_STYLE_DEFAULTS: CanvasStyleDefaults = {
  strokeWidth: CANVAS_DEFAULT_STROKE_WIDTH,
  strokeColor: DEFAULT_STROKE_COLOR,
  textColor: DEFAULT_TEXT_COLOR,
  fontSize: CANVAS_DEFAULT_FONT_SIZE,
  textAlign: "left",
};

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

function isColorInputValue(value: string) {
  return /^#[0-9a-f]{6}$/i.test(value);
}

function isCanvasTextAlign(value: unknown): value is CanvasTextAlign {
  return value === "left" || value === "center" || value === "right";
}

function readFabricNumber(object: FabricObjectLike, key: string, fallback: number) {
  const value = object.get(key);
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function readFabricString(object: FabricObjectLike, key: string) {
  const value = object.get(key);
  return typeof value === "string" ? value : undefined;
}

function readFabricTextAlign(
  object: FabricObjectLike,
  fallback: CanvasTextAlign,
): CanvasTextAlign {
  const value = readFabricString(object, "textAlign");
  return value === "left" || value === "center" || value === "right"
    ? value
    : fallback;
}

function readFabricBoolean(object: FabricObjectLike, key: string, fallback: boolean) {
  const value = object.get(key);
  return typeof value === "boolean" ? value : fallback;
}

function readFabricInteractionState(object: FabricObjectLike): FabricInteractionState {
  return {
    visible: readFabricBoolean(object, "visible", true),
    selectable: readFabricBoolean(object, "selectable", true),
    evented: readFabricBoolean(object, "evented", true),
  };
}

function findShapeTextChild(owner: FabricObjectLike) {
  return (owner.getObjects?.() ?? []).find((object) => {
    const type = object.get("type");
    return type === "textbox" || type === "i-text" || typeof object.get("text") === "string";
  });
}

function textStylesEqual(
  left: CanvasElementTextStyle | undefined,
  right: CanvasElementTextStyle | undefined,
) {
  return (
    left?.fill === right?.fill &&
    left?.fontSize === right?.fontSize &&
    left?.fontFamily === right?.fontFamily &&
    left?.textAlign === right?.textAlign
  );
}

function getFabricElement(object: FabricObjectLike) {
  const metadata = object.get("canvasElement") as
    | { element?: CanvasDocumentV1["elements"][number] }
    | undefined;
  return metadata?.element;
}

function isEditingStandaloneText(object: FabricObjectLike | undefined) {
  return object?.get("isEditing") === true && getFabricElement(object)?.type === "text";
}

function getStyleObject(object: FabricObjectLike, type: CanvasElementType) {
  return ["arrow", "rect", "ellipse"].includes(type)
    ? object.getObjects?.()[0] ?? object
    : object;
}

function readSelectedCanvasStyle(object: FabricObjectLike): SelectedCanvasStyle | null {
  const element = getFabricElement(object);
  if (!element) return null;

  const styleObject = getStyleObject(object, element.type);
  const isText = element.type === "text";
  return {
    elementType: element.type,
    strokeWidth: readFabricNumber(
      styleObject,
      "strokeWidth",
      element.style.strokeWidth ?? 3,
    ),
    color: isText
      ? readFabricString(object, "fill") ?? element.style.fill ?? DEFAULT_TEXT_COLOR
      : readFabricString(styleObject, "stroke") ??
        element.style.stroke ??
        DEFAULT_STROKE_COLOR,
    fontSize: readFabricNumber(object, "fontSize", element.style.fontSize ?? 24),
    textAlign: isText
      ? readFabricTextAlign(object, element.style.textAlign ?? "left")
      : "left",
  };
}

function applyFabricStyleChange(
  object: FabricObjectLike,
  elementType: CanvasElementType,
  change: CanvasStyleChange,
) {
  if (elementType === "text") {
    applyFabricObjectStyle(object, elementType, {
      fill: change.color,
      fontSize: change.fontSize,
      textAlign: change.textAlign,
    });
    return;
  }

  applyFabricObjectStyle(object, elementType, {
    stroke: change.color,
    strokeWidth: change.strokeWidth,
  });
}

function withoutEmptyTextElements(document: CanvasDocumentV1) {
  const elements = document.elements.filter(
    (element) => element.type !== "text" || Boolean(element.text?.trim()),
  );

  return elements.length === document.elements.length ? document : { ...document, elements };
}

function isShapeElement(element: CanvasElementV1): element is ShapeCanvasElement {
  return element.type === "rect" || element.type === "ellipse";
}

function isShapeTextEditorTarget(
  event: FabricEventLike,
  editor?: FabricObjectLike,
) {
  const targets = [event.target, ...(event.subTargets ?? [])];
  return targets.some(
    (target) =>
      (editor !== undefined && target === editor) || isShapeTextEditor(target),
  );
}

function isCanvasElementType(value: unknown): value is CanvasElementType {
  return (
    value === "stroke" ||
    value === "line" ||
    value === "arrow" ||
    value === "rect" ||
    value === "ellipse" ||
    value === "text"
  );
}

function readCanvasElementType(object: FabricObjectLike | undefined) {
  if (!object) return undefined;

  const metadata = object.get("canvasElement");
  if (!metadata || typeof metadata !== "object") return undefined;

  const element = (metadata as { element?: unknown }).element;
  if (!element || typeof element !== "object") return undefined;

  const type = (element as { type?: unknown }).type;
  return isCanvasElementType(type) ? type : undefined;
}

function isCanvasDrawingTarget(event: FabricEventLike) {
  const targets = [event.target, ...(event.subTargets ?? [])].filter(
    (target): target is FabricObjectLike => target !== undefined,
  );

  // No target means the pointer is on empty Canvas space. Every persisted
  // Canvas element is a valid drawing surface; an object with missing or
  // unknown app metadata remains blocked so temporary/non-Canvas objects do
  // not become part of a new drawing gesture.
  return (
    targets.length === 0 ||
    targets.every((target) => readCanvasElementType(target) !== undefined)
  );
}

function shapeTextStyleForEditing(
  element: ShapeCanvasElement,
  defaults: CanvasStyleDefaults,
): CanvasElementTextStyle {
  return {
    fill: element.textStyle?.fill ?? defaults.textColor,
    fontSize: element.textStyle?.fontSize ?? defaults.fontSize,
    fontFamily: element.textStyle?.fontFamily ?? DEFAULT_FONT_FAMILY,
    textAlign: element.textStyle?.textAlign ?? "center",
  };
}

function replaceShapeText(
  document: CanvasDocumentV1,
  elementId: string,
  text: string,
  textStyle?: CanvasElementTextStyle,
) {
  const elements = document.elements.map((element) => {
    if (element.id !== elementId || !isShapeElement(element)) return element;

    const shape = { ...element };
    delete shape.text;
    delete shape.textStyle;
    if (!text.trim()) return shape;

    return {
      ...shape,
      text,
      ...(textStyle !== undefined ? { textStyle } : {}),
    };
  });

  return elements.some((element, index) => element !== document.elements[index])
    ? { ...document, elements }
    : document;
}

function enableTextEditing(canvas: FabricCanvasLike) {
  canvas.getObjects().forEach((object) => {
    const metadata = object.get("canvasElement") as
      | { element?: { type?: CanvasElementType } }
      | undefined;
    if (metadata?.element?.type === "text") {
      object.set({ editable: true });
    }
  });
}

function clampPoint(point: Point, pageDimensions: CanvasPageDimensions) {
  return {
    x: Math.min(pageDimensions.width, Math.max(0, point.x)),
    y: Math.min(pageDimensions.height, Math.max(0, point.y)),
  };
}

function pointFromPointer(
  event: PointerEvent,
  element: HTMLCanvasElement,
  pageDimensions: CanvasPageDimensions,
): Point {
  const rect = element.getBoundingClientRect();
  return clampPoint(
    {
      x: ((event.clientX - rect.left) / Math.max(1, rect.width)) * pageDimensions.width,
      y: ((event.clientY - rect.top) / Math.max(1, rect.height)) * pageDimensions.height,
    },
    pageDimensions,
  );
}

function createDraggedElement(
  type: Extract<CanvasNoteTool, "line" | "arrow" | "rect" | "ellipse">,
  start: Point,
  current: Point,
  z: number,
  styleDefaults: CanvasStyleDefaults,
): CanvasDocumentV1["elements"][number] {
  const x = Math.min(start.x, current.x);
  const y = Math.min(start.y, current.y);
  const width = Math.max(2, Math.abs(current.x - start.x));
  const height = Math.max(2, Math.abs(current.y - start.y));
  const style = {
    stroke: styleDefaults.strokeColor,
    fill: type === "rect" || type === "ellipse" ? "#fff2df" : undefined,
    strokeWidth: styleDefaults.strokeWidth,
  };

  if (type === "line" || type === "arrow") {
    return {
      id: createElementId(type),
      type,
      x,
      y,
      width,
      height,
      rotation: 0,
      points: [
        [start.x, start.y],
        [current.x, current.y],
      ],
      style,
      z,
    };
  }

  return {
    id: createElementId(type),
    type,
    x,
    y,
    width,
    height,
    rotation: 0,
    style,
    z,
  };
}

function getDrawingStyleTarget(tool: CanvasNoteTool): Exclude<CanvasStyleTarget, null> | null {
  if (tool === "text") return "text";
  if (["pen", "line", "arrow", "rect", "ellipse"].includes(tool)) return "stroke";
  return null;
}

export function NoteCanvasEditor({
  initialDocument,
  apiError,
  externalError,
  onDocumentChange,
  onError,
}: NoteCanvasEditorProps) {
  const initialRef = useRef<CanvasDocumentV1 | null | undefined>(undefined);
  if (initialRef.current === undefined) {
    if (!initialDocument) {
      initialRef.current = null;
    } else {
      try {
        initialRef.current = cloneCanvasDocument(initialDocument);
      } catch {
        initialRef.current = null;
      }
    }
  }

  const initialDocumentError = !initialDocument
    ? "Canvas documentを読み込めないため編集できません。"
    : initialRef.current === null
      ? "Canvas documentが壊れているため編集できません。保存済みデータは変更されていません。"
      : null;
  const validInitialDocument = initialRef.current ?? EMPTY_CANVAS_DOCUMENT;

  const viewportRef = useRef<HTMLDivElement>(null);
  const surfaceRef = useRef<HTMLDivElement>(null);
  const canvasElementRef = useRef<HTMLCanvasElement>(null);
  const canvasRef = useRef<FabricCanvasLike | null>(null);
  const fabricRef = useRef<FabricApiLike | null>(null);
  const previewObjectRef = useRef<ReturnType<typeof createFabricObject> | null>(null);
  const toolRef = useRef<CanvasNoteTool>("select");
  const styleDefaultsRef = useRef<CanvasStyleDefaults>(INITIAL_STYLE_DEFAULTS);
  const selectedStyleRef = useRef<SelectedCanvasStyle | null>(null);
  const dragRef = useRef<DragDraft | null>(null);
  const eraseSessionRef = useRef<EraseSession | null>(null);
  const shapeTextEditSessionRef = useRef<ShapeTextEditSession | null>(null);
  const draftPointsRef = useRef<Array<[number, number]>>([]);
  const applyDocumentRef = useRef<(document: CanvasDocumentV1) => void>(() => undefined);
  const applyCanvasDimensionsRef = useRef<(pageDimensions?: CanvasPageDimensions) => void>(
    () => undefined,
  );
  const flushShapeTextEditRef = useRef<() => void>(() => undefined);
  const cancelShapeTextEditRef = useRef<() => void>(() => undefined);
  const historyRef = useRef<CanvasHistoryState>(createCanvasHistory(validInitialDocument));
  const commitRef = useRef<(document: CanvasDocumentV1) => void>(() => undefined);

  const [history, setHistory] = useState<CanvasHistoryState>(() =>
    createCanvasHistory(validInitialDocument),
  );
  const [tool, setTool] = useState<CanvasNoteTool>("select");
  const [styleDefaults, setStyleDefaults] = useState<CanvasStyleDefaults>(
    INITIAL_STYLE_DEFAULTS,
  );
  const [selectedStyle, setSelectedStyle] = useState<SelectedCanvasStyle | null>(null);
  const [shapeTextEditingStyle, setShapeTextEditingStyle] =
    useState<CanvasStyleControlValues | null>(null);
  const [ready, setReady] = useState(false);
  const [canvasError, setCanvasError] = useState<string | null>(initialDocumentError);

  toolRef.current = tool;
  styleDefaultsRef.current = styleDefaults;
  selectedStyleRef.current = selectedStyle;

  const pageWidth = history.present.page.width;
  const pageHeight = history.present.page.height;

  const reportError = useCallback(
    (message: string | null) => {
      setCanvasError(message);
      onError?.(message);
    },
    [onError],
  );

  const notifyDocument = useCallback(
    (document: CanvasDocumentV1) => onDocumentChange(cloneCanvasDocument(document)),
    [onDocumentChange],
  );

  const applyCanvasDimensions = useCallback(
    (pageDimensions: CanvasPageDimensions = { width: pageWidth, height: pageHeight }) => {
      const surface = surfaceRef.current;
      const canvas = canvasRef.current;
      if (!surface || !canvas) return;

      const { width, height } = pageDimensions;
      canvas.setDimensions({ width, height });
      surface.style.width = `${width}px`;
      surface.style.height = `${height}px`;
      const wrapper = canvas.upperCanvasEl.parentElement;
      if (wrapper) {
        wrapper.style.width = `${width}px`;
        wrapper.style.height = `${height}px`;
        wrapper.querySelectorAll("canvas").forEach((node) => {
          node.style.width = `${width}px`;
          node.style.height = `${height}px`;
        });
      }
      canvas.requestRenderAll?.();
    },
    [pageHeight, pageWidth],
  );
  applyCanvasDimensionsRef.current = applyCanvasDimensions;

  const removePreview = useCallback(() => {
    const canvas = canvasRef.current;
    const preview = previewObjectRef.current;
    if (canvas && preview) {
      canvas.remove(preview);
      previewObjectRef.current = null;
      canvas.requestRenderAll?.();
    }
  }, []);

  commitRef.current = (document) => {
    try {
      const next = pushCanvasHistory(historyRef.current, withoutEmptyTextElements(document));
      historyRef.current = next;
      setHistory(next);
      notifyDocument(next.present);
      reportError(null);
    } catch (error) {
      reportError(errorMessage(error, "Canvas documentを保存できる状態にできません。"));
      applyDocumentRef.current(historyRef.current.present);
    }
  };

  useEffect(() => {
    let disposed = false;
    let canvas: FabricCanvasLike | null = null;
    let cleanup: (() => void) | undefined;

    async function initialize() {
      if (initialRef.current === null) return;

      try {
        const fabricModule = (await import("fabric")) as unknown as FabricApiLike;
        const element = canvasElementRef.current;
        if (!element || disposed) return;

        const nextCanvas = new fabricModule.Canvas(element, {
          preserveObjectStacking: true,
          selection: true,
          enablePointerEvents: true,
          allowTouchScrolling: true,
        });
        canvas = nextCanvas;
        fabricRef.current = fabricModule;
        canvasRef.current = nextCanvas;
        nextCanvas.backgroundColor = "#fffdf8";
        const currentDocument = historyRef.current.present;
        nextCanvas.setDimensions({
          width: currentDocument.page.width,
          height: currentDocument.page.height,
        });

        const apply = (document: CanvasDocumentV1) => {
          if (!canvas || !fabricRef.current) return;
          const validated = cloneCanvasDocument(document);
          removePreview();
          fabricDocumentToCanvas(canvas, fabricRef.current, validated);
          enableTextEditing(canvas);
          applyCanvasDimensionsRef.current(validated.page);
        };
        applyDocumentRef.current = apply;
        apply(historyRef.current.present);

        const commitCurrent = () => {
          if (!canvas) return;
          commitRef.current(fabricCanvasToDocument(canvas));
        };

        const finishShapeTextEdit = (
          cancel = false,
          extraEditor?: FabricObjectLike,
        ) => {
          const currentCanvas = canvas;
          const session = shapeTextEditSessionRef.current;
          const editors = collectShapeTextEditors(currentCanvas, session, extraEditor);
          if (
            editors.length === 0 &&
            (!session || session.finalized)
          ) {
            return;
          }
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

          // Fabric's IText.onDeselect() calls exitEditing(). Shape text uses
          // an app-owned lifecycle, so replace that callback before touching
          // the active object. This also makes recovery safe when a previous
          // event left a detached editor in Fabric's private active reference.
          editors.forEach((editor) => {
            editor.onDeselect = () => false;
          });

          // Fabric 7.4 requires exitEditing while the object still belongs to
          // this Canvas. A detached editor must never receive exitEditing,
          // because IText.exitEditing() calls this.canvas.fire().
          editors.forEach((editor) => {
            runSafely(() => {
              const isAttached =
                currentCanvas !== null && editor.get("canvas") === currentCanvas;
              if (isAttached && editor.get("isEditing") === true) {
                editor.exitEditing?.();
              } else if (!isAttached && editor.get("isEditing") === true) {
                // Do not call IText.exitEditing() after Fabric has detached
                // the object; clean its textarea/state without canvas.fire().
                clearDetachedShapeTextEditor(editor);
              }
            });
          });

          // Clear Fabric's active reference before remove(). Fabric's remove
          // hook also attempts to deselect active objects, so repeat the
          // public operation after removal as an idempotent invariant check.
          for (let pass = 0; pass < 2; pass += 1) {
            editors.forEach((editor) => {
              runSafely(() => {
                if (currentCanvas?.getActiveObject() === editor) {
                  currentCanvas.discardActiveObject();
                }
              });
            });
            editors.forEach((editor) => {
              runSafely(() => {
                if (currentCanvas?.getObjects().includes(editor)) {
                  currentCanvas.remove(editor);
                }
              });
            });
          }

          editors.forEach((editor) => {
            const runtime =
              session?.editor === editor ? session : readShapeTextEditorRuntime(editor);
            if (!runtime) return;
            runSafely(() => runtime.owner.set(runtime.ownerState));
            if (runtime.ownerText) {
              runSafely(() => runtime.ownerText?.object.set(runtime.ownerText.state));
            }
          });
          runSafely(() => currentCanvas?.requestRenderAll?.());

          const remainingEditors = collectShapeTextEditors(currentCanvas, null);
          if (remainingEditors.length > 0) {
            lifecycleError ??= new Error(
              "図形テキストのFabric参照を終了後に解放できませんでした。",
            );
          }

          if (session && remainingEditors.length === 0) {
            session.finalized = true;
            shapeTextEditSessionRef.current = null;
          } else if (session) {
            // Keep the resource available for a later idempotent retry. The
            // editor's guarded onDeselect still makes that retry safe.
            session.finishing = false;
          }
          if (nextDocument) {
            commitRef.current(nextDocument);
            applyDocumentRef.current(historyRef.current.present);
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
              errorMessage(
                lifecycleError,
                "図形テキストの編集を安全に終了できませんでした。",
              ),
            );
          }
        };

        const flushShapeTextEdit = (cancel = false) => {
          const session = shapeTextEditSessionRef.current;
          if (cancel && session) session.cancelRequested = true;
          finishShapeTextEdit(cancel);
        };

        flushShapeTextEditRef.current = () => flushShapeTextEdit(false);
        cancelShapeTextEditRef.current = () => flushShapeTextEdit(true);

        const finishShapeTextEditFromPointer = (event: FabricEventLike) => {
          const session = shapeTextEditSessionRef.current;
          if (
            toolRef.current !== "erase" &&
            isShapeTextEditorTarget(event, session?.editor)
          ) {
            return;
          }
          flushShapeTextEditRef.current();
        };

        const startShapeTextEdit = (event: FabricEventLike) => {
          const activeTool = toolRef.current;
          if (
            !canvas ||
            !fabricRef.current ||
            (activeTool !== "select" &&
              activeTool !== "rect" &&
              activeTool !== "ellipse") ||
            shapeTextEditSessionRef.current ||
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
          const editor = createFabricShapeTextEditor(fabricRef.current, {
            ...currentElement,
            textStyle,
          }) as EditableFabricTextObject;
          // Shape text owns its end-of-edit sequence. Prevent Fabric's
          // default IText.onDeselect from calling exitEditing behind that
          // sequence, especially while a detached editor is being recovered.
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
          shapeTextEditSessionRef.current = session;
          // Keep the shape itself visible. For a shape that already has text,
          // only hide the embedded display text while the editable overlay is
          // active so the text is not rendered twice.
          try {
            owner.set({ visible: true, selectable: false, evented: false });
            ownerText?.set({ visible: false, selectable: false, evented: false });
          } catch (error) {
            finishShapeTextEdit(true);
            reportError(
              errorMessage(error, "図形テキストの編集を開始できませんでした。"),
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
            finishShapeTextEdit(true);
            reportError(
              errorMessage(error, "図形テキストの編集を開始できませんでした。"),
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
              flushShapeTextEdit(true);
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
                flushShapeTextEdit();
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

        const syncSelection = (event?: FabricEventLike) => {
          const target = event?.target ?? canvas?.getActiveObject();
          setSelectedStyle(target ? readSelectedCanvasStyle(target) : null);
        };

        const eraseObject = (target?: FabricObjectLike) => {
          const session = eraseSessionRef.current;
          if (!canvas || !session || !target || session.deletedObjects.has(target)) return;
          if (
            target.get("isCanvasPreview") === true ||
            !canvas.getObjects().includes(target)
          ) {
            return;
          }

          session.deletedObjects.add(target);
          canvas.remove(target);
          canvas.requestRenderAll?.();
        };

        const onMouseDownBefore = (event: FabricEventLike) => {
          // Fabric 7.4 clears the active object after this event and before
          // `mouse:down` handlers run. Finish the overlay while it is still
          // attached so Fabric never calls onDeselect on a detached editor.
          finishShapeTextEditFromPointer(event);
        };

        const onMouseDown = (event: FabricEventLike) => {
          const activeTool = toolRef.current;
          const currentCanvas = canvas;
          if (!currentCanvas) return;
          // Keep this as a fallback for synthetic/programmatic mouse:down
          // events that do not pass through Fabric's before hook.
          finishShapeTextEditFromPointer(event);
          const pointer = pointFromPointer(event.e, element, historyRef.current.present.page);
          const isDetachedShapeTextEditor =
            event.target !== undefined &&
            !currentCanvas.getObjects().includes(event.target) &&
            isShapeTextEditorTarget(event);
          const canStartCanvasElement =
            isCanvasDrawingTarget(event) || isDetachedShapeTextEditor;
          if (activeTool === "erase") {
            dragRef.current = null;
            draftPointsRef.current = [];
            eraseSessionRef.current = { deletedObjects: new Set() };
            canvas?.discardActiveObject();
            eraseObject(event.target);
            return;
          }

          if (activeTool === "pen") {
            if (!canStartCanvasElement) {
              draftPointsRef.current = [];
              return;
            }
            draftPointsRef.current = [[pointer.x, pointer.y]];
            return;
          }

          if (activeTool === "select") {
            dragRef.current = null;
            draftPointsRef.current = [];
            removePreview();
            return;
          }

          if (["line", "arrow", "rect", "ellipse"].includes(activeTool)) {
            if (!canStartCanvasElement) {
              dragRef.current = null;
              removePreview();
              return;
            }
            dragRef.current = {
              tool: activeTool as DragDraft["tool"],
              start: pointer,
              current: pointer,
              started: false,
            };
            return;
          }

          if (activeTool === "text") {
            if (!canStartCanvasElement || !fabricRef.current) return;
            const elementForText: CanvasDocumentV1["elements"][number] = {
              id: createElementId("text"),
              type: "text",
              x: pointer.x,
              y: pointer.y,
              width: 290,
              height: 58,
              rotation: 0,
              text: "",
              style: {
                fill: styleDefaultsRef.current.textColor,
                fontSize: styleDefaultsRef.current.fontSize,
                fontFamily: DEFAULT_FONT_FAMILY,
                textAlign: styleDefaultsRef.current.textAlign,
              },
              z: currentCanvas.getObjects().length,
            };
            const textObject = createFabricObject(fabricRef.current, elementForText);
            textObject.set({ editable: true, selectable: true, evented: true });
            currentCanvas.add(textObject);
            currentCanvas.setActiveObject(textObject);
            const editableTextObject = textObject as EditableFabricTextObject;
            editableTextObject.enterEditing?.();
            editableTextObject.selectAll?.();
            currentCanvas.requestRenderAll?.();
            return;
          }

        };

        const onMouseDoubleClick = (event: FabricEventLike) => {
          if (toolRef.current === "erase") return;
          startShapeTextEdit(event);
        };

        const onMouseMove = (event: FabricEventLike) => {
          const pointer = pointFromPointer(event.e, element, historyRef.current.present.page);
          if (toolRef.current === "erase") {
            eraseObject(event.target);
            return;
          }

          if (toolRef.current === "pen" && draftPointsRef.current.length) {
            const last = draftPointsRef.current.at(-1);
            if (!last || Math.hypot(pointer.x - last[0], pointer.y - last[1]) >= 2) {
              draftPointsRef.current.push([pointer.x, pointer.y]);
            }
            return;
          }

          const drag = dragRef.current;
          if (!drag || !fabricRef.current || !canvas) return;
          drag.current = pointer;
          if (
            !drag.started &&
            Math.hypot(pointer.x - drag.start.x, pointer.y - drag.start.y) <
              DRAW_DRAG_THRESHOLD
          ) {
            return;
          }
          drag.started = true;
          removePreview();
          const preview = createFabricObject(
            fabricRef.current,
            createDraggedElement(
              drag.tool,
              drag.start,
              drag.current,
              canvas.getObjects().length,
              styleDefaultsRef.current,
            ),
          );
          preview.set({ isCanvasPreview: true, selectable: false, evented: false });
          previewObjectRef.current = preview;
          canvas.add(preview);
          canvas.requestRenderAll?.();
        };

        const onMouseUp = () => {
          if (toolRef.current === "select") {
            dragRef.current = null;
            return;
          }

          const eraseSession = eraseSessionRef.current;
          if (eraseSession) {
            eraseSessionRef.current = null;
            removePreview();
            canvas?.discardActiveObject();
            if (eraseSession.deletedObjects.size > 0) commitCurrent();
            else canvas?.requestRenderAll?.();
            return;
          }

          const drag = dragRef.current;
          if (!drag || !fabricRef.current || !canvas) return;
          dragRef.current = null;
          removePreview();
          if (!drag.started) {
            canvas.requestRenderAll?.();
            return;
          }
          canvas.add(
            createFabricObject(
              fabricRef.current,
              createDraggedElement(
                drag.tool,
                drag.start,
                drag.current,
                canvas.getObjects().length,
                styleDefaultsRef.current,
              ),
            ),
          );
          commitCurrent();
        };

        const onPathCreated = (event: FabricEventLike) => {
          const points = draftPointsRef.current;
          draftPointsRef.current = [];
          // Fabric 7 emits path:created with { path }, not { target }.
          // Use the created object itself as the authoritative Canvas object
          // before the first document conversion can snapshot it.
          const pathObject = event.path ?? event.target;
          if (!pathObject || points.length < 2 || !canvas) return;
          const bounds = getElementBounds({
            x: Math.min(...points.map(([x]) => x)),
            y: Math.min(...points.map(([, y]) => y)),
            width: 1,
            height: 1,
            points,
          });
          const targetLeft = pathObject.get("left");
          const targetTop = pathObject.get("top");
          const currentStyleDefaults = styleDefaultsRef.current;
          pathObject.set({
            stroke: currentStyleDefaults.strokeColor,
            strokeWidth: currentStyleDefaults.strokeWidth,
          });
          pathObject.set({
            canvasElement: {
              element: {
                id: createElementId("stroke"),
                type: "stroke" as CanvasElementType,
                x: bounds.x,
                y: bounds.y,
                width: bounds.width,
                height: bounds.height,
                rotation: 0,
                points,
                style: {
                  stroke: currentStyleDefaults.strokeColor,
                  strokeWidth: currentStyleDefaults.strokeWidth,
                },
                z: canvas.getObjects().length,
              },
              baseLeft: typeof targetLeft === "number" ? targetLeft : bounds.x,
              baseTop: typeof targetTop === "number" ? targetTop : bounds.y,
            },
          });
          commitCurrent();
        };

        const onObjectModified = (event: FabricEventLike) => {
          if (
            eraseSessionRef.current ||
            event.target?.get("isCanvasShapeTextEditor") === true
          ) {
            return;
          }
          commitCurrent();
        };
        const onTextChanged = (event: FabricEventLike) => {
          const session = shapeTextEditSessionRef.current;
          if (session && session.editor === event.target && canvas) {
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
          if (eraseSessionRef.current) return;
          commitCurrent();
        };
        const onTextEditingExited = (event: FabricEventLike) => {
          const currentCanvas = canvas;
          if (!currentCanvas) return;
          const target = event.target;
          const session = shapeTextEditSessionRef.current;
          if (session?.editor === target) {
            finishShapeTextEdit();
            return;
          }
          if (isShapeTextEditor(target)) {
            finishShapeTextEdit(false, target);
            return;
          }
          const textValue = target?.get("text");
          if (target && typeof textValue === "string" && !textValue.trim()) {
            if (currentCanvas.getActiveObject() === target) {
              currentCanvas.discardActiveObject();
            }
            currentCanvas.remove(target);
            currentCanvas.requestRenderAll?.();
            return;
          }
          if (!eraseSessionRef.current) commitCurrent();
        };
        nextCanvas.on("mouse:down:before", onMouseDownBefore);
        nextCanvas.on("mouse:down", onMouseDown);
        nextCanvas.on("mouse:dblclick", onMouseDoubleClick);
        nextCanvas.on("mouse:move", onMouseMove);
        nextCanvas.on("mouse:up", onMouseUp);
        nextCanvas.on("path:created", onPathCreated);
        nextCanvas.on("object:modified", onObjectModified);
        nextCanvas.on("text:changed", onTextChanged);
        nextCanvas.on("text:editing:exited", onTextEditingExited);
        nextCanvas.on("selection:created", syncSelection);
        nextCanvas.on("selection:updated", syncSelection);
        nextCanvas.on("selection:cleared", syncSelection);
        setReady(true);
        reportError(null);
        applyCanvasDimensionsRef.current();

        cleanup = () => {
          flushShapeTextEdit(true);
          flushShapeTextEditRef.current = () => undefined;
          cancelShapeTextEditRef.current = () => undefined;
          setShapeTextEditingStyle(null);
          eraseSessionRef.current = null;
          nextCanvas.off("mouse:down:before", onMouseDownBefore);
          nextCanvas.off("mouse:down", onMouseDown);
          nextCanvas.off("mouse:dblclick", onMouseDoubleClick);
          nextCanvas.off("mouse:move", onMouseMove);
          nextCanvas.off("mouse:up", onMouseUp);
          nextCanvas.off("path:created", onPathCreated);
          nextCanvas.off("object:modified", onObjectModified);
          nextCanvas.off("text:changed", onTextChanged);
          nextCanvas.off("text:editing:exited", onTextEditingExited);
          nextCanvas.off("selection:created", syncSelection);
          nextCanvas.off("selection:updated", syncSelection);
          nextCanvas.off("selection:cleared", syncSelection);
          void nextCanvas.dispose();
        };
      } catch (error) {
        if (!disposed) {
          reportError(
            errorMessage(
              error,
              "Canvasの初期化に失敗しました。保存済みデータは変更されていません。",
            ),
          );
        }
      }
    }

    void initialize();
    return () => {
      disposed = true;
      cleanup?.();
      canvas = null;
      canvasRef.current = null;
      fabricRef.current = null;
    };
  }, [notifyDocument, removePreview, reportError, validInitialDocument]);

  useEffect(() => {
    applyCanvasDimensions();
  }, [applyCanvasDimensions]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.isDrawingMode = tool === "pen";
    canvas.selection = tool === "select";
    if (tool !== "select") {
      canvas.discardActiveObject();
      setSelectedStyle(null);
    } else {
      setSelectedStyle(
        canvas.getActiveObject()
          ? readSelectedCanvasStyle(canvas.getActiveObject() as FabricObjectLike)
          : null,
      );
    }
    canvas.getObjects().forEach((object) => {
      object.set({ selectable: tool === "select", evented: true });
    });
    if (tool === "pen" && fabricRef.current) {
      const brush = new fabricRef.current.PencilBrush(canvas);
      brush.width = styleDefaults.strokeWidth;
      brush.color = styleDefaults.strokeColor;
      canvas.freeDrawingBrush = brush;
    }
    canvas.requestRenderAll?.();
  }, [ready, styleDefaults.strokeColor, styleDefaults.strokeWidth, tool]);

  const undo = useCallback(() => {
    flushShapeTextEditRef.current();
    const next = undoCanvasHistory(historyRef.current);
    if (next === historyRef.current) return;
    historyRef.current = next;
    setHistory(next);
    setSelectedStyle(null);
    applyDocumentRef.current(next.present);
    notifyDocument(next.present);
    reportError(null);
  }, [notifyDocument, reportError]);

  const redo = useCallback(() => {
    flushShapeTextEditRef.current();
    const next = redoCanvasHistory(historyRef.current);
    if (next === historyRef.current) return;
    historyRef.current = next;
    setHistory(next);
    setSelectedStyle(null);
    applyDocumentRef.current(next.present);
    notifyDocument(next.present);
    reportError(null);
  }, [notifyDocument, reportError]);

  const handleStyleChange = useCallback((change: CanvasStyleChange) => {
    const strokeWidth = change.strokeWidth;
    const fontSize = change.fontSize;
    const color = change.color;
    const textAlign = change.textAlign;
    const shouldCommit = change.commit !== false;
    if (
      (strokeWidth !== undefined &&
        (!Number.isInteger(strokeWidth) ||
          strokeWidth < CANVAS_MIN_STROKE_WIDTH ||
          strokeWidth > CANVAS_MAX_STROKE_WIDTH)) ||
      (fontSize !== undefined &&
        (!Number.isInteger(fontSize) ||
          fontSize < CANVAS_MIN_FONT_SIZE ||
          fontSize > CANVAS_MAX_FONT_SIZE)) ||
      (color !== undefined && !isColorInputValue(color)) ||
      (textAlign !== undefined && !isCanvasTextAlign(textAlign))
    ) {
      return;
    }

    const canvas = canvasRef.current;
    const shapeTextSession = shapeTextEditSessionRef.current;
    if (shapeTextSession && canvas) {
      const applicableChange: CanvasStyleChange = { color, fontSize, textAlign };
      if (
        applicableChange.color === undefined &&
        applicableChange.fontSize === undefined &&
        applicableChange.textAlign === undefined
      ) {
        return;
      }

      applyFabricStyleChange(shapeTextSession.editor, "text", applicableChange);
      canvas.requestRenderAll?.();
      if (color !== undefined) shapeTextSession.textStyle.fill = color;
      if (fontSize !== undefined) shapeTextSession.textStyle.fontSize = fontSize;
      if (textAlign !== undefined) shapeTextSession.textStyle.textAlign = textAlign;
      shapeTextSession.styleChanged = true;
      setShapeTextEditingStyle((current) => ({
        strokeWidth: current?.strokeWidth ?? styleDefaultsRef.current.strokeWidth,
        color: shapeTextSession.textStyle.fill ?? DEFAULT_TEXT_COLOR,
        fontSize:
          shapeTextSession.textStyle.fontSize ?? styleDefaultsRef.current.fontSize,
        textAlign: shapeTextSession.textStyle.textAlign ?? "center",
      }));
      shapeTextSession.document = replaceShapeText(
        shapeTextSession.document,
        shapeTextSession.ownerId,
        readFabricString(shapeTextSession.editor, "text") ?? "",
        shapeTextSession.textStyle,
      );
      notifyDocument(shapeTextSession.document);
      reportError(null);
      return;
    }

    const activeObject = canvas?.getActiveObject();
    if (canvas && activeObject && isEditingStandaloneText(activeObject)) {
      const currentStyle = readSelectedCanvasStyle(activeObject);
      if (!currentStyle || currentStyle.elementType !== "text") return;

      const applicableChange: CanvasStyleChange = { color, fontSize, textAlign };
      if (
        applicableChange.color === undefined &&
        applicableChange.fontSize === undefined &&
        applicableChange.textAlign === undefined
      ) {
        return;
      }

      applyFabricStyleChange(activeObject, "text", applicableChange);
      activeObject.setCoords?.();
      canvas.requestRenderAll?.();
      const nextSelectedStyle = readSelectedCanvasStyle(activeObject);
      const nextDocument = fabricCanvasToDocument(canvas);
      if (toolRef.current === "select") {
        setSelectedStyle(nextSelectedStyle);
      } else {
        setStyleDefaults((current) => ({
          ...current,
          textColor: nextSelectedStyle?.color ?? current.textColor,
          fontSize: nextSelectedStyle?.fontSize ?? current.fontSize,
          textAlign: nextSelectedStyle?.textAlign ?? current.textAlign,
        }));
      }

      const hasText = Boolean(readFabricString(activeObject, "text")?.trim());
      if (shouldCommit && hasText) commitRef.current(nextDocument);
      else notifyDocument(nextDocument);
      reportError(null);
      return;
    }

    const selected = toolRef.current === "select" ? selectedStyleRef.current : null;
    if (selected && canvas) {
      const activeObject = canvas.getActiveObject();
      const currentStyle = activeObject
        ? readSelectedCanvasStyle(activeObject)
        : null;
      if (!activeObject || !currentStyle || currentStyle.elementType !== selected.elementType) {
        setSelectedStyle(null);
        return;
      }

      const applicableChange: CanvasStyleChange =
        currentStyle.elementType === "text"
          ? { color, fontSize, textAlign }
          : { color, strokeWidth };
      if (
        applicableChange.color === undefined &&
        applicableChange.fontSize === undefined &&
        applicableChange.strokeWidth === undefined &&
        applicableChange.textAlign === undefined
      ) {
        return;
      }

      applyFabricStyleChange(activeObject, currentStyle.elementType, applicableChange);
      activeObject.setCoords?.();
      canvas.requestRenderAll?.();
      const nextSelectedStyle = readSelectedCanvasStyle(activeObject);
      const nextDocument = fabricCanvasToDocument(canvas);
      if (!shouldCommit) {
        setSelectedStyle(nextSelectedStyle);
        notifyDocument(nextDocument);
        reportError(null);
        return;
      }

      commitRef.current(nextDocument);
      setSelectedStyle(nextSelectedStyle);
      return;
    }

    const target = getDrawingStyleTarget(toolRef.current);
    if (!target) return;
    setStyleDefaults((current) => {
      const next = { ...current };
      if (strokeWidth !== undefined && target === "stroke") next.strokeWidth = strokeWidth;
      if (fontSize !== undefined && target === "text") next.fontSize = fontSize;
      if (textAlign !== undefined && target === "text") next.textAlign = textAlign;
      if (color !== undefined) {
        if (target === "text") next.textColor = color;
        else next.strokeColor = color;
      }
      return next;
    });
  }, [notifyDocument, reportError]);

  const deleteActiveObject = useCallback(() => {
    flushShapeTextEditRef.current();
    const canvas = canvasRef.current;
    const active = canvas?.getActiveObject();
    if (!canvas || !active) return;
    canvas.remove(active);
    canvas.discardActiveObject();
    commitRef.current(fabricCanvasToDocument(canvas));
  }, []);

  const applyPageDimensions = useCallback((dimensions: CanvasPageDimensions) => {
    flushShapeTextEditRef.current();
    const previousPresent = historyRef.current.present;
    setSelectedStyle(null);
    commitRef.current({
      ...previousPresent,
      page: { ...previousPresent.page, ...dimensions },
    });

    if (historyRef.current.present !== previousPresent) {
      applyDocumentRef.current(historyRef.current.present);
    }
  }, []);

  const focusViewportWithoutScroll = useCallback(() => {
    viewportRef.current?.focus({ preventScroll: true });
  }, []);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      const activeObject = canvasRef.current?.getActiveObject();
      if (activeObject?.get("isEditing") === true) return;

      const modifier = event.metaKey || event.ctrlKey;
      if (modifier && event.key.toLowerCase() === "z") {
        event.preventDefault();
        if (event.shiftKey) redo();
        else undo();
        return;
      }
      if (!modifier && (event.key === "Delete" || event.key === "Backspace")) {
        event.preventDefault();
        deleteActiveObject();
      }
    },
    [deleteActiveObject, redo, undo],
  );

  const documentText = history.present.elements
    .filter((element) => isShapeElement(element) || element.type === "text")
    .map((element) => element.text?.trim())
    .filter((value): value is string => Boolean(value))
    .join("、");

  const selectedForControls = tool === "select" ? selectedStyle : null;
  const styleTarget: CanvasStyleTarget = shapeTextEditingStyle
    ? "text"
    : selectedForControls
    ? selectedForControls.elementType === "text"
      ? "text"
      : "stroke"
    : getDrawingStyleTarget(tool);
  const styleValues: CanvasStyleControlValues = shapeTextEditingStyle
    ? shapeTextEditingStyle
    : selectedForControls
    ? {
        strokeWidth: selectedForControls.strokeWidth,
        color: selectedForControls.color,
        fontSize: selectedForControls.fontSize,
        textAlign: selectedForControls.textAlign,
      }
    : {
        strokeWidth: styleDefaults.strokeWidth,
        color:
          styleTarget === "text" ? styleDefaults.textColor : styleDefaults.strokeColor,
        fontSize: styleDefaults.fontSize,
        textAlign: styleDefaults.textAlign,
      };
  const handleToolChange = useCallback((nextTool: CanvasNoteTool) => {
    flushShapeTextEditRef.current();
    setTool(nextTool);
    if (nextTool !== "select") {
      setSelectedStyle(null);
      canvasRef.current?.discardActiveObject();
      canvasRef.current?.requestRenderAll?.();
    }
  }, []);

  return (
    <div className="note-canvas-editor" aria-label="Canvas本文の編集領域">
      <NoteCanvasToolbar
        tool={tool}
        onToolChange={handleToolChange}
        pageDimensions={history.present.page}
        onPageDimensionsChange={applyPageDimensions}
        canUndo={history.past.length > 0}
        canRedo={history.future.length > 0}
        onUndo={undo}
        onRedo={redo}
        styleTarget={styleTarget}
        styleValues={styleValues}
        onStyleChange={handleStyleChange}
      />

      {(canvasError || externalError || apiError) && (
        <p className="note-canvas-error" role="alert">
          {canvasError ?? externalError ?? apiError}
        </p>
      )}

      {initialRef.current !== null && (
        <div
          ref={viewportRef}
          className="note-canvas-viewport"
          data-tool={tool}
          tabIndex={0}
          onPointerDown={focusViewportWithoutScroll}
          onKeyDown={handleKeyDown}
          role="application"
          aria-label="Canvas本文。CanvasにフォーカスしてCtrlまたはCmdのUndo、Redo、削除を使用できます。"
        >
          <div className="note-canvas-horizontal-scroll">
            <div
              ref={surfaceRef}
              className="note-canvas-stage"
              style={{ width: `${pageWidth}px`, height: `${pageHeight}px` }}
            >
              <canvas
                ref={canvasElementRef}
                width={pageWidth}
                height={pageHeight}
                style={{ width: `${pageWidth}px`, height: `${pageHeight}px` }}
                aria-label={`${pageWidth} x ${pageHeight} のCanvas本文`}
              />
            </div>
          </div>
        </div>
      )}

      <p className="note-canvas-assistive-text">
        {ready ? "Canvasを編集できます。" : "Canvasを準備しています。"}
        {` 用紙サイズ: ${pageWidth} x ${pageHeight} px.`}
        {documentText ? ` テキスト要素: ${documentText}` : " テキスト要素はありません。"}
      </p>
    </div>
  );
}
