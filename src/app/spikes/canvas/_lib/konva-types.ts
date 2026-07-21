export type KonvaNodeLike = {
  className?: string;
  id: () => string;
  getClassName?: () => string;
  getAttr: (key: string) => unknown;
  setAttr: (key: string, value: unknown) => void;
  setAttrs: (attributes: Record<string, unknown>) => void;
  x: (value?: number) => number;
  y: (value?: number) => number;
  width: (value?: number) => number;
  height: (value?: number) => number;
  scaleX: (value?: number) => number;
  scaleY: (value?: number) => number;
  rotation: (value?: number) => number;
  radiusX?: (value?: number) => number;
  radiusY?: (value?: number) => number;
  text?: (value?: string) => string;
  points?: (value?: number[]) => number[];
  draggable: (value?: boolean) => boolean;
  destroy: () => void;
  getClientRect: () => { x: number; y: number; width: number; height: number };
};

export type KonvaContainerLike = {
  getBoundingClientRect: () => DOMRect;
  style: CSSStyleDeclaration;
};

export type KonvaLayerLike = {
  add: (...nodes: KonvaNodeLike[]) => void;
  destroyChildren: () => void;
  getChildren: () => KonvaNodeLike[];
  draw: () => void;
  on: (event: string, handler: (event: KonvaEventLike) => void) => void;
};

export type KonvaStageLike = {
  container: () => KonvaContainerLike;
  width: (value?: number) => number;
  height: (value?: number) => number;
  add: (...layers: KonvaLayerLike[]) => void;
  getPointerPosition: () => { x: number; y: number } | null;
  on: (event: string, handler: (event: KonvaEventLike) => void) => void;
  off: (event: string, handler: (event: KonvaEventLike) => void) => void;
  destroy: () => void;
};

export type KonvaEventLike = {
  target: KonvaNodeLike;
  evt: PointerEvent;
};

export type KonvaApiLike = {
  Stage: new (options: Record<string, unknown>) => KonvaStageLike;
  Layer: new () => KonvaLayerLike;
  Line: new (options: Record<string, unknown>) => KonvaNodeLike;
  Arrow: new (options: Record<string, unknown>) => KonvaNodeLike;
  Rect: new (options: Record<string, unknown>) => KonvaNodeLike;
  Ellipse: new (options: Record<string, unknown>) => KonvaNodeLike;
  Text: new (options: Record<string, unknown>) => KonvaNodeLike;
  Transformer: new (options: Record<string, unknown>) => KonvaTransformerLike;
};

export type KonvaTransformerLike = KonvaNodeLike & {
  nodes: (nodes?: KonvaNodeLike[]) => KonvaNodeLike[];
};
