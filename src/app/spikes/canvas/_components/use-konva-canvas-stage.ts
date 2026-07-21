"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CANVAS_PAGE } from "@/shared/canvas";
import {
  konvaDocumentToLayer,
  konvaLayerToDocument,
  type KonvaApiLike,
  type KonvaLayerLike,
  type KonvaNodeLike,
  type KonvaStageLike,
  type KonvaTransformerLike,
} from "../_lib/konva-adapter";
import { createKonvaInteractionHandlers } from "./konva-canvas-interactions";
import type { DragDraft } from "./konva-canvas-geometry";
import type { KonvaCanvasDocumentController } from "./use-konva-canvas-document";
import type { CanvasTool } from "./canvas-toolbar";

export type KonvaCanvasStageOptions = {
  initialDocumentRef: KonvaCanvasDocumentController["initialDocumentRef"];
  applyDocumentRef: KonvaCanvasDocumentController["applyDocumentRef"];
  commitRef: KonvaCanvasDocumentController["commitRef"];
  tool: CanvasTool;
  text: string;
  displayScale: number;
};

export function useKonvaCanvasStage({
  initialDocumentRef,
  applyDocumentRef,
  commitRef,
  tool,
  text,
  displayScale,
}: KonvaCanvasStageOptions) {
  const surfaceRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<KonvaStageLike | null>(null);
  const layerRef = useRef<KonvaLayerLike | null>(null);
  const transformerRef = useRef<KonvaTransformerLike | null>(null);
  const konvaRef = useRef<KonvaApiLike | null>(null);
  const previewNodeRef = useRef<KonvaNodeLike | null>(null);
  const selectedNodeRef = useRef<KonvaNodeLike | null>(null);
  const toolRef = useRef<CanvasTool>(tool);
  const textRef = useRef(text);
  const dragRef = useRef<DragDraft | null>(null);
  const strokePointsRef = useRef<Array<[number, number]>>([]);
  const applyZoomRef = useRef<() => void>(() => undefined);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    toolRef.current = tool;
    textRef.current = text;
  }, [text, tool]);

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
  useEffect(() => {
    applyZoomRef.current = applyZoom;
  }, [applyZoom]);

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

      const apply = (document: Parameters<KonvaCanvasDocumentController["applyDocument"]>[0]) => {
        if (!layer || !konvaRef.current) return;
        removePreview();
        setSelected(null);
        konvaDocumentToLayer(layer, konvaRef.current, document, transformer);
        applyZoomRef.current();
      };
      applyDocumentRef.current = apply;
      apply(initialDocumentRef.current);

      const commitCurrent = () => {
        if (!layer) return;
        commitRef.current(konvaLayerToDocument(layer));
      };
      const handlers = createKonvaInteractionHandlers({
        container,
        layer,
        konva,
        toolRef,
        textRef,
        dragRef,
        strokePointsRef,
        previewNodeRef,
        removePreview,
        setSelected,
        commitCurrent,
      });

      stage.on("pointerdown", handlers.onPointerDown);
      stage.on("pointermove", handlers.onPointerMove);
      stage.on("pointerup", handlers.onPointerUp);
      stage.on("click tap", handlers.onClick);
      layer.on("dragend transformend", handlers.onTransformOrDragEnd);
      setReady(true);
      applyZoomRef.current();

      cleanup = () => {
        stage.off("pointerdown", handlers.onPointerDown);
        stage.off("pointermove", handlers.onPointerMove);
        stage.off("pointerup", handlers.onPointerUp);
        stage.off("click tap", handlers.onClick);
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
  }, [initialDocumentRef, applyDocumentRef, commitRef, removePreview, setSelected]);

  useEffect(() => {
    applyZoom();
  }, [applyZoom]);

  const getCurrentDocument = useCallback(() => {
    const layer = layerRef.current;
    return layer ? konvaLayerToDocument(layer) : null;
  }, []);

  const deleteSelected = useCallback(() => {
    const selected = selectedNodeRef.current;
    const layer = layerRef.current;
    if (!selected || !layer) return;
    selected.destroy();
    setSelected(null);
    commitRef.current(konvaLayerToDocument(layer));
  }, [commitRef, setSelected]);

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

  return {
    surfaceRef,
    containerRef,
    ready,
    getCurrentDocument,
    deleteSelected,
  };
}
