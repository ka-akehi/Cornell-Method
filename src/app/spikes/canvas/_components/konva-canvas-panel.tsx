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
} from "@/shared/canvas";
import {
  createKonvaNode,
  konvaDocumentToLayer,
  konvaLayerToDocument,
  type KonvaApiLike,
  type KonvaEventLike,
  type KonvaLayerLike,
  type KonvaNodeLike,
  type KonvaStageLike,
  type KonvaTransformerLike,
} from "../_lib/konva-adapter";
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

type KonvaCanvasPanelProps = {
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

function boundsForPoints(points: Array<[number, number]>) {
  const xs = points.map(([x]) => x);
  const ys = points.map(([, y]) => y);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return {
    x,
    y,
    width: Math.max(1, Math.max(...xs) - x),
    height: Math.max(1, Math.max(...ys) - y),
  };
}

function pointFromPointer(event: PointerEvent, container: HTMLElement): Point {
  const rect = container.getBoundingClientRect();
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

export function KonvaCanvasPanel({
  initialDocument,
  onDocumentChange,
}: KonvaCanvasPanelProps) {
  const initialRef = useRef(cloneCanvasDocument(initialDocument));
  const viewportRef = useRef<HTMLDivElement>(null);
  const surfaceRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<KonvaStageLike | null>(null);
  const layerRef = useRef<KonvaLayerLike | null>(null);
  const transformerRef = useRef<KonvaTransformerLike | null>(null);
  const konvaRef = useRef<KonvaApiLike | null>(null);
  const previewNodeRef = useRef<KonvaNodeLike | null>(null);
  const selectedNodeRef = useRef<KonvaNodeLike | null>(null);
  const toolRef = useRef<CanvasTool>("select");
  const textRef = useRef("New canvas text");
  const dragRef = useRef<DragDraft | null>(null);
  const strokePointsRef = useRef<Array<[number, number]>>([]);
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
    const stage = stageRef.current;
    if (!surface || !stage) return;

    const width = CANVAS_PAGE.width * displayScale;
    const height = CANVAS_PAGE.height * displayScale;
    surface.style.width = `${width}px`;
    surface.style.height = `${height}px`;
    stage.width(CANVAS_PAGE.width);
    stage.height(CANVAS_PAGE.height);
    surface.querySelectorAll(".konvajs-content, canvas").forEach((node) => {
      const element = node as HTMLElement;
      element.style.width = `${width}px`;
      element.style.height = `${height}px`;
    });
    layerRef.current?.draw();
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
    const preview = previewNodeRef.current;
    if (!preview) return;
    preview.destroy();
    previewNodeRef.current = null;
    layerRef.current?.draw();
  }, []);

  const setSelected = useCallback((node: KonvaNodeLike | null) => {
    const transformer = transformerRef.current;
    selectedNodeRef.current = node;
    if (transformer) transformer.nodes(node ? [node] : []);
    layerRef.current?.draw();
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
    let cleanup: (() => void) | undefined;

    async function initialize() {
      const konvaModule = await import("konva");
      const konva = (konvaModule.default ?? konvaModule) as unknown as KonvaApiLike;
      const container = containerRef.current;
      if (!container || disposed) return;

      const stage = new konva.Stage({
        container,
        width: CANVAS_PAGE.width,
        height: CANVAS_PAGE.height,
      });
      const layer = new konva.Layer();
      const transformer = new konva.Transformer({
        rotateEnabled: false,
        enabledAnchors: ["top-left", "top-right", "bottom-left", "bottom-right"],
        borderStroke: "#c66b3d",
        anchorStroke: "#c66b3d",
        anchorFill: "#fffdf8",
        anchorSize: 10,
        keepRatio: false,
      });
      stage.add(layer);
      layer.add(transformer);
      stageRef.current = stage;
      layerRef.current = layer;
      transformerRef.current = transformer;
      konvaRef.current = konva;
      stage.container().style.touchAction = "none";

      const apply = (document: CanvasDocumentV1) => {
        if (!layer || !konvaRef.current) return;
        removePreview();
        setSelected(null);
        konvaDocumentToLayer(layer, konvaRef.current, document, transformer);
        applyZoomRef.current();
      };
      applyDocumentRef.current = apply;
      apply(initialRef.current);

      const commitCurrent = () => {
        if (!layer) return;
        commitRef.current(konvaLayerToDocument(layer));
      };

      const onPointerDown = (event: KonvaEventLike) => {
        const activeTool = toolRef.current;
        const target = event.target;
        const targetIsTransformer = (target.getClassName?.() ?? target.className) === "Transformer";
        const pointer = pointFromPointer(event.evt, container);

        if (activeTool === "select") {
          if (targetIsTransformer) return;
          if (target.getAttr("canvasElement")) setSelected(target);
          else setSelected(null);
          return;
        }

        if (activeTool === "erase") {
          if (!targetIsTransformer && target.getAttr("canvasElement")) {
            target.destroy();
            setSelected(null);
            commitCurrent();
          }
          return;
        }

        if (activeTool === "text") {
          if (!konvaRef.current || !layer) return;
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
            z: layer.getChildren().length,
          };
          layer.add(createKonvaNode(konvaRef.current, elementForText));
          layer.draw();
          commitCurrent();
          return;
        }

        if (activeTool === "pen") {
          strokePointsRef.current = [[pointer.x, pointer.y]];
          return;
        }

        if (["line", "arrow", "rect", "ellipse"].includes(activeTool)) {
          dragRef.current = {
            tool: activeTool as DragDraft["tool"],
            start: pointer,
            current: pointer,
          };
        }
      };

      const onPointerMove = (event: KonvaEventLike) => {
        if (toolRef.current === "pen" && strokePointsRef.current.length) {
          const pointer = pointFromPointer(event.evt, container);
          const last = strokePointsRef.current.at(-1);
          if (!last || Math.hypot(pointer.x - last[0], pointer.y - last[1]) >= 2) {
            strokePointsRef.current.push([pointer.x, pointer.y]);
          }
          if (!konvaRef.current || !layer) return;
          removePreview();
          const points = strokePointsRef.current;
          const bounds = getElementBounds({
            x: boundsForPoints(points).x,
            y: boundsForPoints(points).y,
            width: 1,
            height: 1,
            points,
          });
          const preview = createKonvaNode(konvaRef.current, {
            id: "__preview-stroke",
            type: "stroke",
            x: bounds.x,
            y: bounds.y,
            width: bounds.width,
            height: bounds.height,
            rotation: 0,
            points,
            style: { stroke: "#2f5544", strokeWidth: 5 },
            z: layer.getChildren().length,
          });
          preview.setAttr("isCanvasPreview", true);
          preview.draggable(false);
          previewNodeRef.current = preview;
          layer.add(preview);
          layer.draw();
          return;
        }

        const drag = dragRef.current;
        if (!drag || !konvaRef.current || !layer) return;
        drag.current = pointFromPointer(event.evt, container);
        removePreview();
        const elementForPreview = createDraggedElement(
          drag.tool,
          drag.start,
          drag.current,
          layer.getChildren().length,
        );
        const preview = createKonvaNode(konvaRef.current, elementForPreview);
        preview.setAttr("isCanvasPreview", true);
        preview.draggable(false);
        previewNodeRef.current = preview;
        layer.add(preview);
        layer.draw();
      };

      const onPointerUp = () => {
        if (toolRef.current === "pen" && strokePointsRef.current.length) {
          const points = strokePointsRef.current;
          strokePointsRef.current = [];
          removePreview();
          if (points.length >= 2 && konvaRef.current && layer) {
            const pointBounds = boundsForPoints(points);
            layer.add(createKonvaNode(konvaRef.current, {
              id: createElementId("stroke"),
              type: "stroke",
              x: pointBounds.x,
              y: pointBounds.y,
              width: pointBounds.width,
              height: pointBounds.height,
              rotation: 0,
              points,
              style: { stroke: "#2f5544", strokeWidth: 5 },
              z: layer.getChildren().length,
            }));
            layer.draw();
            commitCurrent();
          }
          return;
        }

        const drag = dragRef.current;
        if (!drag || !konvaRef.current || !layer) return;
        dragRef.current = null;
        removePreview();
        const elementForShape = createDraggedElement(
          drag.tool,
          drag.start,
          drag.current,
          layer.getChildren().length,
        );
        layer.add(createKonvaNode(konvaRef.current, elementForShape));
        layer.draw();
        commitCurrent();
      };

      const onClick = (event: KonvaEventLike) => {
        if (toolRef.current !== "select") return;
        const target = event.target;
        if (target.getAttr("canvasElement")) setSelected(target);
        else if ((target.getClassName?.() ?? target.className) !== "Transformer") setSelected(null);
      };

      const onTransformOrDragEnd = (event: KonvaEventLike) => {
        if (event.target.getAttr("canvasElement")) commitCurrent();
      };

      stage.on("pointerdown", onPointerDown);
      stage.on("pointermove", onPointerMove);
      stage.on("pointerup", onPointerUp);
      stage.on("click tap", onClick);
      layer.on("dragend transformend", onTransformOrDragEnd);
      setReady(true);
      applyZoomRef.current();

      cleanup = () => {
        stage.off("pointerdown", onPointerDown);
        stage.off("pointermove", onPointerMove);
        stage.off("pointerup", onPointerUp);
        stage.off("click tap", onClick);
        stage.destroy();
      };
    }

    void initialize();
    return () => {
      disposed = true;
      cleanup?.();
      stageRef.current = null;
      layerRef.current = null;
      transformerRef.current = null;
      konvaRef.current = null;
    };
  }, [notifyDocument, removePreview, setSelected]);

  useEffect(() => {
    applyZoom();
  }, [applyZoom]);

  useEffect(() => {
    const layer = layerRef.current;
    if (!layer) return;
    layer.getChildren().forEach((node) => {
      if ((node.getClassName?.() ?? node.className) !== "Transformer") {
        node.draggable(tool === "select");
      }
    });
    if (tool !== "select") setSelected(null);
    layer.draw();
  }, [setSelected, tool, ready]);

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

  const deleteSelected = useCallback(() => {
    const selected = selectedNodeRef.current;
    const layer = layerRef.current;
    if (!selected || !layer) return;
    selected.destroy();
    setSelected(null);
    commitRef.current(konvaLayerToDocument(layer));
  }, [setSelected]);

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
        deleteSelected();
      }
    },
    [deleteSelected, redo, undo],
  );

  const saveRoundTrip = useCallback(() => {
    const layer = layerRef.current;
    if (!layer) return;
    const serialized = serializeCanvasDocument(konvaLayerToDocument(layer));
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
    restoreDocument(restoreCanvasDocument(roundTrip), true);
    setRoundTripStatus("Round trip: restored saved JSON");
  }, [restoreDocument, roundTrip]);

  const reset = useCallback(() => {
    restoreDocument(createDemoCanvasDocument(), false);
    setRoundTrip(null);
    setRoundTripStatus("Round trip: not run");
  }, [restoreDocument]);

  const documentJson = serializeCanvasDocument(history.present);

  return (
    <section className="canvas-spike-engine-panel" aria-labelledby="konva-panel-title">
      <div className="canvas-spike-engine-heading">
        <div>
          <p className="canvas-spike-eyebrow">Candidate B</p>
          <h2 id="konva-panel-title">Konva</h2>
          <p>Scene graph + shape/event primitives; app state owns history and serialization.</p>
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
        aria-label="Konva 固定ページキャンバス。Canvas にフォーカスして Ctrl または Cmd のショートカットを使用できます。"
      >
        <div ref={surfaceRef} className="canvas-spike-stage">
          <div ref={containerRef} className="canvas-spike-konva-container" />
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
