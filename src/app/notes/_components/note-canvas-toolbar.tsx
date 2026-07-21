"use client";

import {
  useId,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent,
  type MouseEvent,
} from "react";
import {
  CANVAS_MAX_PAGE_DIMENSION,
  CANVAS_MIN_PAGE_DIMENSION,
  type CanvasPageDimensions,
  type CanvasTextAlign,
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

export const CANVAS_MIN_STROKE_WIDTH = 1;
export const CANVAS_MAX_STROKE_WIDTH = 20;
export const CANVAS_DEFAULT_STROKE_WIDTH = 1;
export const CANVAS_MIN_FONT_SIZE = 8;
export const CANVAS_MAX_FONT_SIZE = 96;
export const CANVAS_DEFAULT_FONT_SIZE = 12;

export type CanvasStyleTarget = "stroke" | "text" | null;

export type CanvasStyleControlValues = {
  strokeWidth: number;
  color: string;
  fontSize: number;
  textAlign: CanvasTextAlign;
};

export type CanvasStyleChange = {
  strokeWidth?: number;
  color?: string;
  fontSize?: number;
  textAlign?: CanvasTextAlign;
  commit?: boolean;
};

type IntegerStyleInputKey = "strokeWidth" | "fontSize";

type IntegerStyleInputValues = Record<IntegerStyleInputKey, string>;

type ToolbarIconName =
  | "pointer"
  | "pencil"
  | "line"
  | "arrow"
  | "rect"
  | "ellipse"
  | "text"
  | "erase"
  | "undo"
  | "redo"
  | "paper"
  | "apply"
  | "align-left"
  | "align-center"
  | "align-right";

type TextAlignmentOption = {
  value: CanvasTextAlign;
  label: string;
  description: string;
  icon: Extract<ToolbarIconName, `align-${string}`>;
};

const TEXT_ALIGNMENT_OPTIONS: TextAlignmentOption[] = [
  {
    value: "left",
    label: "左寄せ",
    description: "文字を左寄せにする",
    icon: "align-left",
  },
  {
    value: "center",
    label: "中央寄せ",
    description: "文字を中央寄せにする",
    icon: "align-center",
  },
  {
    value: "right",
    label: "右寄せ",
    description: "文字を右寄せにする",
    icon: "align-right",
  },
];

type ToolDefinition = {
  value: CanvasNoteTool;
  label: string;
  ariaLabel: string;
  description: string;
  icon: ToolbarIconName;
};

type ToolGroupDefinition = {
  key: string;
  ariaLabel: string;
  tools: ToolDefinition[];
};

const TOOL_GROUPS: ToolGroupDefinition[] = [
  {
    key: "operation",
    ariaLabel: "Canvas 操作",
    tools: [
      {
        value: "select",
        label: "選択",
        ariaLabel: "選択",
        icon: "pointer",
        description: "選択・移動・サイズ変更。既存オブジェクトを操作する",
      },
    ],
  },
  {
    key: "draw",
    ariaLabel: "自由線を描く",
    tools: [
      {
        value: "pen",
        label: "ペン",
        ariaLabel: "ペン",
        icon: "pencil",
        description: "自由線を描く。空白から開始する",
      },
    ],
  },
  {
    key: "line",
    ariaLabel: "線を描く",
    tools: [
      {
        value: "line",
        label: "直線",
        ariaLabel: "直線",
        icon: "line",
        description: "空白からドラッグして直線を描く",
      },
      {
        value: "arrow",
        label: "矢印",
        ariaLabel: "矢印",
        icon: "arrow",
        description: "空白からドラッグして矢印を描く",
      },
    ],
  },
  {
    key: "shape",
    ariaLabel: "図形を描く",
    tools: [
      {
        value: "rect",
        label: "四角",
        ariaLabel: "四角",
        icon: "rect",
        description: "空白からドラッグして四角形を描く",
      },
      {
        value: "ellipse",
        label: "円",
        ariaLabel: "円",
        icon: "ellipse",
        description: "空白からドラッグして円または楕円を描く",
      },
    ],
  },
  {
    key: "text",
    ariaLabel: "文字を置く",
    tools: [
      {
        value: "text",
        label: "文字",
        ariaLabel: "文字",
        icon: "text",
        description: "空白をクリックして文字を入力する",
      },
    ],
  },
  {
    key: "erase",
    ariaLabel: "オブジェクトを全体消去",
    tools: [
      {
        value: "erase",
        label: "全体消去",
        ariaLabel: "消しゴム（全体）",
        icon: "erase",
        description: "消しゴム（全体）。クリックまたはなぞって対象オブジェクト全体を削除する",
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
  styleTarget: CanvasStyleTarget;
  styleValues: CanvasStyleControlValues;
  onStyleChange: (change: CanvasStyleChange) => void;
};

function ToolbarIcon({ name }: { name: ToolbarIconName }) {
  let iconContent;

  switch (name) {
    case "pointer":
      iconContent = (
        <path
          d="m5 3.5 13.3 11.6-5.4.8 3.1 4.8-2.2 1.3-3-4.9-2.9 4.1Z"
          fill="currentColor"
          stroke="currentColor"
          strokeLinejoin="round"
        />
      );
      break;
    case "pencil":
      iconContent = (
        <g>
          <path d="m5 19 1.3-4.2L15.8 5.3a2 2 0 0 1 2.9 2.9l-9.5 9.5Z" />
          <path d="m14.5 6.6 2.9 2.9M5 19l4.2-1.3" />
        </g>
      );
      break;
    case "line":
      iconContent = <path d="M5 19 19 5" />;
      break;
    case "arrow":
      iconContent = (
        <g>
          <path d="M5 19 19 5" />
          <path d="M11.5 5H19v7.5" />
        </g>
      );
      break;
    case "rect":
      iconContent = <rect x="5" y="5" width="14" height="14" rx="1" />;
      break;
    case "ellipse":
      iconContent = <ellipse cx="12" cy="12" rx="7.5" ry="5.8" />;
      break;
    case "text":
      iconContent = <path d="M5 5h14M12 5v14M8.5 19h7" />;
      break;
    case "align-left":
      iconContent = <path d="M5 6h14M5 10h10M5 14h14M5 18h10" />;
      break;
    case "align-center":
      iconContent = <path d="M5 6h14M7 10h10M5 14h14M7 18h10" />;
      break;
    case "align-right":
      iconContent = <path d="M5 6h14M9 10h10M5 14h14M9 18h10" />;
      break;
    case "erase":
      iconContent = (
        <g>
          <path d="m5.5 15.5 8.8-8.8a2.1 2.1 0 0 1 3 3l-8.8 8.8H5.5Z" />
          <path d="m12.5 9.5 3.1 3.1M4.5 19.5h15" />
        </g>
      );
      break;
    case "undo":
      iconContent = (
        <g>
          <path d="M9 8H4.5l3.2-3.2" />
          <path d="M4.5 8A8 8 0 1 1 7 18" />
        </g>
      );
      break;
    case "redo":
      iconContent = (
        <g>
          <path d="M15 8h4.5l-3.2-3.2" />
          <path d="M19.5 8A8 8 0 1 0 17 18" />
        </g>
      );
      break;
    case "paper":
      iconContent = (
        <g>
          <rect x="5" y="4" width="14" height="16" rx="1.5" />
          <path d="M8 8h8M8 12h8M8 16h5" />
        </g>
      );
      break;
    case "apply":
      iconContent = <path d="m5 12.5 4.5 4.5L19 7.5" />;
      break;
  }

  return (
    <svg
      className="note-canvas-toolbar-icon"
      viewBox="0 0 24 24"
      width="18"
      height="18"
      aria-hidden="true"
      focusable="false"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {iconContent}
    </svg>
  );
}

function preventCanvasTextEditingBlur(event: MouseEvent<HTMLButtonElement>) {
  // Keep Fabric's hidden textarea (and the shape inline editor) active until
  // the alignment change has been handled by the click event.
  event.preventDefault();
}

export function NoteCanvasToolbar({
  tool,
  onToolChange,
  pageDimensions,
  onPageDimensionsChange,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  styleTarget,
  styleValues,
  onStyleChange,
}: NoteCanvasToolbarProps) {
  const idPrefix = useId();
  const widthInputRef = useRef<HTMLInputElement>(null);
  const heightInputRef = useRef<HTMLInputElement>(null);
  const sizeErrorId = `${idPrefix}-size-error`;
  const paperHelperId = `${idPrefix}-paper-helper`;
  const undoDescriptionId = `${idPrefix}-undo-description`;
  const redoDescriptionId = `${idPrefix}-redo-description`;
  const pageKey = `${pageDimensions.width}-${pageDimensions.height}`;
  const [validationState, setValidationState] = useState<{
    pageKey: string;
    width: string | null;
    height: string | null;
  }>({ pageKey, width: null, height: null });
  const [styleInputValues, setStyleInputValues] = useState<IntegerStyleInputValues>(() => ({
    strokeWidth: String(styleValues.strokeWidth),
    fontSize: String(styleValues.fontSize),
  }));
  const [activeStyleInput, setActiveStyleInput] = useState<IntegerStyleInputKey | null>(null);
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

  function parseIntegerStyleValue(rawValue: string, min: number, max: number) {
    const value = rawValue.trim();
    if (!/^\d+$/.test(value)) return null;

    const parsed = Number(value);
    return Number.isSafeInteger(parsed) && parsed >= min && parsed <= max ? parsed : null;
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

  const validationMessage = [validationErrors.width, validationErrors.height]
    .filter((message): message is string => Boolean(message))
    .join(" ");
  const activeTool = TOOL_GROUPS.flatMap((group) => group.tools).find(
    (item) => item.value === tool,
  );
  const strokeWidthInputValue =
    activeStyleInput === "strokeWidth"
      ? styleInputValues.strokeWidth
      : String(styleValues.strokeWidth);
  const fontSizeInputValue =
    activeStyleInput === "fontSize" ? styleInputValues.fontSize : String(styleValues.fontSize);

  function renderTool(item: ToolDefinition, showTooltip = true) {
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
  }

  function renderToolGroup(
    group: ToolGroupDefinition,
    options?: { showTooltip?: boolean },
  ) {
    const showTooltip = options?.showTooltip ?? true;

    return (
      <div
        key={group.key}
        className={`note-canvas-toolbar-group note-canvas-toolbar-group--${group.key}`}
        role="group"
        aria-label={group.ariaLabel}
      >
        {group.tools.map((item) => renderTool(item, showTooltip))}
      </div>
    );
  }

  function renderTextAlignmentControls() {
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
              <span className="note-canvas-toolbar-visually-hidden">
                {option.label}
              </span>
            </button>
          );
        })}
      </div>
    );
  }

  const [operationGroup, drawGroup, lineGroup, shapeGroup, textGroup, eraseGroup] = TOOL_GROUPS;
  const paperFieldsDescription = [
    paperHelperId,
    validationErrors.width || validationErrors.height ? sizeErrorId : null,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      className="note-canvas-toolbar"
      role="toolbar"
      aria-label="Canvas ツールバー"
      aria-orientation="horizontal"
    >
      {renderToolGroup(operationGroup)}

      <div
        className="note-canvas-toolbar-drawing-rail"
        role="group"
        aria-label="Canvas 描画ツール"
      >
        <div className="note-canvas-toolbar-drawing-rail-inner">
          {renderToolGroup(drawGroup, { showTooltip: false })}
          {renderToolGroup(lineGroup, { showTooltip: false })}
          {renderToolGroup(shapeGroup, { showTooltip: false })}
          {renderToolGroup(textGroup, { showTooltip: false })}
        </div>
      </div>

      <div
        className="note-canvas-toolbar-group note-canvas-toolbar-group--style"
        role="group"
        aria-label="Canvas スタイル"
      >
        <label
          className="note-canvas-style-field"
          data-disabled={styleTarget !== "stroke"}
        >
          <span>線幅</span>
          <span className="note-canvas-style-field-control">
            <input
              type="number"
              inputMode="numeric"
              min={CANVAS_MIN_STROKE_WIDTH}
              max={CANVAS_MAX_STROKE_WIDTH}
              step={1}
              value={strokeWidthInputValue}
              disabled={styleTarget !== "stroke"}
              aria-label="線幅（px）"
              aria-invalid={
                parseIntegerStyleValue(
                  strokeWidthInputValue,
                  CANVAS_MIN_STROKE_WIDTH,
                  CANVAS_MAX_STROKE_WIDTH,
                ) === null
              }
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
            <span aria-hidden="true">px</span>
          </span>
        </label>
        <label
          className="note-canvas-style-field"
          data-disabled={styleTarget === null}
        >
          <span>色</span>
          <input
            className="note-canvas-style-color"
            type="color"
            value={styleValues.color}
            disabled={styleTarget === null}
            aria-label={styleTarget === "text" ? "文字色" : "線の色"}
            onChange={(event) => onStyleChange({ color: event.target.value })}
          />
        </label>
        <label
          className="note-canvas-style-field"
          data-disabled={styleTarget !== "text"}
        >
          <span>文字サイズ</span>
          <span className="note-canvas-style-field-control">
            <input
              type="number"
              inputMode="numeric"
              min={CANVAS_MIN_FONT_SIZE}
              max={CANVAS_MAX_FONT_SIZE}
              step={1}
              value={fontSizeInputValue}
              disabled={styleTarget !== "text"}
              aria-label="フォントサイズ（px）"
              aria-invalid={
                parseIntegerStyleValue(
                  fontSizeInputValue,
                  CANVAS_MIN_FONT_SIZE,
                  CANVAS_MAX_FONT_SIZE,
                ) === null
              }
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
            <span aria-hidden="true">px</span>
          </span>
        </label>
        {renderTextAlignmentControls()}
      </div>

      {renderToolGroup(eraseGroup)}

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
          <span
            className="note-canvas-paper-size-summary-chevron"
            aria-hidden="true"
          />
        </summary>
        <div className="note-canvas-paper-size-content">
          <p id={paperHelperId} className="note-canvas-paper-size-helper">
            用紙設定: 幅と高さは用紙そのものの寸法です。表示倍率ではありません。
          </p>
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

      <span
        className="note-canvas-toolbar-status"
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        現在のツール: {activeTool?.label ?? "選択"}
      </span>
    </div>
  );
}
