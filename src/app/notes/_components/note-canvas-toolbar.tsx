"use client";

import { useId, useRef, useState, type KeyboardEvent } from "react";
import {
  CANVAS_MAX_PAGE_DIMENSION,
  CANVAS_MIN_PAGE_DIMENSION,
  type CanvasPageDimensions,
} from "@/shared/canvas";

export type CanvasNoteTool =
  | "select"
  | "pen"
  | "line"
  | "arrow"
  | "rect"
  | "ellipse"
  | "text"
  | "erase";

type ToolDefinition = {
  value: CanvasNoteTool;
  label: string;
  description: string;
};

type ToolGroupDefinition = {
  key: string;
  label: string;
  ariaLabel: string;
  tools: ToolDefinition[];
};

const TOOL_GROUPS: ToolGroupDefinition[] = [
  {
    key: "operation",
    label: "操作",
    ariaLabel: "Canvas 操作",
    tools: [
      {
        value: "select",
        label: "選択",
        description: "選択・移動・サイズ変更。既存オブジェクトを操作する",
      },
    ],
  },
  {
    key: "draw",
    label: "描く",
    ariaLabel: "自由線を描く",
    tools: [
      { value: "pen", label: "ペン", description: "自由線を描く。空白から開始する" },
    ],
  },
  {
    key: "line",
    label: "線",
    ariaLabel: "線を描く",
    tools: [
      {
        value: "line",
        label: "直線",
        description: "空白からドラッグして直線を描く",
      },
      {
        value: "arrow",
        label: "矢印",
        description: "空白からドラッグして矢印を描く",
      },
    ],
  },
  {
    key: "shape",
    label: "図形",
    ariaLabel: "図形を描く",
    tools: [
      {
        value: "rect",
        label: "四角",
        description: "空白からドラッグして四角形を描く",
      },
      {
        value: "ellipse",
        label: "円",
        description: "空白からドラッグして円または楕円を描く",
      },
    ],
  },
  {
    key: "text",
    label: "文字",
    ariaLabel: "文字を置く",
    tools: [
      {
        value: "text",
        label: "テキスト",
        description: "空白をクリックしてテキストを入力する",
      },
    ],
  },
  {
    key: "erase",
    label: "消去",
    ariaLabel: "オブジェクトを全体消去",
    tools: [
      {
        value: "erase",
        label: "消しゴム（全体）",
        description: "クリックまたはなぞって対象オブジェクト全体を削除する",
      },
    ],
  },
];

type NoteCanvasToolbarProps = {
  tool: CanvasNoteTool;
  onToolChange: (tool: CanvasNoteTool) => void;
  pageDimensions: CanvasPageDimensions;
  onPageDimensionsChange: (dimensions: CanvasPageDimensions) => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
};

export function NoteCanvasToolbar({
  tool,
  onToolChange,
  pageDimensions,
  onPageDimensionsChange,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
}: NoteCanvasToolbarProps) {
  const idPrefix = useId();
  const widthInputRef = useRef<HTMLInputElement>(null);
  const heightInputRef = useRef<HTMLInputElement>(null);
  const sizeErrorId = `${idPrefix}-size-error`;
  const pageKey = `${pageDimensions.width}-${pageDimensions.height}`;
  const [validationState, setValidationState] = useState<{
    pageKey: string;
    width: string | null;
    height: string | null;
  }>({ pageKey, width: null, height: null });
  const validationErrors =
    validationState.pageKey === pageKey
      ? validationState
      : { width: null, height: null };

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
  const activeTool = TOOL_GROUPS.flatMap((group) => group.tools).find(
    (item) => item.value === tool,
  );

  function renderTool(item: ToolDefinition) {
    const isActive = tool === item.value;
    const descriptionId = `${idPrefix}-${item.value}-description`;

    return (
      <button
        key={item.value}
        type="button"
        className="note-canvas-tool-button"
        data-active={isActive}
        aria-pressed={isActive}
        aria-label={item.label}
        aria-describedby={descriptionId}
        title={item.description}
        onClick={() => onToolChange(item.value)}
      >
        {item.label}
        <span id={descriptionId} className="note-canvas-toolbar-visually-hidden">
          {item.description}
        </span>
      </button>
    );
  }

  function renderToolGroup(group: ToolGroupDefinition) {
    return (
      <div
        key={group.key}
        className={`note-canvas-toolbar-group note-canvas-toolbar-group--${group.key}`}
        role="group"
        aria-label={group.ariaLabel}
      >
        <span className="note-canvas-toolbar-group-label" aria-hidden="true">
          {group.label}
        </span>
        {group.tools.map(renderTool)}
      </div>
    );
  }

  const [operationGroup, drawGroup, lineGroup, shapeGroup, textGroup, eraseGroup] = TOOL_GROUPS;

  return (
    <div
      className="note-canvas-toolbar"
      role="toolbar"
      aria-label="Canvas ツールバー"
      aria-orientation="horizontal"
    >
      {renderToolGroup(operationGroup)}

      <div className="note-canvas-toolbar-drawing-rail">
        <div className="note-canvas-toolbar-drawing-rail-inner">
          {renderToolGroup(drawGroup)}
          {renderToolGroup(lineGroup)}
          {renderToolGroup(shapeGroup)}
          {renderToolGroup(textGroup)}
        </div>
      </div>

      {renderToolGroup(eraseGroup)}

      <div
        className="note-canvas-toolbar-group note-canvas-toolbar-group--history"
        role="group"
        aria-label="Canvas 履歴"
      >
        <span className="note-canvas-toolbar-group-label" aria-hidden="true">
          履歴
        </span>
        <button
          type="button"
          className="note-canvas-toolbar-action"
          onClick={onUndo}
          disabled={!canUndo}
          aria-label="Canvas の操作を元に戻す"
          title="Canvas の直前の操作を元に戻す"
        >
          Undo
        </button>
        <button
          type="button"
          className="note-canvas-toolbar-action"
          onClick={onRedo}
          disabled={!canRedo}
          aria-label="Canvas の操作をやり直す"
          title="Canvas の取り消した操作をやり直す"
        >
          Redo
        </button>
      </div>

      <div
        key={pageKey}
        className="note-canvas-toolbar-group note-canvas-toolbar-group--paper-size note-canvas-paper-size"
        role="group"
        aria-label="Canvas 用紙サイズ"
      >
        <span
          className="note-canvas-toolbar-group-label note-canvas-paper-size-label"
          aria-hidden="true"
        >
          用紙サイズ
        </span>
        <label className="note-canvas-size-field">
          <span>幅</span>
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
            aria-describedby={validationErrors.width ? sizeErrorId : undefined}
            onKeyDown={handlePageDimensionsKeyDown}
          />
          <span aria-hidden="true">px</span>
        </label>
        <label className="note-canvas-size-field">
          <span>高さ</span>
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
            aria-describedby={validationErrors.height ? sizeErrorId : undefined}
            onKeyDown={handlePageDimensionsKeyDown}
          />
          <span aria-hidden="true">px</span>
        </label>
        <button
          type="button"
          className="note-canvas-toolbar-action"
          onClick={applyPageDimensions}
          aria-label="用紙サイズを適用"
          title="入力した幅と高さを用紙サイズに適用"
        >
          適用
        </button>
        {validationMessage && (
          <p id={sizeErrorId} className="note-canvas-size-error" role="alert">
            {validationMessage}
          </p>
        )}
      </div>

      <span className="note-canvas-toolbar-status" role="status" aria-live="polite" aria-atomic="true">
        現在のツール: {activeTool?.label ?? "選択"}
      </span>
    </div>
  );
}
