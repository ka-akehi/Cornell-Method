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
  type CanvasDocumentV1,
  type CanvasPageDimensions,
  type CanvasElementType,
} from "@/shared/canvas";
import {
  createFabricObject,
  fabricCanvasToDocument,
  fabricDocumentToCanvas,
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
  NoteCanvasToolbar,
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
};

type EraseSession = {
  deletedObjects: Set<FabricObjectLike>;
};

type EditableFabricTextObject = FabricObjectLike & {
  enterEditing?: () => void;
  selectAll?: () => void;
};

const EMPTY_CANVAS_DOCUMENT = createEmptyCanvasDocument();

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

function withoutEmptyTextElements(document: CanvasDocumentV1) {
  const elements = document.elements.filter(
    (element) => element.type !== "text" || Boolean(element.text?.trim()),
  );

  return elements.length === document.elements.length ? document : { ...document, elements };
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
): CanvasDocumentV1["elements"][number] {
  const x = Math.min(start.x, current.x);
  const y = Math.min(start.y, current.y);
  const width = Math.max(2, Math.abs(current.x - start.x));
  const height = Math.max(2, Math.abs(current.y - start.y));
  const style = {
    stroke: type === "arrow" ? "#98492c" : "#2f5544",
    fill: type === "rect" || type === "ellipse" ? "#fff2df" : undefined,
    strokeWidth: 4,
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
  const dragRef = useRef<DragDraft | null>(null);
  const eraseSessionRef = useRef<EraseSession | null>(null);
  const draftPointsRef = useRef<Array<[number, number]>>([]);
  const applyDocumentRef = useRef<(document: CanvasDocumentV1) => void>(() => undefined);
  const applyCanvasDimensionsRef = useRef<(pageDimensions?: CanvasPageDimensions) => void>(
    () => undefined,
  );
  const historyRef = useRef<CanvasHistoryState>(createCanvasHistory(validInitialDocument));
  const commitRef = useRef<(document: CanvasDocumentV1) => void>(() => undefined);

  const [history, setHistory] = useState<CanvasHistoryState>(() =>
    createCanvasHistory(validInitialDocument),
  );
  const [tool, setTool] = useState<CanvasNoteTool>("select");
  const [ready, setReady] = useState(false);
  const [canvasError, setCanvasError] = useState<string | null>(initialDocumentError);

  toolRef.current = tool;

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

        const onMouseDown = (event: FabricEventLike) => {
          const activeTool = toolRef.current;
          const pointer = pointFromPointer(event.e, element, historyRef.current.present.page);
          if (activeTool === "erase") {
            dragRef.current = null;
            draftPointsRef.current = [];
            eraseSessionRef.current = { deletedObjects: new Set() };
            canvas?.discardActiveObject();
            eraseObject(event.target);
            return;
          }

          if (activeTool === "pen") {
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
            if (event.target) {
              dragRef.current = null;
              removePreview();
              return;
            }
            dragRef.current = {
              tool: activeTool as DragDraft["tool"],
              start: pointer,
              current: pointer,
            };
            return;
          }

          if (activeTool === "text") {
            if (!canvas || !fabricRef.current) return;
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
                fill: "#25302e",
                fontSize: 26,
                fontFamily: "Arial, sans-serif",
              },
              z: canvas.getObjects().length,
            };
            const textObject = createFabricObject(fabricRef.current, elementForText);
            textObject.set({ editable: true, selectable: true, evented: true });
            canvas.add(textObject);
            canvas.setActiveObject(textObject);
            const editableTextObject = textObject as EditableFabricTextObject;
            editableTextObject.enterEditing?.();
            editableTextObject.selectAll?.();
            canvas.requestRenderAll?.();
            return;
          }

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
          removePreview();
          const preview = createFabricObject(
            fabricRef.current,
            createDraggedElement(
              drag.tool,
              drag.start,
              drag.current,
              canvas.getObjects().length,
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
          canvas.add(
            createFabricObject(
              fabricRef.current,
              createDraggedElement(
                drag.tool,
                drag.start,
                drag.current,
                canvas.getObjects().length,
              ),
            ),
          );
          commitCurrent();
        };

        const onPathCreated = (event: FabricEventLike) => {
          const points = draftPointsRef.current;
          draftPointsRef.current = [];
          if (!event.target || points.length < 2 || !canvas) return;
          const bounds = getElementBounds({
            x: Math.min(...points.map(([x]) => x)),
            y: Math.min(...points.map(([, y]) => y)),
            width: 1,
            height: 1,
            points,
          });
          const targetLeft = event.target.get("left");
          const targetTop = event.target.get("top");
          event.target.set({
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
                style: { stroke: "#2f5544", strokeWidth: 5 },
                z: canvas.getObjects().length,
              },
              baseLeft: typeof targetLeft === "number" ? targetLeft : bounds.x,
              baseTop: typeof targetTop === "number" ? targetTop : bounds.y,
            },
          });
          commitCurrent();
        };

        const onObjectModified = () => {
          if (eraseSessionRef.current) return;
          commitCurrent();
        };
        const onTextChanged = () => {
          if (eraseSessionRef.current) return;
          commitCurrent();
        };
        const onTextEditingExited = (event: FabricEventLike) => {
          const currentCanvas = canvas;
          if (!currentCanvas) return;
          const target = event.target;
          const textValue = target?.get("text");
          if (target && typeof textValue === "string" && !textValue.trim()) {
            currentCanvas.remove(target);
            currentCanvas.discardActiveObject();
            currentCanvas.requestRenderAll?.();
          }
          if (!eraseSessionRef.current) commitCurrent();
        };
        nextCanvas.on("mouse:down", onMouseDown);
        nextCanvas.on("mouse:move", onMouseMove);
        nextCanvas.on("mouse:up", onMouseUp);
        nextCanvas.on("path:created", onPathCreated);
        nextCanvas.on("object:modified", onObjectModified);
        nextCanvas.on("text:changed", onTextChanged);
        nextCanvas.on("text:editing:exited", onTextEditingExited);
        setReady(true);
        reportError(null);
        applyCanvasDimensionsRef.current();

        cleanup = () => {
          eraseSessionRef.current = null;
          nextCanvas.off("mouse:down", onMouseDown);
          nextCanvas.off("mouse:move", onMouseMove);
          nextCanvas.off("mouse:up", onMouseUp);
          nextCanvas.off("path:created", onPathCreated);
          nextCanvas.off("object:modified", onObjectModified);
          nextCanvas.off("text:changed", onTextChanged);
          nextCanvas.off("text:editing:exited", onTextEditingExited);
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
    if (tool === "erase") canvas.discardActiveObject();
    canvas.getObjects().forEach((object) => {
      object.set({ selectable: tool === "select", evented: true });
    });
    if (tool === "pen" && fabricRef.current) {
      const brush = new fabricRef.current.PencilBrush(canvas);
      brush.width = 5;
      brush.color = "#2f5544";
      canvas.freeDrawingBrush = brush;
    }
    canvas.requestRenderAll?.();
  }, [ready, tool]);

  const undo = useCallback(() => {
    const next = undoCanvasHistory(historyRef.current);
    if (next === historyRef.current) return;
    historyRef.current = next;
    setHistory(next);
    applyDocumentRef.current(next.present);
    notifyDocument(next.present);
    reportError(null);
  }, [notifyDocument, reportError]);

  const redo = useCallback(() => {
    const next = redoCanvasHistory(historyRef.current);
    if (next === historyRef.current) return;
    historyRef.current = next;
    setHistory(next);
    applyDocumentRef.current(next.present);
    notifyDocument(next.present);
    reportError(null);
  }, [notifyDocument, reportError]);

  const deleteActiveObject = useCallback(() => {
    const canvas = canvasRef.current;
    const active = canvas?.getActiveObject();
    if (!canvas || !active) return;
    canvas.remove(active);
    canvas.discardActiveObject();
    commitRef.current(fabricCanvasToDocument(canvas));
  }, []);

  const applyPageDimensions = useCallback((dimensions: CanvasPageDimensions) => {
    const previousPresent = historyRef.current.present;
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
    .filter((element) => element.type === "text")
    .map((element) => element.text?.trim())
    .filter((value): value is string => Boolean(value))
    .join("、");

  return (
    <div className="note-canvas-editor" aria-label="Canvas本文の編集領域">
      <NoteCanvasToolbar
        tool={tool}
        onToolChange={setTool}
        pageDimensions={history.present.page}
        onPageDimensionsChange={applyPageDimensions}
        canUndo={history.past.length > 0}
        canRedo={history.future.length > 0}
        onUndo={undo}
        onRedo={redo}
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
