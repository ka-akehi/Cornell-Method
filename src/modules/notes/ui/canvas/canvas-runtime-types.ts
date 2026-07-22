import type { RefObject } from "react";
import type {
  CanvasDocumentV1,
  CanvasPageDimensions,
} from "@/shared/canvas";
import type {
  FabricApiLike,
  FabricCanvasLike,
} from "@/shared/canvas/adapters/fabric";
import type {
  CanvasNoteTool,
  CanvasStyleDefaults,
} from "@/modules/notes/lib/canvas-editor-types";
import type {
  CanvasStyleChange,
  CanvasStyleControlValues,
  SelectedCanvasStyle,
} from "./canvas-editor-types";

export type RuntimeRef<T> = { current: T };

export type CanvasRuntimeOptions = {
  initialDocument: CanvasDocumentV1 | null;
  pageDimensions: CanvasPageDimensions;
  tool: CanvasNoteTool;
  styleDefaults: CanvasStyleDefaults;
  toolRef: RuntimeRef<CanvasNoteTool>;
  styleDefaultsRef: RuntimeRef<CanvasStyleDefaults>;
  selectedStyleRef: RuntimeRef<SelectedCanvasStyle | null>;
  getCurrentDocument: () => CanvasDocumentV1;
  notifyDocument: (document: CanvasDocumentV1) => void;
  commitDocument: (document: CanvasDocumentV1) => void;
  reportError: (message: string | null) => void;
  setSelectedStyle: (style: SelectedCanvasStyle | null) => void;
  setStyleDefaults: (
    updater: (current: CanvasStyleDefaults) => CanvasStyleDefaults,
  ) => void;
  setShapeTextEditingStyle: (style: CanvasStyleControlValues | null) => void;
};

export type CanvasRuntimeResult = {
  surfaceRef: RefObject<HTMLDivElement | null>;
  canvasElementRef: RefObject<HTMLCanvasElement | null>;
  canvasRef: RuntimeRef<FabricCanvasLike | null>;
  fabricRef: RuntimeRef<FabricApiLike | null>;
  applyDocumentRef: RuntimeRef<(document: CanvasDocumentV1) => void>;
  applyCanvasDimensionsRef: RuntimeRef<
    (pageDimensions?: CanvasPageDimensions) => void
  >;
  flushShapeTextEditRef: RuntimeRef<() => void>;
  cancelShapeTextEditRef: RuntimeRef<() => void>;
  ready: boolean;
  applyStyleChange: (change: CanvasStyleChange) => boolean;
  deleteActiveObject: () => void;
  discardActiveObject: () => void;
  isTextEditing: () => boolean;
};
