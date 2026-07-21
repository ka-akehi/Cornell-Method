"use client";

import { useCallback, useState, type KeyboardEvent } from "react";
import {
  createDemoCanvasDocument,
  extractCanvasSearchText,
  formatDocumentBytes,
  restoreCanvasDocument,
  serializeCanvasDocument,
} from "@/shared/canvas";
import {
  CanvasSpikeToolbar,
  type CanvasTool,
  type CanvasZoom,
} from "./canvas-toolbar";
import { KonvaCanvasSurface } from "./konva-canvas-surface";
import type { KonvaCanvasPanelProps } from "./konva-canvas-types";
import { useKonvaCanvasDocument } from "./use-konva-canvas-document";
import { useKonvaCanvasRuntime } from "./use-konva-canvas-runtime";

export function KonvaCanvasPanel({
  initialDocument,
  onDocumentChange,
}: KonvaCanvasPanelProps) {
  const [tool, setTool] = useState<CanvasTool>("select");
  const [text, setText] = useState("New canvas text");
  const [zoom, setZoom] = useState<CanvasZoom>("fit");
  const [roundTrip, setRoundTrip] = useState<string | null>(null);
  const [roundTripStatus, setRoundTripStatus] = useState("Round trip: not run");
  const {
    initialDocumentRef,
    applyDocumentRef,
    commitRef,
    history,
    documentJson,
    applyDocument,
    restoreDocument,
    undo,
    redo,
  } = useKonvaCanvasDocument({ initialDocument, onDocumentChange });
  const {
    viewportRef,
    surfaceRef,
    containerRef,
    ready,
    getCurrentDocument,
    deleteSelected,
  } = useKonvaCanvasRuntime({
    initialDocumentRef,
    applyDocumentRef,
    commitRef,
    tool,
    text,
    zoom,
  });

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
    const current = getCurrentDocument();
    if (!current) return;
    const serialized = serializeCanvasDocument(current);
    const restored = restoreCanvasDocument(serialized);
    setRoundTrip(serialized);
    applyDocument(restored);
    setRoundTripStatus(
      serializeCanvasDocument(restored) === serialized
        ? "Round trip: PASS (app JSON)"
        : "Round trip: FAIL",
    );
  }, [applyDocument, getCurrentDocument]);

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

      <KonvaCanvasSurface
        viewportRef={viewportRef}
        surfaceRef={surfaceRef}
        containerRef={containerRef}
        onKeyDown={handleKeyDown}
      />

      <div className="canvas-spike-engine-meta">
        <span>{history.present.elements.length} elements</span>
        <span>{formatDocumentBytes(documentJson)}</span>
        <span>searchText: {extractCanvasSearchText(history.present) || "(empty)"}</span>
      </div>
    </section>
  );
}
