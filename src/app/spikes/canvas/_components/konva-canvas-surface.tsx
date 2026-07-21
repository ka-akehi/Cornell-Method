"use client";

import type { KeyboardEventHandler, RefObject } from "react";

type KonvaCanvasSurfaceProps = {
  viewportRef: RefObject<HTMLDivElement | null>;
  surfaceRef: RefObject<HTMLDivElement | null>;
  containerRef: RefObject<HTMLDivElement | null>;
  onKeyDown: KeyboardEventHandler<HTMLDivElement>;
};

export function KonvaCanvasSurface({
  viewportRef,
  surfaceRef,
  containerRef,
  onKeyDown,
}: KonvaCanvasSurfaceProps) {
  return (
    <div
      ref={viewportRef}
      className="canvas-spike-viewport"
      tabIndex={0}
      onPointerDown={() => viewportRef.current?.focus()}
      onKeyDown={onKeyDown}
      aria-label="Konva 固定ページキャンバス。Canvas にフォーカスして Ctrl または Cmd のショートカットを使用できます。"
    >
      <div ref={surfaceRef} className="canvas-spike-stage">
        <div ref={containerRef} className="canvas-spike-konva-container" />
      </div>
    </div>
  );
}

