import type { CanvasTextAlign } from "@/shared/canvas";
import type { CanvasNoteTool } from "@/modules/notes/lib/canvas-editor-types";

export type ToolbarIconName =
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

export type TextAlignmentOption = {
  value: CanvasTextAlign;
  label: string;
  description: string;
  icon: Extract<ToolbarIconName, `align-${string}`>;
};

export const TEXT_ALIGNMENT_OPTIONS: TextAlignmentOption[] = [
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

export type ToolDefinition = {
  value: CanvasNoteTool;
  label: string;
  ariaLabel: string;
  description: string;
  icon: ToolbarIconName;
};

export type ToolGroupDefinition = {
  key: string;
  ariaLabel: string;
  tools: ToolDefinition[];
};

const INTERNAL_TOOL_DEFINITIONS: ToolDefinition[] = [
  {
    value: "select",
    label: "選択",
    ariaLabel: "選択",
    icon: "pointer",
    description: "選択・移動・サイズ変更。既存オブジェクトを操作する",
  },
];

export const TOOL_GROUPS: ToolGroupDefinition[] = [
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
    ariaLabel: "消しゴムツール",
    tools: [
      {
        value: "erase",
        label: "消しゴム",
        ariaLabel: "消しゴムツール",
        icon: "erase",
        description: "クリックまたはなぞって、触れた要素を消去する",
      },
    ],
  },
];

export function getToolGroup(key: string) {
  const group = TOOL_GROUPS.find((candidate) => candidate.key === key);
  if (!group) throw new Error(`Unknown Canvas toolbar group: ${key}`);
  return group;
}

export function findToolDefinition(tool: CanvasNoteTool) {
  return (
    INTERNAL_TOOL_DEFINITIONS.find((item) => item.value === tool) ??
    TOOL_GROUPS.flatMap((group) => group.tools).find((item) => item.value === tool)
  );
}
