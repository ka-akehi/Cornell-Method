"use client";

import { createPortal } from "react-dom";
import {
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import type { CanvasNoteTool } from "@/modules/notes/ui/canvas";

export type CanvasTooltipTarget = {
  tool: CanvasNoteTool;
  anchor: HTMLButtonElement;
};

type FloatingTooltipPlacement = {
  anchor: HTMLButtonElement;
  item: FloatingTooltipItem;
  left: number;
  top: number;
  side: "top" | "bottom";
};

type FloatingTooltipItem = {
  value: string;
  description: string;
};

export function CanvasFloatingTooltip({
  item,
  anchor,
}: {
  item: FloatingTooltipItem | null;
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
