"use client";

import {
  useState,
  type ChangeEvent,
  type KeyboardEvent,
} from "react";
import {
  CANVAS_MAX_FONT_SIZE,
  CANVAS_MAX_STROKE_WIDTH,
  CANVAS_MIN_FONT_SIZE,
  CANVAS_MIN_STROKE_WIDTH,
  type CanvasStyleChange,
  type CanvasStyleControlValues,
  type CanvasStyleTarget,
} from "./note-canvas-toolbar.types";
import { CanvasTextAlignmentControls } from "./note-canvas-toolbar-alignment-controls";
import {
  CanvasIntegerStyleInput,
  parseIntegerStyleValue,
} from "./note-canvas-toolbar-style-input";

type IntegerStyleInputKey = "strokeWidth" | "fontSize";
type IntegerStyleInputValues = Record<IntegerStyleInputKey, string>;

type CanvasStyleControlsProps = {
  styleTarget: CanvasStyleTarget;
  styleValues: CanvasStyleControlValues;
  onStyleChange: (change: CanvasStyleChange) => void;
};

export function CanvasStyleControls({
  styleTarget,
  styleValues,
  onStyleChange,
}: CanvasStyleControlsProps) {
  const [styleInputValues, setStyleInputValues] = useState<IntegerStyleInputValues>(() => ({
    strokeWidth: String(styleValues.strokeWidth),
    fontSize: String(styleValues.fontSize),
  }));
  const [activeStyleInput, setActiveStyleInput] = useState<IntegerStyleInputKey | null>(null);

  function setStyleInputValue(key: IntegerStyleInputKey, value: string) {
    setStyleInputValues((current) => ({ ...current, [key]: value }));
  }

  function beginIntegerStyleInput(key: IntegerStyleInputKey) {
    setStyleInputValue(
      key,
      String(key === "strokeWidth" ? styleValues.strokeWidth : styleValues.fontSize),
    );
    setActiveStyleInput(key);
  }

  function styleChangeForInteger(
    key: IntegerStyleInputKey,
    value: number,
    commit: boolean,
  ): CanvasStyleChange {
    return key === "strokeWidth"
      ? { strokeWidth: value, commit }
      : { fontSize: value, commit };
  }

  function handleIntegerStyleInputChange(
    event: ChangeEvent<HTMLInputElement>,
    min: number,
    max: number,
    key: IntegerStyleInputKey,
  ) {
    const rawValue = event.target.value;
    setStyleInputValue(key, rawValue);

    const value = parseIntegerStyleValue(rawValue, min, max);
    if (value === null) return;
    onStyleChange(styleChangeForInteger(key, value, false));
  }

  function commitIntegerStyleInput(
    rawValue: string,
    min: number,
    max: number,
    key: IntegerStyleInputKey,
  ) {
    const value = parseIntegerStyleValue(rawValue, min, max);
    if (value === null) {
      const fallback = key === "strokeWidth" ? styleValues.strokeWidth : styleValues.fontSize;
      setStyleInputValue(key, String(fallback));
      onStyleChange(styleChangeForInteger(key, fallback, true));
      return;
    }

    setStyleInputValue(key, String(value));
    onStyleChange(styleChangeForInteger(key, value, true));
  }

  function handleIntegerStyleKeyDown(
    event: KeyboardEvent<HTMLInputElement>,
    min: number,
    max: number,
    key: IntegerStyleInputKey,
  ) {
    if (event.key !== "Enter") return;
    event.preventDefault();
    event.stopPropagation();
    commitIntegerStyleInput(event.currentTarget.value, min, max, key);
  }

  const strokeWidthInputValue =
    activeStyleInput === "strokeWidth"
      ? styleInputValues.strokeWidth
      : String(styleValues.strokeWidth);
  const fontSizeInputValue =
    activeStyleInput === "fontSize" ? styleInputValues.fontSize : String(styleValues.fontSize);
  const disabledStrokeWidth = styleTarget !== "stroke";
  const disabledColor = styleTarget === null;
  const disabledFontSize = styleTarget !== "text";

  return (
    <div
      className="note-canvas-toolbar-group note-canvas-toolbar-group--style"
      role="group"
      aria-label="Canvas スタイル"
    >
      <label className="note-canvas-style-field" data-disabled={disabledStrokeWidth}>
        <span>線幅</span>
        <span className="note-canvas-style-field-control">
          <CanvasIntegerStyleInput
            value={strokeWidthInputValue}
            min={CANVAS_MIN_STROKE_WIDTH}
            max={CANVAS_MAX_STROKE_WIDTH}
            ariaLabel="線幅（px）"
            disabled={disabledStrokeWidth}
            onFocus={() => beginIntegerStyleInput("strokeWidth")}
            onChange={(event) =>
              handleIntegerStyleInputChange(
                event,
                CANVAS_MIN_STROKE_WIDTH,
                CANVAS_MAX_STROKE_WIDTH,
                "strokeWidth",
              )
            }
            onBlur={(event) => {
              commitIntegerStyleInput(
                event.currentTarget.value,
                CANVAS_MIN_STROKE_WIDTH,
                CANVAS_MAX_STROKE_WIDTH,
                "strokeWidth",
              );
              setActiveStyleInput(null);
            }}
            onKeyDown={(event) =>
              handleIntegerStyleKeyDown(
                event,
                CANVAS_MIN_STROKE_WIDTH,
                CANVAS_MAX_STROKE_WIDTH,
                "strokeWidth",
              )
            }
          />
        </span>
      </label>
      <label className="note-canvas-style-field" data-disabled={disabledColor}>
        <span>色</span>
        <input
          className="note-canvas-style-color"
          type="color"
          value={styleValues.color}
          disabled={disabledColor}
          aria-label={styleTarget === "text" ? "文字色" : "線の色"}
          onChange={(event) => onStyleChange({ color: event.target.value })}
        />
      </label>
      <label className="note-canvas-style-field" data-disabled={disabledFontSize}>
        <span>文字サイズ</span>
        <span className="note-canvas-style-field-control">
          <CanvasIntegerStyleInput
            value={fontSizeInputValue}
            min={CANVAS_MIN_FONT_SIZE}
            max={CANVAS_MAX_FONT_SIZE}
            ariaLabel="フォントサイズ（px）"
            disabled={disabledFontSize}
            onFocus={() => beginIntegerStyleInput("fontSize")}
            onChange={(event) =>
              handleIntegerStyleInputChange(
                event,
                CANVAS_MIN_FONT_SIZE,
                CANVAS_MAX_FONT_SIZE,
                "fontSize",
              )
            }
            onBlur={(event) => {
              commitIntegerStyleInput(
                event.currentTarget.value,
                CANVAS_MIN_FONT_SIZE,
                CANVAS_MAX_FONT_SIZE,
                "fontSize",
              );
              setActiveStyleInput(null);
            }}
            onKeyDown={(event) =>
              handleIntegerStyleKeyDown(
                event,
                CANVAS_MIN_FONT_SIZE,
                CANVAS_MAX_FONT_SIZE,
                "fontSize",
              )
            }
          />
        </span>
      </label>
      <CanvasTextAlignmentControls
        styleTarget={styleTarget}
        styleValues={styleValues}
        onStyleChange={onStyleChange}
      />
    </div>
  );
}
