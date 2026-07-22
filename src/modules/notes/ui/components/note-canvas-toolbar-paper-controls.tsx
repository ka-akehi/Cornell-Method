"use client";

import { useId, useRef, useState, type KeyboardEvent } from "react";
import {
  CANVAS_MAX_PAGE_DIMENSION,
  CANVAS_MIN_PAGE_DIMENSION,
  type CanvasPageDimensions,
} from "@/shared/canvas";
import { ToolbarIcon } from "./note-canvas-toolbar-icon";

type CanvasPaperSizeControlsProps = {
  pageDimensions: CanvasPageDimensions;
  onPageDimensionsChange: (dimensions: CanvasPageDimensions) => void;
};

type ValidationState = {
  pageKey: string;
  width: string | null;
  height: string | null;
};

function validateDimension(rawValue: string, label: string) {
  const value = rawValue.trim();
  if (!value) return `${label}を入力してください。`;
  if (!/^\d+$/.test(value)) return `${label}は整数の数値で入力してください。`;

  const dimension = Number(value);
  if (
    !Number.isSafeInteger(dimension) ||
    dimension < CANVAS_MIN_PAGE_DIMENSION ||
    dimension > CANVAS_MAX_PAGE_DIMENSION
  ) {
    return `${label}は${CANVAS_MIN_PAGE_DIMENSION}〜${CANVAS_MAX_PAGE_DIMENSION}pxで指定してください。`;
  }

  return null;
}

export function CanvasPaperSizeControls({
  pageDimensions,
  onPageDimensionsChange,
}: CanvasPaperSizeControlsProps) {
  const idPrefix = useId();
  const widthInputRef = useRef<HTMLInputElement>(null);
  const heightInputRef = useRef<HTMLInputElement>(null);
  const sizeErrorId = `${idPrefix}-size-error`;
  const pageKey = `${pageDimensions.width}-${pageDimensions.height}`;
  const [validationState, setValidationState] = useState<ValidationState>({
    pageKey,
    width: null,
    height: null,
  });
  const validationErrors =
    validationState.pageKey === pageKey
      ? validationState
      : { width: null, height: null };

  function applyPageDimensions() {
    const widthInput = widthInputRef.current?.value ?? "";
    const heightInput = heightInputRef.current?.value ?? "";
    const errors = {
      width: validateDimension(widthInput, "幅"),
      height: validateDimension(heightInput, "高さ"),
    };
    setValidationState({ pageKey, ...errors });
    if (errors.width || errors.height) return;

    onPageDimensionsChange({
      width: Number(widthInput.trim()),
      height: Number(heightInput.trim()),
    });
  }

  function handlePageDimensionsKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== "Enter") return;
    event.preventDefault();
    event.stopPropagation();
    applyPageDimensions();
  }

  const validationMessage = [validationErrors.width, validationErrors.height]
    .filter((message): message is string => Boolean(message))
    .join(" ");
  const paperFieldsDescription =
    validationErrors.width || validationErrors.height ? sizeErrorId : undefined;

  return (
    <details
      key={pageKey}
      open
      className="note-canvas-toolbar-group note-canvas-toolbar-group--paper-size note-canvas-paper-size"
      role="group"
      aria-label="Canvas 用紙サイズ"
    >
      <summary className="note-canvas-paper-size-summary">
        <span className="note-canvas-paper-size-summary-label">
          <span className="note-canvas-tool-icon" aria-hidden="true">
            <ToolbarIcon name="paper" />
          </span>
          <span>用紙設定</span>
        </span>
        <span className="note-canvas-paper-size-summary-dimensions">
          {pageDimensions.width} × {pageDimensions.height} px
        </span>
        <span className="note-canvas-paper-size-summary-chevron" aria-hidden="true" />
      </summary>
      <div className="note-canvas-paper-size-content">
        <div className="note-canvas-paper-fields">
          <label className="note-canvas-size-field">
            <span className="note-canvas-size-field-label">幅</span>
            <span className="note-canvas-size-field-control">
              <input
                type="number"
                inputMode="numeric"
                min={CANVAS_MIN_PAGE_DIMENSION}
                max={CANVAS_MAX_PAGE_DIMENSION}
                step={1}
                defaultValue={pageDimensions.width}
                ref={widthInputRef}
                aria-label="用紙の幅（px）"
                aria-invalid={Boolean(validationErrors.width)}
                aria-describedby={paperFieldsDescription}
                onKeyDown={handlePageDimensionsKeyDown}
              />
              <span className="note-canvas-size-field-unit" aria-hidden="true">
                px
              </span>
            </span>
          </label>
          <label className="note-canvas-size-field">
            <span className="note-canvas-size-field-label">高さ</span>
            <span className="note-canvas-size-field-control">
              <input
                type="number"
                inputMode="numeric"
                min={CANVAS_MIN_PAGE_DIMENSION}
                max={CANVAS_MAX_PAGE_DIMENSION}
                step={1}
                defaultValue={pageDimensions.height}
                ref={heightInputRef}
                aria-label="用紙の高さ（px）"
                aria-invalid={Boolean(validationErrors.height)}
                aria-describedby={paperFieldsDescription}
                onKeyDown={handlePageDimensionsKeyDown}
              />
              <span className="note-canvas-size-field-unit" aria-hidden="true">
                px
              </span>
            </span>
          </label>
          <button
            type="button"
            className="note-canvas-toolbar-action note-canvas-paper-apply"
            onClick={applyPageDimensions}
            aria-label="用紙サイズを適用"
            title="入力した幅と高さを用紙サイズに適用"
            data-tooltip="入力した幅と高さを用紙サイズに適用"
          >
            <span className="note-canvas-tool-icon" aria-hidden="true">
              <ToolbarIcon name="apply" />
            </span>
            <span className="note-canvas-tool-label">適用</span>
            <span className="note-canvas-toolbar-tooltip" aria-hidden="true">
              入力した幅と高さを用紙サイズに適用
            </span>
          </button>
        </div>
        {validationMessage && (
          <p id={sizeErrorId} className="note-canvas-size-error" role="alert">
            {validationMessage}
          </p>
        )}
      </div>
    </details>
  );
}
