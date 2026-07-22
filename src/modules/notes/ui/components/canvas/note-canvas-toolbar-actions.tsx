"use client";

import { useId } from "react";
import type {
  CanvasNoteTool,
} from "./note-canvas-toolbar.types";
import type { ToolGroupDefinition } from "./note-canvas-toolbar-definitions";
import { ToolbarIcon } from "./note-canvas-toolbar-icon";

type CanvasToolGroupProps = {
  group: ToolGroupDefinition;
  tool: CanvasNoteTool;
  onToolChange: (tool: CanvasNoteTool) => void;
  showTooltip?: boolean;
};

export function CanvasToolGroup({
  group,
  tool,
  onToolChange,
  showTooltip = true,
}: CanvasToolGroupProps) {
  const idPrefix = useId();

  return (
    <div
      className={`note-canvas-toolbar-group note-canvas-toolbar-group--${group.key}`}
      role="group"
      aria-label={group.ariaLabel}
    >
      {group.tools.map((item) => {
        const isActive = tool === item.value;
        const descriptionId = `${idPrefix}-${item.value}-description`;

        return (
          <button
            key={item.value}
            type="button"
            className="note-canvas-tool-button"
            data-tool={item.value}
            data-active={isActive}
            aria-pressed={isActive}
            aria-label={item.ariaLabel}
            aria-describedby={descriptionId}
            title={item.description}
            onClick={() => onToolChange(item.value)}
          >
            <span className="note-canvas-tool-icon" aria-hidden="true">
              <ToolbarIcon name={item.icon} />
            </span>
            <span className="note-canvas-tool-label">{item.label}</span>
            <span id={descriptionId} className="note-canvas-toolbar-visually-hidden">
              {item.description}
            </span>
            {showTooltip && (
              <span className="note-canvas-toolbar-tooltip" aria-hidden="true">
                {item.description}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

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
