"use client";

import {
  findToolDefinition,
  getToolGroup,
} from "./note-canvas-toolbar-definitions";
import { CanvasHistoryActions, CanvasToolGroup } from "./note-canvas-toolbar-actions";
import { CanvasPaperSizeControls } from "./note-canvas-toolbar-paper-controls";
import { CanvasStyleControls } from "./note-canvas-toolbar-style-controls";
import type { NoteCanvasToolbarProps } from "./note-canvas-toolbar.types";

export {
  CANVAS_DEFAULT_FONT_SIZE,
  CANVAS_DEFAULT_STROKE_WIDTH,
  CANVAS_MAX_FONT_SIZE,
  CANVAS_MAX_STROKE_WIDTH,
  CANVAS_MIN_FONT_SIZE,
  CANVAS_MIN_STROKE_WIDTH,
} from "./note-canvas-toolbar.types";
export type {
  CanvasNoteTool,
  CanvasStyleChange,
  CanvasStyleControlValues,
  CanvasStyleTarget,
  NoteCanvasToolbarProps,
} from "./note-canvas-toolbar.types";

export function NoteCanvasToolbar({
  tool,
  onToolChange,
  pageDimensions,
  onPageDimensionsChange,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  styleTarget,
  styleValues,
  onStyleChange,
}: NoteCanvasToolbarProps) {
  const activeTool = findToolDefinition(tool);
  const pageKey = `${pageDimensions.width}-${pageDimensions.height}`;

  return (
    <div
      className="note-canvas-toolbar"
      role="toolbar"
      aria-label="Canvas ツールバー"
      aria-orientation="horizontal"
    >
      <CanvasToolGroup
        group={getToolGroup("operation")}
        tool={tool}
        onToolChange={onToolChange}
      />

      <div
        className="note-canvas-toolbar-drawing-rail"
        role="group"
        aria-label="Canvas 描画ツール"
      >
        <div className="note-canvas-toolbar-drawing-rail-inner">
          <CanvasToolGroup
            group={getToolGroup("draw")}
            tool={tool}
            onToolChange={onToolChange}
            showTooltip={false}
          />
          <CanvasToolGroup
            group={getToolGroup("line")}
            tool={tool}
            onToolChange={onToolChange}
            showTooltip={false}
          />
          <CanvasToolGroup
            group={getToolGroup("shape")}
            tool={tool}
            onToolChange={onToolChange}
            showTooltip={false}
          />
          <CanvasToolGroup
            group={getToolGroup("text")}
            tool={tool}
            onToolChange={onToolChange}
            showTooltip={false}
          />
        </div>
      </div>

      <CanvasStyleControls
        styleTarget={styleTarget}
        styleValues={styleValues}
        onStyleChange={onStyleChange}
      />

      <CanvasToolGroup
        group={getToolGroup("erase")}
        tool={tool}
        onToolChange={onToolChange}
      />

      <CanvasHistoryActions
        canUndo={canUndo}
        canRedo={canRedo}
        onUndo={onUndo}
        onRedo={onRedo}
      />

      <CanvasPaperSizeControls
        key={pageKey}
        pageDimensions={pageDimensions}
        onPageDimensionsChange={onPageDimensionsChange}
      />

      <span
        className="note-canvas-toolbar-status"
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        現在のツール: {activeTool?.label ?? "選択"}
      </span>
    </div>
  );
}
