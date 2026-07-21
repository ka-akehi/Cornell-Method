"use client";

import { useCallback, useState, type KeyboardEvent } from "react";
import {
  extractCanvasSearchText,
  serializeCanvasDocument,
  type CanvasDocumentV1,
} from "@/shared/canvas";
import {
  type CanvasTool,
  type CanvasZoom,
} from "./canvas-toolbar";
import { FabricCanvasPanelView } from "./fabric-canvas-panel-view";
import {
  useFabricCanvasDocument,
} from "./use-fabric-canvas-document";
import { useFabricCanvasRoundTrip } from "./use-fabric-canvas-roundtrip";
import { useFabricCanvasRuntime } from "./use-fabric-canvas-runtime";
import { useFabricCanvasZoom } from "./use-fabric-canvas-zoom";

type FabricCanvasPanelProps = {
  initialDocument: CanvasDocumentV1;
  onDocumentChange?: (document: CanvasDocumentV1) => void;
};

export function FabricCanvasPanel({
  initialDocument,
  onDocumentChange,
}: FabricCanvasPanelProps) {
  const [tool, setTool] = useState<CanvasTool>("select");
  const [text, setText] = useState("New canvas text");
  const [zoom, setZoom] = useState<CanvasZoom>("fit");
  const documentState = useFabricCanvasDocument(
    initialDocument,
    onDocumentChange,
  );
  const runtime = useFabricCanvasRuntime({
    initialDocument: documentState.initialDocument,
    commitRef: documentState.commitRef,
    tool,
    text,
  });
  const { viewportRef } = useFabricCanvasZoom({
    surfaceRef: runtime.surfaceRef,
    canvasRef: runtime.canvasRef,
    applyZoomRef: runtime.applyZoomRef,
    zoom,
  });
  const roundTrip = useFabricCanvasRoundTrip({
    canvasRef: runtime.canvasRef,
    applyDocumentRef: documentState.applyDocumentRef,
    restoreDocument: documentState.restoreDocument,
  });
  const { reset: resetDocument, redo, undo } = documentState;
  const { clearRoundTrip } = roundTrip;
  const { deleteActiveObject } = runtime;

  const reset = useCallback(() => {
    resetDocument();
    clearRoundTrip();
  }, [clearRoundTrip, resetDocument]);

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

  const documentJson = serializeCanvasDocument(documentState.history.present);

  return (
    <FabricCanvasPanelView
      tool={tool}
      setTool={setTool}
      text={text}
      setText={setText}
      zoom={zoom}
      setZoom={setZoom}
      canUndo={documentState.history.past.length > 0}
      canRedo={documentState.history.future.length > 0}
      onUndo={documentState.undo}
      onRedo={documentState.redo}
      onReset={reset}
      onSaveRoundTrip={roundTrip.saveRoundTrip}
      onRestoreRoundTrip={roundTrip.restoreSavedRoundTrip}
      hasSavedRoundTrip={Boolean(roundTrip.roundTrip)}
      roundTripStatus={roundTrip.roundTripStatus}
      ready={runtime.ready}
      viewportRef={viewportRef}
      surfaceRef={runtime.surfaceRef}
      canvasElementRef={runtime.canvasElementRef}
      onKeyDown={handleKeyDown}
      elementCount={documentState.history.present.elements.length}
      documentJson={documentJson}
      searchText={extractCanvasSearchText(documentState.history.present)}
    />
  );
}
