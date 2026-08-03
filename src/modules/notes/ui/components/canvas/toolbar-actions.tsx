"use client";

import { createPortal } from "react-dom";
import {
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import type {
  CanvasNoteTool,
  ToolDefinition,
  ToolGroupDefinition,
} from "@/modules/notes/ui/canvas";
import { ToolbarIcon } from "./toolbar-icon";

type CanvasToolTooltipMode = "inline" | "floating";

type CanvasToolGroupProps = {
  group: ToolGroupDefinition;
  tool: CanvasNoteTool;
  onToolChange: (tool: CanvasNoteTool) => void;
  showTooltip?: boolean;
  tooltipMode?: CanvasToolTooltipMode;
};

type CanvasToolButtonProps = {
  item: ToolDefinition;
  isActive: boolean;
  descriptionId: string;
  onToolChange: (tool: CanvasNoteTool) => void;
  showTooltip: boolean;
  floatingTooltip: boolean;
  onTooltipHover?: (target: CanvasTooltipTarget | null) => void;
  onTooltipFocus?: (target: CanvasTooltipTarget | null) => void;
};

type CanvasTooltipTarget = {
  tool: CanvasNoteTool;
  anchor: HTMLButtonElement;
};

type FloatingTooltipPlacement = {
  anchor: HTMLButtonElement;
  item: ToolDefinition;
  left: number;
  top: number;
  side: "top" | "bottom";
};

function CanvasToolButton({
  item,
  isActive,
  descriptionId,
  onToolChange,
  showTooltip,
  floatingTooltip,
  onTooltipHover,
  onTooltipFocus,
}: CanvasToolButtonProps) {
  return (
    <button
      type="button"
      className="note-canvas-tool-button"
      data-tool={item.value}
      data-active={isActive}
      aria-pressed={isActive}
      aria-label={item.ariaLabel}
      aria-describedby={descriptionId}
      title={item.description}
      onClick={() => onToolChange(item.value)}
      onMouseEnter={
        floatingTooltip
          ? (event) =>
              onTooltipHover?.({ tool: item.value, anchor: event.currentTarget })
          : undefined
      }
      onMouseLeave={
        floatingTooltip ? () => onTooltipHover?.(null) : undefined
      }
      onFocus={
        floatingTooltip
          ? (event) =>
              onTooltipFocus?.({ tool: item.value, anchor: event.currentTarget })
          : undefined
      }
      onBlur={floatingTooltip ? () => onTooltipFocus?.(null) : undefined}
    >
      <span className="note-canvas-tool-icon" aria-hidden="true">
        <ToolbarIcon name={item.icon} />
      </span>
      <span className="note-canvas-tool-label">{item.label}</span>
      <span id={descriptionId} className="note-canvas-toolbar-visually-hidden">
        {item.description}
      </span>
      {showTooltip && !floatingTooltip && (
        <span className="note-canvas-toolbar-tooltip" aria-hidden="true">
          {item.description}
        </span>
      )}
    </button>
  );
}

function CanvasFloatingTooltip({
  item,
  anchor,
}: {
  item: ToolDefinition | null;
  anchor: HTMLButtonElement | null;
}) {
  const tooltipRef = useRef<HTMLSpanElement>(null);
  const [placement, setPlacement] = useState<FloatingTooltipPlacement | null>(
    null,
  );

  useLayoutEffect(() => {
    if (!item || !anchor) {
      return;
    }

    let disposed = false;
    const updatePlacement = () => {
      const tooltip = tooltipRef.current;
      if (!tooltip || !anchor.isConnected) {
        return;
      }

      const anchorRect = anchor.getBoundingClientRect();
      const tooltipRect = tooltip.getBoundingClientRect();
      const viewportPadding = 12;
      const gap = 7;
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const maxLeft = Math.max(
        viewportPadding,
        viewportWidth - tooltipRect.width - viewportPadding,
      );
      const centeredLeft =
        anchorRect.left + anchorRect.width / 2 - tooltipRect.width / 2;
      const left = Math.min(
        maxLeft,
        Math.max(viewportPadding, centeredLeft),
      );
      const spaceAbove = anchorRect.top - viewportPadding;
      const spaceBelow = viewportHeight - anchorRect.bottom - viewportPadding;
      const side: FloatingTooltipPlacement["side"] =
        spaceBelow < tooltipRect.height + gap && spaceAbove > spaceBelow
          ? "top"
          : "bottom";
      const preferredTop =
        side === "top"
          ? anchorRect.top - tooltipRect.height - gap
          : anchorRect.bottom + gap;
      const maxTop = Math.max(
        viewportPadding,
        viewportHeight - tooltipRect.height - viewportPadding,
      );
      const top = Math.min(maxTop, Math.max(viewportPadding, preferredTop));

      if (!disposed) {
        setPlacement({ anchor, item, left, top, side });
      }
    };

    updatePlacement();
    window.addEventListener("resize", updatePlacement);
    window.addEventListener("scroll", updatePlacement, true);

    return () => {
      disposed = true;
      window.removeEventListener("resize", updatePlacement);
      window.removeEventListener("scroll", updatePlacement, true);
    };
  }, [anchor, item]);

  if (!item || !anchor || typeof document === "undefined" || !document.body) {
    return null;
  }

  const isPositioned =
    placement?.anchor === anchor && placement.item.value === item.value;

  return createPortal(
    <span
      ref={tooltipRef}
      className="note-canvas-toolbar-tooltip note-canvas-toolbar-tooltip--floating"
      data-positioned={isPositioned}
      data-placement={isPositioned ? placement.side : undefined}
      style={{
        left: isPositioned ? placement.left : 0,
        top: isPositioned ? placement.top : 0,
      }}
      aria-hidden="true"
    >
      {item.description}
    </span>,
    document.body,
  );
}

export function CanvasToolGroup({
  group,
  tool,
  onToolChange,
  showTooltip = true,
  tooltipMode = "inline",
}: CanvasToolGroupProps) {
  const idPrefix = useId();
  const [hoveredTooltip, setHoveredTooltip] =
    useState<CanvasTooltipTarget | null>(null);
  const [focusedTooltip, setFocusedTooltip] =
    useState<CanvasTooltipTarget | null>(null);
  const floatingTooltip = tooltipMode === "floating";
  const activeTooltipTarget = floatingTooltip
    ? (hoveredTooltip ?? focusedTooltip)
    : null;
  const activeTooltipValue = activeTooltipTarget?.tool ?? null;
  const activeTooltipItem =
    group.tools.find((item) => item.value === activeTooltipValue) ?? null;
  const activeTooltipAnchor = activeTooltipTarget?.anchor ?? null;

  return (
    <>
      <div
        className={`note-canvas-toolbar-group note-canvas-toolbar-group--${group.key}`}
        role="group"
        aria-label={group.ariaLabel}
      >
        {group.tools.map((item) => {
          const isActive = tool === item.value;
          const descriptionId = `${idPrefix}-${item.value}-description`;

          return (
            <CanvasToolButton
              key={item.value}
              item={item}
              isActive={isActive}
              descriptionId={descriptionId}
              onToolChange={onToolChange}
              showTooltip={showTooltip}
              floatingTooltip={floatingTooltip}
              onTooltipHover={floatingTooltip ? setHoveredTooltip : undefined}
              onTooltipFocus={floatingTooltip ? setFocusedTooltip : undefined}
            />
          );
        })}
      </div>
      {floatingTooltip && (
        <CanvasFloatingTooltip
          item={activeTooltipItem}
          anchor={activeTooltipAnchor}
        />
      )}
    </>
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
