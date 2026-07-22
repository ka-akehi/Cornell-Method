import type { CanvasTextAlign } from "@/shared/canvas/canvas-document-types";

export type FabricEventLike = {
  e: PointerEvent;
  path?: FabricObjectLike;
  target?: FabricObjectLike;
  subTargets?: FabricObjectLike[];
};

export type FabricObjectLike = {
  get: (key: string) => unknown;
  set: (
    keyOrProperties: string | Record<string, unknown>,
    value?: unknown,
  ) => FabricObjectLike | void;
  on?: (event: string, handler: (event?: unknown) => void) => void;
  off?: (event: string, handler: (event?: unknown) => void) => void;
  getBoundingRect: () => { left: number; top: number; width: number; height: number };
  getObjects?: () => FabricObjectLike[];
  group?: FabricObjectLike;
  calcTransformMatrix?: () => number[];
  setCoords?: () => void;
  enterEditing?: () => void;
  exitEditing?: () => void;
  selectAll?: () => void;
  hiddenTextarea?: HTMLTextAreaElement | null;
};

export type FabricStyleChange = {
  stroke?: string;
  fill?: string;
  strokeWidth?: number;
  fontSize?: number;
  textAlign?: CanvasTextAlign;
};

export type FabricCanvasLike = {
  on: (event: string, handler: (event: FabricEventLike) => void) => void;
  off: (event: string, handler: (event: FabricEventLike) => void) => void;
  add: (...objects: FabricObjectLike[]) => void;
  remove: (...objects: FabricObjectLike[]) => void;
  clear: () => void;
  renderAll: () => void;
  requestRenderAll?: () => void;
  getObjects: () => FabricObjectLike[];
  getActiveObject: () => FabricObjectLike | undefined;
  setActiveObject: (object: FabricObjectLike) => void;
  discardActiveObject: () => void;
  setDimensions: (dimensions: { width: number; height: number }) => void;
  getWidth?: () => number;
  getHeight?: () => number;
  width?: number;
  height?: number;
  dispose: () => void | Promise<void>;
  upperCanvasEl: HTMLCanvasElement;
  isDrawingMode: boolean;
  selection: boolean;
  preserveObjectStacking: boolean;
  freeDrawingBrush?: FabricObjectLike & { width: number; color: string };
  backgroundColor: string;
};

export type FabricApiLike = {
  Canvas: new (
    element: HTMLCanvasElement,
    options?: Record<string, unknown>,
  ) => FabricCanvasLike;
  Line: new (points: number[], options?: Record<string, unknown>) => FabricObjectLike;
  Polyline: new (
    points: Array<{ x: number; y: number }>,
    options?: Record<string, unknown>,
  ) => FabricObjectLike;
  Rect: new (options?: Record<string, unknown>) => FabricObjectLike;
  Ellipse: new (options?: Record<string, unknown>) => FabricObjectLike;
  Textbox: new (text: string, options?: Record<string, unknown>) => FabricObjectLike;
  Triangle: new (options?: Record<string, unknown>) => FabricObjectLike;
  Group: new (
    objects: FabricObjectLike[],
    options?: Record<string, unknown>,
  ) => FabricObjectLike;
  LayoutManager: new (strategy?: unknown) => unknown;
  FixedLayout: new () => unknown;
  PencilBrush: new (canvas: FabricCanvasLike) => FabricObjectLike & {
    width: number;
    color: string;
  };
};
