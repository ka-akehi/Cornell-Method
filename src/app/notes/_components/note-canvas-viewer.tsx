"use client";

import { useEffect, useRef, useState } from "react";
import {
  cloneCanvasDocument,
  createEmptyCanvasDocument,
  type CanvasDocumentV1,
} from "@/shared/canvas";
import {
  fabricDocumentToCanvas,
  type FabricApiLike,
  type FabricCanvasLike,
} from "@/app/spikes/canvas/_lib/fabric-adapter";

type NoteCanvasViewerProps = {
  document: CanvasDocumentV1 | null;
};

const EMPTY_CANVAS_DOCUMENT = createEmptyCanvasDocument();

function errorMessage(error: unknown) {
  return error instanceof Error && error.message
    ? error.message
    : "Canvasの初期化に失敗しました。保存済みデータは変更されていません。";
}

export function NoteCanvasViewer({ document }: NoteCanvasViewerProps) {
  const documentRef = useRef<CanvasDocumentV1 | null | undefined>(undefined);
  if (documentRef.current === undefined) {
    if (!document) {
      documentRef.current = null;
    } else {
      try {
        documentRef.current = cloneCanvasDocument(document);
      } catch {
        documentRef.current = null;
      }
    }
  }

  const validDocument = documentRef.current ?? EMPTY_CANVAS_DOCUMENT;
  const pageWidth = validDocument.page.width;
  const pageHeight = validDocument.page.height;
  const viewportRef = useRef<HTMLDivElement>(null);
  const surfaceRef = useRef<HTMLDivElement>(null);
  const canvasElementRef = useRef<HTMLCanvasElement>(null);
  const canvasRef = useRef<FabricCanvasLike | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(
    !document
      ? "Canvas documentがありません。保存済みデータは変更されていません。"
      : documentRef.current === null
        ? "Canvas documentが壊れているため表示できません。保存済みデータは変更されていません。"
        : null,
  );

  useEffect(() => {
    let disposed = false;
    let canvas: FabricCanvasLike | null = null;

    async function initialize() {
      if (documentRef.current === null) return;

      try {
        const fabricModule = (await import("fabric")) as unknown as FabricApiLike;
        const element = canvasElementRef.current;
        if (!element || disposed) return;

        const nextCanvas = new fabricModule.Canvas(element, {
          preserveObjectStacking: true,
          selection: false,
          enablePointerEvents: false,
          allowTouchScrolling: true,
        });
        canvas = nextCanvas;
        canvasRef.current = nextCanvas;
        nextCanvas.backgroundColor = "#fffdf8";
        nextCanvas.selection = false;
        nextCanvas.isDrawingMode = false;
        nextCanvas.setDimensions({ width: pageWidth, height: pageHeight });
        const validated = cloneCanvasDocument(validDocument);
        fabricDocumentToCanvas(nextCanvas, fabricModule, validated);
        nextCanvas.getObjects().forEach((object) => {
          object.set({ selectable: false, evented: false });
        });
        nextCanvas.discardActiveObject();
        nextCanvas.renderAll();
        setReady(true);
        setError(null);
      } catch (caught) {
        if (!disposed) setError(errorMessage(caught));
      }
    }

    void initialize();
    return () => {
      disposed = true;
      if (canvas) void canvas.dispose();
      canvas = null;
      canvasRef.current = null;
    };
  }, [pageHeight, pageWidth, validDocument]);

  useEffect(() => {
    const surface = surfaceRef.current;
    const canvas = canvasRef.current;
    if (!surface || !canvas) return;

    canvas.setDimensions({ width: pageWidth, height: pageHeight });
    surface.style.width = `${pageWidth}px`;
    surface.style.height = `${pageHeight}px`;
    const wrapper = canvas.upperCanvasEl.parentElement;
    if (wrapper) {
      wrapper.style.width = `${pageWidth}px`;
      wrapper.style.height = `${pageHeight}px`;
      wrapper.querySelectorAll("canvas").forEach((node) => {
        node.style.width = `${pageWidth}px`;
        node.style.height = `${pageHeight}px`;
      });
    }
    canvas.requestRenderAll?.();
  }, [pageHeight, pageWidth, ready]);

  const textElements = validDocument.elements
    .filter(
      (element) =>
        (element.type === "text" ||
          element.type === "rect" ||
          element.type === "ellipse") &&
        element.text?.trim(),
    )
    .sort((a, b) => a.z - b.z);

  return (
    <div className="note-canvas-viewer" aria-label="保存済みCanvas本文">
      {error && (
        <p className="note-canvas-error" role="alert">
          {error}
        </p>
      )}

      {documentRef.current !== null && (
        <div
          ref={viewportRef}
          className="note-canvas-viewport note-canvas-viewport--viewer"
          role="img"
          aria-label={`保存済みCanvas本文。用紙サイズ ${pageWidth} x ${pageHeight} px。図形、線、ストローク、テキストを含みます。`}
        >
          <div className="note-canvas-horizontal-scroll">
            <div
              ref={surfaceRef}
              className="note-canvas-stage note-canvas-stage--viewer"
              style={{ width: `${pageWidth}px`, height: `${pageHeight}px` }}
            >
              <canvas
                ref={canvasElementRef}
                width={pageWidth}
                height={pageHeight}
                style={{ width: `${pageWidth}px`, height: `${pageHeight}px` }}
                aria-label={`保存済み${pageWidth} x ${pageHeight} Canvas`}
              />
            </div>
          </div>
        </div>
      )}

      <div className="note-canvas-assistive-text">
        {ready ? "保存済みCanvasを表示しています。" : "Canvasを準備しています。"}
        {` 用紙サイズ: ${pageWidth} x ${pageHeight} px。`}
        {textElements.length > 0 ? (
          <ul>
            {textElements.map((element) => (
              <li key={element.id}>{element.text}</li>
            ))}
          </ul>
        ) : (
          <span> テキスト要素はありません。</span>
        )}
      </div>
    </div>
  );
}
