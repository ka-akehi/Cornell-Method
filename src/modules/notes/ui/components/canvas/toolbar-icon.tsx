import type { ToolbarIconName } from "@/modules/notes/model/canvas-toolbar-definitions";

export function ToolbarIcon({ name }: { name: ToolbarIconName }) {
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
          <path d="m4.8 14.8 8.1-8.1a2.4 2.4 0 0 1 3.4 0l3 3a2.4 2.4 0 0 1 0 3.4l-8.1 8.1H7.2a2.4 2.4 0 0 1-2.4-2.4Z" />
          <path d="m8.8 19.2 6.8-6.8" />
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
