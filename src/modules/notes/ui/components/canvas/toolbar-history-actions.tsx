"use client";

import { useId } from "react";
import { ToolbarIcon } from "./toolbar-icon";

type CanvasHistoryActionsProps = {
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
};

export function CanvasHistoryActions({
  canUndo,
  canRedo,
  onUndo,
  onRedo,
}: CanvasHistoryActionsProps) {
  const idPrefix = useId();
  const undoDescriptionId = `${idPrefix}-undo-description`;
  const redoDescriptionId = `${idPrefix}-redo-description`;

  return (
    <div
      className="note-canvas-toolbar-group note-canvas-toolbar-group--history"
      role="group"
      aria-label="Canvas 履歴"
    >
      <button
        type="button"
        className="note-canvas-toolbar-action"
        onClick={onUndo}
        disabled={!canUndo}
        aria-label="Canvas の操作を元に戻す"
        aria-describedby={undoDescriptionId}
        title="Canvas の直前の操作を元に戻す"
      >
        <span className="note-canvas-tool-icon" aria-hidden="true">
          <ToolbarIcon name="undo" />
        </span>
        <span className="note-canvas-tool-label">戻す</span>
        <span id={undoDescriptionId} className="note-canvas-toolbar-visually-hidden">
          Canvas の直前の操作を元に戻す
        </span>
        <span className="note-canvas-toolbar-tooltip" aria-hidden="true">
          Canvas の直前の操作を元に戻す
        </span>
      </button>
      <button
        type="button"
        className="note-canvas-toolbar-action"
        onClick={onRedo}
        disabled={!canRedo}
        aria-label="Canvas の操作をやり直す"
        aria-describedby={redoDescriptionId}
        title="Canvas の取り消した操作をやり直す"
      >
        <span className="note-canvas-tool-icon" aria-hidden="true">
          <ToolbarIcon name="redo" />
        </span>
        <span className="note-canvas-tool-label">やり直す</span>
        <span id={redoDescriptionId} className="note-canvas-toolbar-visually-hidden">
          Canvas の取り消した操作をやり直す
        </span>
        <span className="note-canvas-toolbar-tooltip" aria-hidden="true">
          Canvas の取り消した操作をやり直す
        </span>
      </button>
    </div>
  );
}
