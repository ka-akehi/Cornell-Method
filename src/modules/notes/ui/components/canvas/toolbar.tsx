"use client";

import {
  findToolDefinition,
  getToolGroup,
} from "@/modules/notes/ui/canvas";
import { CanvasToolGroup } from "./toolbar-actions";
import { CanvasHistoryActions } from "./toolbar-history-actions";
import { CanvasPaperSizeControls } from "./toolbar-paper-controls";
import { CanvasStyleControls } from "./toolbar-style-controls";
import type { NoteCanvasToolbarProps } from "@/modules/notes/ui/canvas";

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
            tooltipMode="floating"
          />
          <CanvasToolGroup
            group={getToolGroup("line")}
            tool={tool}
            onToolChange={onToolChange}
            tooltipMode="floating"
          />
          <CanvasToolGroup
            group={getToolGroup("shape")}
            tool={tool}
            onToolChange={onToolChange}
            tooltipMode="floating"
          />
          <CanvasToolGroup
            group={getToolGroup("text")}
            tool={tool}
            onToolChange={onToolChange}
            tooltipMode="floating"
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
