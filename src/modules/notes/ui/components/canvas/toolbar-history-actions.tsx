"use client";

import { useId, useState } from "react";
import { ToolbarIcon } from "./toolbar-icon";
import { CanvasFloatingTooltip } from "./toolbar-floating-tooltip";

type CanvasHistoryActionsProps = {
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
};

type HistoryAction = "undo" | "redo";
type HistoryTooltipTarget = {
  action: HistoryAction;
  anchor: HTMLButtonElement;
};

const HISTORY_TOOLTIP_ITEMS = {
  undo: {
    value: "history-undo",
    description: "Canvas の直前の操作を元に戻す",
  },
  redo: {
    value: "history-redo",
    description: "Canvas の取り消した操作をやり直す",
  },
} as const;

export function CanvasHistoryActions({
  canUndo,
  canRedo,
  onUndo,
  onRedo,
}: CanvasHistoryActionsProps) {
  const idPrefix = useId();
  const undoDescriptionId = `${idPrefix}-undo-description`;
  const redoDescriptionId = `${idPrefix}-redo-description`;
  const [hoveredTooltip, setHoveredTooltip] =
    useState<HistoryTooltipTarget | null>(null);
  const [focusedTooltip, setFocusedTooltip] =
    useState<HistoryTooltipTarget | null>(null);
  const activeTooltipTarget = hoveredTooltip ?? focusedTooltip;

  return (
    <div
      className="note-canvas-toolbar-drawing-history"
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
        onMouseEnter={(event) =>
          setHoveredTooltip({ action: "undo", anchor: event.currentTarget })
        }
        onMouseLeave={() => setHoveredTooltip(null)}
        onFocus={(event) =>
          setFocusedTooltip({ action: "undo", anchor: event.currentTarget })
        }
        onBlur={() => setFocusedTooltip(null)}
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
        onMouseEnter={(event) =>
          setHoveredTooltip({ action: "redo", anchor: event.currentTarget })
        }
        onMouseLeave={() => setHoveredTooltip(null)}
        onFocus={(event) =>
          setFocusedTooltip({ action: "redo", anchor: event.currentTarget })
        }
        onBlur={() => setFocusedTooltip(null)}
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
      <CanvasFloatingTooltip
        item={
          activeTooltipTarget
            ? HISTORY_TOOLTIP_ITEMS[activeTooltipTarget.action]
            : null
        }
        anchor={activeTooltipTarget?.anchor ?? null}
      />
    </div>
  );
}
