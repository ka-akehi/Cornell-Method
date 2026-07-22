"use client";

import type {
  KeyboardEventHandler,
  PointerEventHandler,
  RefObject,
} from "react";
import type { CanvasPageDimensions } from "@/shared/canvas";

type NoteCanvasSurfaceProps = {
  mode: "editor" | "viewer";
  pageDimensions: CanvasPageDimensions;
  viewportRef: RefObject<HTMLDivElement | null>;
  surfaceRef: RefObject<HTMLDivElement | null>;
  canvasElementRef: RefObject<HTMLCanvasElement | null>;
  viewportAriaLabel: string;
  canvasAriaLabel: string;
  dataTool?: string;
  tabIndex?: number;
  onPointerDown?: PointerEventHandler<HTMLDivElement>;
  onKeyDown?: KeyboardEventHandler<HTMLDivElement>;
};

export function NoteCanvasSurface({
  mode,
  pageDimensions,
  viewportRef,
  surfaceRef,
  canvasElementRef,
  viewportAriaLabel,
  canvasAriaLabel,
  dataTool,
  tabIndex,
  onPointerDown,
  onKeyDown,
}: NoteCanvasSurfaceProps) {
  const dimensionStyle = {
    width: `${pageDimensions.width}px`,
    height: `${pageDimensions.height}px`,
  };
  const isViewer = mode === "viewer";

  return (
    <div
      ref={viewportRef}
      className={`note-canvas-viewport${isViewer ? " note-canvas-viewport--viewer" : ""}`}
      data-tool={dataTool}
      tabIndex={tabIndex}
      onPointerDown={onPointerDown}
      onKeyDown={onKeyDown}
      role={isViewer ? "img" : "application"}
      aria-label={viewportAriaLabel}
    >
      <div className="note-canvas-horizontal-scroll">
        <div
          ref={surfaceRef}
          className={`note-canvas-stage${isViewer ? " note-canvas-stage--viewer" : ""}`}
          style={dimensionStyle}
        >
          <canvas
            ref={canvasElementRef}
            width={pageDimensions.width}
            height={pageDimensions.height}
            style={dimensionStyle}
            aria-label={canvasAriaLabel}
          />
        </div>
      </div>
    </div>
  );
}
