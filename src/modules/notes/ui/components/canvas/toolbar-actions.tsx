"use client";

import { useId, useState } from "react";
import type {
  CanvasNoteTool,
  ToolDefinition,
  ToolGroupDefinition,
} from "@/modules/notes/ui/canvas";
import { ToolbarIcon } from "./toolbar-icon";
import {
  CanvasFloatingTooltip,
  type CanvasTooltipTarget,
} from "./toolbar-floating-tooltip";

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

export { CanvasHistoryActions } from "./toolbar-history-actions";
