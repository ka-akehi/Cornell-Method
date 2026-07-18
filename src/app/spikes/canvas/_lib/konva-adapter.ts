import {
  CANVAS_PAGE,
  cloneCanvasDocument,
  getElementBounds,
  type CanvasElementV1,
  type CanvasDocumentV1,
  type CanvasPoint,
} from "@/shared/canvas";

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

type KonvaMetadata = {
  element: CanvasElementV1;
  baseNodeX: number;
  baseNodeY: number;
};

function flattenPoints(points: CanvasPoint[] | undefined) {
  return (points ?? []).flatMap(([x, y]) => [x, y]);
}

function setMetadata(node: KonvaNodeLike, element: CanvasElementV1, x: number, y: number) {
  node.setAttrs({
    id: element.id,
    name: element.id,
    canvasElement: {
      element: cloneCanvasDocument({
        schemaVersion: 1,
        page: { ...CANVAS_PAGE },
        elements: [element],
      }).elements[0],
      baseNodeX: x,
      baseNodeY: y,
    } satisfies KonvaMetadata,
  });
  return node;
}

export function createKonvaNode(
  konva: KonvaApiLike,
  element: CanvasElementV1,
): KonvaNodeLike {
  const style = element.style;
  const common = {
    draggable: true,
    stroke: style.stroke ?? "#2f5544",
    strokeWidth: style.strokeWidth ?? 3,
    lineCap: "round",
    lineJoin: "round",
    hitStrokeWidth: 18,
    listening: true,
  };

  if (element.type === "stroke") {
    return setMetadata(
      new konva.Line({
        ...common,
        points: flattenPoints(element.points),
        fill: "transparent",
        tension: 0.15,
        x: 0,
        y: 0,
      }),
      element,
      0,
      0,
    );
  }

  if (element.type === "line") {
    return setMetadata(
      new konva.Line({
        ...common,
        points: flattenPoints(element.points),
        x: 0,
        y: 0,
      }),
      element,
      0,
      0,
    );
  }

  if (element.type === "arrow") {
    return setMetadata(
      new konva.Arrow({
        ...common,
        points: flattenPoints(element.points),
        pointerLength: 16,
        pointerWidth: 16,
        fill: style.stroke ?? "#98492c",
        x: 0,
        y: 0,
      }),
      element,
      0,
      0,
    );
  }

  if (element.type === "rect") {
    return setMetadata(
      new konva.Rect({
        ...common,
        x: element.x,
        y: element.y,
        width: element.width,
        height: element.height,
        fill: style.fill ?? "transparent",
        rotation: element.rotation,
      }),
      element,
      element.x,
      element.y,
    );
  }

  if (element.type === "ellipse") {
    return setMetadata(
      new konva.Ellipse({
        ...common,
        x: element.x + element.width / 2,
        y: element.y + element.height / 2,
        radiusX: element.width / 2,
        radiusY: element.height / 2,
        fill: style.fill ?? "transparent",
        rotation: element.rotation,
      }),
      element,
      element.x + element.width / 2,
      element.y + element.height / 2,
    );
  }

  return setMetadata(
    new konva.Text({
      ...common,
      x: element.x,
      y: element.y,
      width: element.width,
      height: element.height,
      text: element.text ?? "",
      fontSize: style.fontSize ?? 24,
      fontFamily: style.fontFamily ?? "Arial, sans-serif",
      fill: style.fill ?? "#25302e",
      stroke: undefined,
      padding: 2,
      wrap: "word",
      rotation: element.rotation,
    }),
    element,
    element.x,
    element.y,
  );
}

export function konvaDocumentToLayer(
  layer: KonvaLayerLike,
  konva: KonvaApiLike,
  document: CanvasDocumentV1,
  transformer?: KonvaTransformerLike,
) {
  layer.getChildren().slice().forEach((node) => {
    if ((node.getClassName?.() ?? node.className) !== "Transformer") node.destroy();
  });
  document.elements
    .slice()
    .sort((a, b) => a.z - b.z)
    .forEach((element) => layer.add(createKonvaNode(konva, element)));
  if (transformer && !layer.getChildren().includes(transformer)) layer.add(transformer);
  transformer?.nodes([]);
  layer.draw();
}

function translatePointList(
  element: CanvasElementV1,
  node: KonvaNodeLike,
): CanvasPoint[] | undefined {
  if (!element.points?.length) return undefined;
  const base = getElementBounds(element);
  const metadata = node.getAttr("canvasElement") as KonvaMetadata | undefined;
  const dx = node.x() - (metadata?.baseNodeX ?? 0);
  const dy = node.y() - (metadata?.baseNodeY ?? 0);
  const scaleX = node.scaleX();
  const scaleY = node.scaleY();

  return element.points.map(([x, y]) => [
    base.x + (x - base.x) * scaleX + dx,
    base.y + (y - base.y) * scaleY + dy,
  ]);
}

function nodeToElement(node: KonvaNodeLike, z: number): CanvasElementV1 | null {
  const metadata = node.getAttr("canvasElement") as KonvaMetadata | undefined;
  if (!metadata?.element) return null;
  const base = metadata.element;
  const scaleX = node.scaleX();
  const scaleY = node.scaleY();
  const next: CanvasElementV1 = {
    ...base,
    rotation: node.rotation(),
    style: { ...base.style },
    z,
  };

  if (base.type === "ellipse") {
    const radiusX = node.radiusX?.() ?? base.width / 2;
    const radiusY = node.radiusY?.() ?? base.height / 2;
    next.x = node.x() - radiusX * scaleX;
    next.y = node.y() - radiusY * scaleY;
    next.width = Math.max(1, radiusX * 2 * scaleX);
    next.height = Math.max(1, radiusY * 2 * scaleY);
  } else if (["stroke", "line", "arrow"].includes(base.type)) {
    next.points = translatePointList(base, node);
    const bounds = next.points ? getElementBounds({ ...next, points: next.points }) : getElementBounds(base);
    next.x = bounds.x;
    next.y = bounds.y;
    next.width = bounds.width;
    next.height = bounds.height;
  } else {
    next.x = node.x();
    next.y = node.y();
    next.width = Math.max(1, node.width() * scaleX);
    next.height = Math.max(1, node.height() * scaleY);
  }

  if (base.type === "text") {
    next.text = node.text?.() ?? base.text ?? "";
    next.style = {
      ...next.style,
      fontSize: (base.style.fontSize ?? 24) * scaleY,
    };
  }

  return next;
}

export function konvaLayerToDocument(layer: KonvaLayerLike): CanvasDocumentV1 {
  const elements = layer
    .getChildren()
    .filter((node) => (node.getClassName?.() ?? node.className) !== "Transformer")
    .map((node, index) => nodeToElement(node, index))
    .filter((element): element is CanvasElementV1 => element !== null);

  return {
    schemaVersion: 1,
    page: { ...CANVAS_PAGE },
    elements,
  };
}
