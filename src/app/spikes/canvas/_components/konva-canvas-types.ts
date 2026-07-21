import type { CanvasDocumentV1 } from "@/shared/canvas";

export type KonvaCanvasPanelProps = {
  initialDocument: CanvasDocumentV1;
  onDocumentChange?: (document: CanvasDocumentV1) => void;
};

