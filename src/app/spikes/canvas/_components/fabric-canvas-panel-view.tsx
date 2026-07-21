import type {
  Dispatch,
  KeyboardEventHandler,
  RefObject,
  SetStateAction,
} from "react";
import { CANVAS_PAGE, formatDocumentBytes } from "@/shared/canvas";
import {
  CanvasSpikeToolbar,
  type CanvasTool,
  type CanvasZoom,
} from "./canvas-toolbar";

type FabricCanvasPanelViewProps = {
  tool: CanvasTool;
  setTool: Dispatch<SetStateAction<CanvasTool>>;
  text: string;
  setText: Dispatch<SetStateAction<string>>;
  zoom: CanvasZoom;
  setZoom: Dispatch<SetStateAction<CanvasZoom>>;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onReset: () => void;
  onSaveRoundTrip: () => void;
  onRestoreRoundTrip: () => void;
  hasSavedRoundTrip: boolean;
  roundTripStatus: string;
  ready: boolean;
  viewportRef: RefObject<HTMLDivElement | null>;
  surfaceRef: RefObject<HTMLDivElement | null>;
  canvasElementRef: RefObject<HTMLCanvasElement | null>;
  onKeyDown: KeyboardEventHandler<HTMLDivElement>;
  elementCount: number;
  documentJson: string;
  searchText: string;
};

export function FabricCanvasPanelView({
  tool,
  setTool,
  text,
  setText,
  zoom,
  setZoom,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onReset,
  onSaveRoundTrip,
  onRestoreRoundTrip,
  hasSavedRoundTrip,
  roundTripStatus,
  ready,
  viewportRef,
  surfaceRef,
  canvasElementRef,
  onKeyDown,
  elementCount,
  documentJson,
  searchText,
}: FabricCanvasPanelViewProps) {
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
        canUndo={canUndo}
        canRedo={canRedo}
        onUndo={onUndo}
        onRedo={onRedo}
        onReset={onReset}
        onSaveRoundTrip={onSaveRoundTrip}
        onRestoreRoundTrip={onRestoreRoundTrip}
        hasSavedRoundTrip={hasSavedRoundTrip}
        roundTripStatus={roundTripStatus}
      />

      <div
        ref={viewportRef}
        className="canvas-spike-viewport"
        tabIndex={0}
        onPointerDown={() => viewportRef.current?.focus()}
        onKeyDown={onKeyDown}
        aria-label="Fabric.js 固定ページキャンバス。Canvas にフォーカスして Ctrl または Cmd のショートカットを使用できます。"
      >
        <div ref={surfaceRef} className="canvas-spike-stage">
          <canvas
            ref={canvasElementRef}
            width={CANVAS_PAGE.width}
            height={CANVAS_PAGE.height}
          />
        </div>
      </div>

      <div className="canvas-spike-engine-meta">
        <span>{elementCount} elements</span>
        <span>{formatDocumentBytes(documentJson)}</span>
        <span>searchText: {searchText || "(empty)"}</span>
      </div>
    </section>
  );
}
