"use client";

import type { Dispatch, SetStateAction } from "react";

export type CanvasTool =
  | "select"
  | "pen"
  | "line"
  | "arrow"
  | "rect"
  | "ellipse"
  | "text"
  | "erase";

export type CanvasZoom = "fit" | 0.5 | 1 | 2;

const TOOLS: Array<{ value: CanvasTool; label: string; hint: string }> = [
  { value: "select", label: "選択", hint: "移動・resize・削除" },
  { value: "pen", label: "ペン", hint: "freehand stroke" },
  { value: "line", label: "直線", hint: "line" },
  { value: "arrow", label: "矢印", hint: "arrow" },
  { value: "rect", label: "四角", hint: "rectangle" },
  { value: "ellipse", label: "円", hint: "ellipse" },
  { value: "text", label: "テキスト", hint: "plain text box" },
  { value: "erase", label: "消去", hint: "object erase" },
];

type CanvasSpikeToolbarProps = {
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
};

export function CanvasSpikeToolbar({
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
}: CanvasSpikeToolbarProps) {
  return (
    <div className="canvas-spike-toolbar" aria-label="Canvas tools">
      <div className="canvas-spike-toolbar-group" role="group" aria-label="描画ツール">
        {TOOLS.map((item) => (
          <button
            key={item.value}
            type="button"
            className="canvas-spike-tool-button"
            data-active={tool === item.value}
            aria-pressed={tool === item.value}
            title={item.hint}
            onClick={() => setTool(item.value)}
          >
            {item.label}
          </button>
        ))}
      </div>

      <label className="canvas-spike-text-control">
        <span>テキスト内容</span>
        <input
          value={text}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={(event) => event.stopPropagation()}
          aria-label="テキストツールで追加する本文"
        />
      </label>

      <div className="canvas-spike-toolbar-group" role="group" aria-label="履歴と保存">
        <button type="button" onClick={onUndo} disabled={!canUndo}>
          Undo
        </button>
        <button type="button" onClick={onRedo} disabled={!canRedo}>
          Redo
        </button>
        <button type="button" onClick={onReset}>
          Fixture reset
        </button>
        <button type="button" onClick={onSaveRoundTrip}>
          Save → restore test
        </button>
        <button type="button" onClick={onRestoreRoundTrip} disabled={!hasSavedRoundTrip}>
          Restore saved
        </button>
      </div>

      <div className="canvas-spike-toolbar-group" role="group" aria-label="ズーム">
        {(["fit", 0.5, 1, 2] as CanvasZoom[]).map((value) => (
          <button
            key={String(value)}
            type="button"
            data-active={zoom === value}
            aria-pressed={zoom === value}
            onClick={() => setZoom(value)}
          >
            {value === "fit" ? "Fit" : `${value * 100}%`}
          </button>
        ))}
      </div>

      <span className="canvas-spike-roundtrip-status" role="status" aria-live="polite">
        {roundTripStatus}
      </span>
    </div>
  );
}
