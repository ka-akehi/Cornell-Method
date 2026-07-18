"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import {
  CANVAS_PAGE,
  cloneCanvasDocument,
  createDemoCanvasDocument,
  createElementId,
  extractCanvasSearchText,
  formatDocumentBytes,
  getElementBounds,
  restoreCanvasDocument,
  serializeCanvasDocument,
  type CanvasDocumentV1,
  type CanvasElementType,
} from "@/shared/canvas";
import {
  fabricCanvasToDocument,
  fabricDocumentToCanvas,
  createFabricObject,
  type FabricApiLike,
  type FabricCanvasLike,
  type FabricEventLike,
} from "../_lib/fabric-adapter";
import {
  createCanvasHistory,
  redoCanvasHistory,
  undoCanvasHistory,
  pushCanvasHistory,
  type CanvasHistoryState,
} from "../_lib/canvas-history";
import {
  CanvasSpikeToolbar,
  type CanvasTool,
  type CanvasZoom,
} from "./canvas-toolbar";

type FabricCanvasPanelProps = {
  initialDocument: CanvasDocumentV1;
  onDocumentChange?: (document: CanvasDocumentV1) => void;
};

type Point = { x: number; y: number };

type DragDraft = {
  tool: Extract<CanvasTool, "line" | "arrow" | "rect" | "ellipse">;
  start: Point;
  current: Point;
};

function clampPoint(point: Point) {
  return {
    x: Math.min(CANVAS_PAGE.width, Math.max(0, point.x)),
    y: Math.min(CANVAS_PAGE.height, Math.max(0, point.y)),
  };
}

function pointFromPointer(event: PointerEvent, element: HTMLCanvasElement): Point {
  const rect = element.getBoundingClientRect();
  return clampPoint({
    x: ((event.clientX - rect.left) / Math.max(1, rect.width)) * CANVAS_PAGE.width,
    y: ((event.clientY - rect.top) / Math.max(1, rect.height)) * CANVAS_PAGE.height,
  });
}

