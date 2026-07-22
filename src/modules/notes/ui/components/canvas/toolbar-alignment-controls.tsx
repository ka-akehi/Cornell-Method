"use client";

import type { MouseEvent } from "react";
import type {
  CanvasStyleChange,
  CanvasStyleControlValues,
  CanvasStyleTarget,
} from "@/modules/notes/ui/canvas";
import { TEXT_ALIGNMENT_OPTIONS } from "@/modules/notes/ui/canvas";
import { ToolbarIcon } from "./toolbar-icon";

type CanvasTextAlignmentControlsProps = {
  styleTarget: CanvasStyleTarget;
  styleValues: CanvasStyleControlValues;
  onStyleChange: (change: CanvasStyleChange) => void;
};

function preventCanvasTextEditingBlur(event: MouseEvent<HTMLButtonElement>) {
  // Keep Fabric's hidden textarea (and the shape inline editor) active until
  // the alignment change has been handled by the click event.
  event.preventDefault();
}

export function CanvasTextAlignmentControls({
  styleTarget,
  styleValues,
  onStyleChange,
}: CanvasTextAlignmentControlsProps) {
  const disabled = styleTarget !== "text";

  return (
    <div
      className="note-canvas-style-alignment"
      role="group"
      aria-label="文字の配置"
      data-disabled={disabled}
    >
      {TEXT_ALIGNMENT_OPTIONS.map((option) => {
        const isActive = styleValues.textAlign === option.value;
        return (
          <button
            key={option.value}
            type="button"
            className="note-canvas-alignment-button"
            data-active={isActive}
            aria-label={option.label}
            aria-pressed={isActive}
            title={option.description}
            disabled={disabled}
            onMouseDown={preventCanvasTextEditingBlur}
            onClick={() => onStyleChange({ textAlign: option.value })}
          >
            <span className="note-canvas-tool-icon" aria-hidden="true">
              <ToolbarIcon name={option.icon} />
            </span>
            <span className="note-canvas-toolbar-visually-hidden">{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}