function createDraggedElement(
  type: Extract<CanvasTool, "line" | "arrow" | "rect" | "ellipse">,
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

export function FabricCanvasPanel({
  initialDocument,
  onDocumentChange,
}: FabricCanvasPanelProps) {
  const initialRef = useRef(cloneCanvasDocument(initialDocument));
  const viewportRef = useRef<HTMLDivElement>(null);
  const surfaceRef = useRef<HTMLDivElement>(null);
  const canvasElementRef = useRef<HTMLCanvasElement>(null);
  const canvasRef = useRef<FabricCanvasLike | null>(null);
  const fabricRef = useRef<FabricApiLike | null>(null);
  const previewObjectRef = useRef<
    ReturnType<typeof createFabricObject> | null
  >(null);
  const toolRef = useRef<CanvasTool>("select");
  const textRef = useRef("New canvas text");
  const dragRef = useRef<DragDraft | null>(null);
  const draftPointsRef = useRef<Array<[number, number]>>([]);
  const applyDocumentRef = useRef<(document: CanvasDocumentV1) => void>(() => undefined);
  const applyZoomRef = useRef<() => void>(() => undefined);
  const historyRef = useRef<CanvasHistoryState>(createCanvasHistory(initialRef.current));
  const commitRef = useRef<(document: CanvasDocumentV1) => void>(() => undefined);
  const [history, setHistory] = useState<CanvasHistoryState>(historyRef.current);
  const [tool, setTool] = useState<CanvasTool>("select");
  const [text, setText] = useState("New canvas text");
  const [zoom, setZoom] = useState<CanvasZoom>("fit");
  const [fitScale, setFitScale] = useState(1);
  const [ready, setReady] = useState(false);
  const [roundTrip, setRoundTrip] = useState<string | null>(null);
  const [roundTripStatus, setRoundTripStatus] = useState("Round trip: not run");

  toolRef.current = tool;
  textRef.current = text;

  const displayScale = zoom === "fit" ? fitScale : zoom;

  const notifyDocument = useCallback(
    (document: CanvasDocumentV1) => onDocumentChange?.(cloneCanvasDocument(document)),
    [onDocumentChange],
  );

  commitRef.current = (document) => {
    const next = pushCanvasHistory(historyRef.current, document);
    historyRef.current = next;
    setHistory(next);
    notifyDocument(next.present);
  };

  const applyZoom = useCallback(() => {
    const surface = surfaceRef.current;
    const canvas = canvasRef.current;
    if (!surface || !canvas) return;

    const width = CANVAS_PAGE.width * displayScale;
    const height = CANVAS_PAGE.height * displayScale;
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
  }, [displayScale]);
  applyZoomRef.current = applyZoom;

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    const updateFitScale = () => {
      setFitScale(Math.min(1, viewport.clientWidth / CANVAS_PAGE.width));
    };
    updateFitScale();
    const observer = new ResizeObserver(updateFitScale);
    observer.observe(viewport);
    return () => observer.disconnect();
  }, []);

  const removePreview = useCallback(() => {
    const canvas = canvasRef.current;
    const preview = previewObjectRef.current;
    if (canvas && preview) {
      canvas.remove(preview);
      previewObjectRef.current = null;
      canvas.requestRenderAll?.();
    }
  }, []);

  const restoreDocument = useCallback(
    (document: CanvasDocumentV1, recordHistory: boolean) => {
      applyDocumentRef.current(document);
      const next = recordHistory ? pushCanvasHistory(historyRef.current, document) : createCanvasHistory(document);
      historyRef.current = next;
      setHistory(next);
      notifyDocument(next.present);
    },
    [notifyDocument],
  );

  useEffect(() => {
    let disposed = false;
    let canvas: FabricCanvasLike | null = null;
    let cleanup: (() => void) | undefined;

    async function initialize() {
      const fabricModule = (await import("fabric")) as unknown as FabricApiLike;
      const element = canvasElementRef.current;
      if (!element || disposed) return;

      const nextCanvas = new fabricModule.Canvas(element, {
        preserveObjectStacking: true,
        selection: true,
        enablePointerEvents: true,
      });
      canvas = nextCanvas;
      fabricRef.current = fabricModule;
      canvasRef.current = nextCanvas;
      nextCanvas.upperCanvasEl.style.touchAction = "none";
      nextCanvas.backgroundColor = "#fffdf8";
      nextCanvas.setDimensions({ width: CANVAS_PAGE.width, height: CANVAS_PAGE.height });

      const apply = (document: CanvasDocumentV1) => {
        if (!canvas || !fabricRef.current) return;
        removePreview();
        fabricDocumentToCanvas(canvas, fabricRef.current, document);
        applyZoomRef.current();
      };
      applyDocumentRef.current = apply;
      apply(initialRef.current);

      const commitCurrent = () => {
        if (!canvas) return;
        const document = fabricCanvasToDocument(canvas);
        commitRef.current(document);
      };

      const onMouseDown = (event: FabricEventLike) => {
        const activeTool = toolRef.current;
        const pointer = pointFromPointer(event.e, element);
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
          const elementForText: CanvasDocumentV1["elements"][number] = {
            id: createElementId("text"),
            type: "text",
            x: pointer.x,
            y: pointer.y,
            width: 290,
            height: 58,
            rotation: 0,
            text: textRef.current || "Canvas text",
            style: {
              fill: "#25302e",
              fontSize: 26,
              fontFamily: "Arial, sans-serif",
            },
            z: canvas?.getObjects().length ?? 0,
          };
          if (canvas && fabricRef.current) {
            canvas.add(createFabricObject(fabricRef.current, elementForText));
            commitCurrent();
          }
          return;
        }

        if (activeTool === "erase" && event.target && canvas) {
          canvas.remove(event.target);
          canvas.discardActiveObject();
          commitCurrent();
        }
      };

      const onMouseMove = (event: FabricEventLike) => {
        const pointer = pointFromPointer(event.e, element);
        if (toolRef.current === "pen" && draftPointsRef.current.length) {
          const last = draftPointsRef.current.at(-1);
          if (!last || Math.hypot(pointer.x - last[0], pointer.y - last[1]) >= 2) {
            draftPointsRef.current.push([pointer.x, pointer.y]);
          }
          return;
        }

        const drag = dragRef.current;
        if (!drag || !canvas || !fabricRef.current) return;
        drag.current = pointer;
        removePreview();
        const elementForPreview = createDraggedElement(
          drag.tool,
          drag.start,
          drag.current,
          canvas.getObjects().length,
        );
        const preview = createFabricObject(fabricRef.current, elementForPreview);
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

        const drag = dragRef.current;
        if (drag && canvas && fabricRef.current) {
          dragRef.current = null;
          removePreview();
          const elementForShape = createDraggedElement(
            drag.tool,
            drag.start,
            drag.current,
            canvas.getObjects().length,
          );
          canvas.add(createFabricObject(fabricRef.current, elementForShape));
          commitCurrent();
        }
      };

      const onPathCreated = (event: FabricEventLike) => {
        const points = draftPointsRef.current;
        draftPointsRef.current = [];
        if (!event.target || points.length < 2) return;
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
              z: canvas?.getObjects().length ?? 0,
            },
            baseLeft: typeof targetLeft === "number" ? targetLeft : bounds.x,
            baseTop: typeof targetTop === "number" ? targetTop : bounds.y,
          },
        });
        commitCurrent();
      };

      const onObjectModified = () => commitCurrent();
      nextCanvas.on("mouse:down", onMouseDown);
      nextCanvas.on("mouse:move", onMouseMove);
      nextCanvas.on("mouse:up", onMouseUp);
      nextCanvas.on("path:created", onPathCreated);
      nextCanvas.on("object:modified", onObjectModified);
      setReady(true);
      applyZoomRef.current();

      cleanup = () => {
        nextCanvas.off("mouse:down", onMouseDown);
        nextCanvas.off("mouse:move", onMouseMove);
        nextCanvas.off("mouse:up", onMouseUp);
        nextCanvas.off("path:created", onPathCreated);
        nextCanvas.off("object:modified", onObjectModified);
        void nextCanvas.dispose();
      };
    }

    void initialize();
    return () => {
      disposed = true;
      cleanup?.();
      canvas = null;
      canvasRef.current = null;
      fabricRef.current = null;
    };
  }, [notifyDocument, removePreview]);

  useEffect(() => {
    applyZoom();
  }, [applyZoom]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.isDrawingMode = tool === "pen";
    canvas.selection = tool === "select";
    canvas.getObjects().forEach((object) => {
      object.set({
        selectable: tool === "select",
        evented: true,
      });
    });
    if (tool === "pen" && fabricRef.current) {
      const brush = new fabricRef.current.PencilBrush(canvas);
      brush.width = 5;
      brush.color = "#2f5544";
      canvas.freeDrawingBrush = brush;
    }
    canvas.requestRenderAll?.();
  }, [tool, ready]);

  const undo = useCallback(() => {
    const next = undoCanvasHistory(historyRef.current);
    if (next === historyRef.current) return;
    historyRef.current = next;
    setHistory(next);
    applyDocumentRef.current(next.present);
    notifyDocument(next.present);
  }, [notifyDocument]);

  const redo = useCallback(() => {
    const next = redoCanvasHistory(historyRef.current);
    if (next === historyRef.current) return;
    historyRef.current = next;
    setHistory(next);
    applyDocumentRef.current(next.present);
    notifyDocument(next.present);
  }, [notifyDocument]);

  const deleteActiveObject = useCallback(() => {
    const canvas = canvasRef.current;
    const active = canvas?.getActiveObject();
    if (!canvas || !active) return;
    canvas.remove(active);
    canvas.discardActiveObject();
    commitRef.current(fabricCanvasToDocument(canvas));
  }, []);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
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

  const saveRoundTrip = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const serialized = serializeCanvasDocument(fabricCanvasToDocument(canvas));
    const restored = restoreCanvasDocument(serialized);
    setRoundTrip(serialized);
    applyDocumentRef.current(restored);
    setRoundTripStatus(
      serializeCanvasDocument(restored) === serialized
        ? "Round trip: PASS (app JSON)"
        : "Round trip: FAIL",
    );
  }, []);

  const restoreRoundTrip = useCallback(() => {
    if (!roundTrip) return;
    const restored = restoreCanvasDocument(roundTrip);
    restoreDocument(restored, true);
    setRoundTripStatus("Round trip: restored saved JSON");
  }, [restoreDocument, roundTrip]);

  const reset = useCallback(() => {
    restoreDocument(createDemoCanvasDocument(), false);
    setRoundTrip(null);
    setRoundTripStatus("Round trip: not run");
  }, [restoreDocument]);

  const documentJson = serializeCanvasDocument(history.present);

  return (
    <section className="canvas-spike-engine-panel" aria-labelledby="fabric-panel-title">
      <div className="canvas-spike-engine-heading">
        <div>
          <p className="canvas-spike-eyebrow">Candidate A</p>
          <h2 id="fabric-panel-title">Fabric.js</h2>
          <p>Object model + built-in selection, controls, free drawing, JSON/SVG I/O.</p>
        </div>
        <span className="canvas-spike-ready" data-ready={ready}>
          {ready ? "client ready" : "loading library"}
        </span>
      </div>

      <CanvasSpikeToolbar
        tool={tool}
        setTool={setTool}
        text={text}
        setText={setText}
        zoom={zoom}
        setZoom={setZoom}
        canUndo={history.past.length > 0}
        canRedo={history.future.length > 0}
        onUndo={undo}
        onRedo={redo}
        onReset={reset}
        onSaveRoundTrip={saveRoundTrip}
        onRestoreRoundTrip={restoreRoundTrip}
        hasSavedRoundTrip={Boolean(roundTrip)}
        roundTripStatus={roundTripStatus}
      />

      <div
        ref={viewportRef}
        className="canvas-spike-viewport"
        tabIndex={0}
        onPointerDown={() => viewportRef.current?.focus()}
        onKeyDown={handleKeyDown}
        aria-label="Fabric.js 固定ページキャンバス。Canvas にフォーカスして Ctrl または Cmd のショートカットを使用できます。"
      >
        <div ref={surfaceRef} className="canvas-spike-stage">
          <canvas ref={canvasElementRef} width={CANVAS_PAGE.width} height={CANVAS_PAGE.height} />
        </div>
      </div>

      <div className="canvas-spike-engine-meta">
        <span>{history.present.elements.length} elements</span>
        <span>{formatDocumentBytes(documentJson)}</span>
        <span>searchText: {extractCanvasSearchText(history.present) || "(empty)"}</span>
      </div>
    </section>
  );
}
