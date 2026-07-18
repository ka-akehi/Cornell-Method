import {
  CANVAS_PAGE,
  cloneCanvasDocument,
  getElementBounds,
  type CanvasElementV1,
  type CanvasDocumentV1,
  type CanvasPageDimensions,
  type CanvasPoint,
} from "@/shared/canvas";

export type FabricEventLike = {
  e: PointerEvent;
  target?: FabricObjectLike;
};

export type FabricObjectLike = {
  get: (key: string) => unknown;
  set: (
    keyOrProperties: string | Record<string, unknown>,
    value?: unknown,
  ) => FabricObjectLike | void;
  getBoundingRect: () => { left: number; top: number; width: number; height: number };
  getObjects?: () => FabricObjectLike[];
  calcTransformMatrix?: () => number[];
  setCoords?: () => void;
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
  PencilBrush: new (canvas: FabricCanvasLike) => FabricObjectLike & {
    width: number;
    color: string;
  };
};

type FabricMetadata = {
  element: CanvasElementV1;
  baseLeft: number;
  baseTop: number;
};

function readNumber(object: FabricObjectLike, key: string, fallback: number) {
  const value = object.get(key);
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function readString(object: FabricObjectLike, key: string) {
  const value = object.get(key);
  return typeof value === "string" ? value : undefined;
}

function setMetadata(
  object: FabricObjectLike,
  element: CanvasElementV1,
  position = { left: element.x, top: element.y },
) {
  object.set({
    id: element.id,
    canvasElement: {
      element: cloneCanvasDocument({
        schemaVersion: 1,
        page: { ...CANVAS_PAGE },
        elements: [element],
      }).elements[0],
      baseLeft: position.left,
      baseTop: position.top,
    } satisfies FabricMetadata,
  });
  return object;
}

function shapeOptions(element: CanvasElementV1): Record<string, unknown> {
  const style = element.style;
  return {
    left: element.x,
    top: element.y,
    width: element.width,
    height: element.height,
    angle: element.rotation,
    originX: "left",
    originY: "top",
    fill: style.fill ?? "transparent",
    stroke: style.stroke ?? "#2f5544",
    strokeWidth: style.strokeWidth ?? 3,
    strokeUniform: true,
    selectable: true,
    evented: true,
    objectCaching: false,
  };
}

function localPointList(element: CanvasElementV1) {
  const bounds = getElementBounds(element);
  return (element.points ?? []).map(([x, y]) => ({
    x: x - bounds.x,
    y: y - bounds.y,
  }));
}

function pointElementOptions(element: CanvasElementV1) {
  const bounds = getElementBounds(element);
  const halfStrokeWidth = (element.style.strokeWidth ?? 3) / 2;
  return {
    ...shapeOptions(element),
    left: bounds.x - halfStrokeWidth,
    top: bounds.y - halfStrokeWidth,
  };
}

function readPoint(value: unknown) {
  if (!value || typeof value !== "object") return undefined;
  const point = value as { x?: unknown; y?: unknown };
  return typeof point.x === "number" &&
    Number.isFinite(point.x) &&
    typeof point.y === "number" &&
    Number.isFinite(point.y)
    ? { x: point.x, y: point.y }
    : undefined;
}

function transformedPolylinePoints(object: FabricObjectLike) {
  const points = object.get("points");
  const pathOffset = readPoint(object.get("pathOffset"));
  const matrix = object.calcTransformMatrix?.();
  if (!Array.isArray(points) || !pathOffset || !matrix || matrix.length < 6) {
    return undefined;
  }

  const pointList = points
    .map(readPoint)
    .filter((point): point is { x: number; y: number } => point !== undefined);
  return pointList.map(({ x, y }) => ({
    x: matrix[0] * (x - pathOffset.x) + matrix[2] * (y - pathOffset.y) + matrix[4],
    y: matrix[1] * (x - pathOffset.x) + matrix[3] * (y - pathOffset.y) + matrix[5],
  }));
}

export function createFabricObject(
  fabric: FabricApiLike,
  element: CanvasElementV1,
): FabricObjectLike {
  const style = element.style;
  let object: FabricObjectLike;

  if (element.type === "stroke") {
    object = new fabric.Polyline(
      localPointList(element),
      {
        ...pointElementOptions(element),
        fill: "transparent",
      },
    );
  } else if (element.type === "line") {
    const points = localPointList(element);
    object = new fabric.Line(
      [
        points[0]?.x ?? 0,
        points[0]?.y ?? 0,
        points.at(-1)?.x ?? element.width,
        points.at(-1)?.y ?? element.height,
      ],
      {
        ...pointElementOptions(element),
        fill: undefined,
      },
    );
  } else if (element.type === "arrow") {
    const bounds = getElementBounds(element);
    const points = element.points?.length
      ? localPointList(element)
      : [
          { x: 0, y: 0 },
          { x: element.width, y: element.height },
        ];
    const line = new fabric.Polyline(
      points,
      {
        ...shapeOptions(element),
        left: 0,
        top: 0,
        angle: 0,
        fill: "transparent",
      },
    );
    const end = points.at(-1) ?? { x: element.width, y: element.height };
    const previous = points.at(-2) ?? points[0] ?? { x: 0, y: 0 };
    const angle =
      (Math.atan2(end.y - previous.y, end.x - previous.x) * 180) / Math.PI + 90;
    const head = new fabric.Triangle({
      width: 18,
      height: 18,
      left: end.x,
      top: end.y,
      originX: "center",
      originY: "center",
      angle,
      fill: style.stroke ?? "#98492c",
      selectable: false,
      evented: false,
    });
    object = new fabric.Group([line, head], {
      left: bounds.x,
      top: bounds.y,
      angle: element.rotation,
      originX: "left",
      originY: "top",
      subTargetCheck: false,
      objectCaching: false,
    });

    const renderedLinePoints = transformedPolylinePoints(line);
    const firstPoint = element.points?.[0];
    if (renderedLinePoints?.[0] && firstPoint) {
      object.set({
        left:
          readNumber(object, "left", bounds.x) + firstPoint[0] - renderedLinePoints[0].x,
        top:
          readNumber(object, "top", bounds.y) + firstPoint[1] - renderedLinePoints[0].y,
      });
      object.setCoords?.();
    }
  } else if (element.type === "rect") {
    object = new fabric.Rect(shapeOptions(element));
  } else if (element.type === "ellipse") {
    object = new fabric.Ellipse({
      ...shapeOptions(element),
      rx: element.width / 2,
      ry: element.height / 2,
      width: undefined,
      height: undefined,
    });
  } else {
    object = new fabric.Textbox(element.text ?? "", {
      ...shapeOptions(element),
      width: element.width,
      height: element.height,
      fill: style.fill ?? "#25302e",
      stroke: undefined,
      fontSize: style.fontSize ?? 24,
      fontFamily: style.fontFamily ?? "Arial, sans-serif",
      editable: false,
      splitByGrapheme: true,
    });
  }

  return setMetadata(object, element, {
    left: readNumber(object, "left", element.x),
    top: readNumber(object, "top", element.y),
  });
}

export function fabricDocumentToCanvas(
  canvas: FabricCanvasLike,
  fabric: FabricApiLike,
  document: CanvasDocumentV1,
) {
  canvas.clear();
  canvas.backgroundColor = "#fffdf8";
  canvas.setDimensions({ width: document.page.width, height: document.page.height });

  document.elements
    .slice()
    .sort((a, b) => a.z - b.z)
    .forEach((element) => canvas.add(createFabricObject(fabric, element)));

  canvas.discardActiveObject();
  canvas.renderAll();
}

function translatePointList(
  element: CanvasElementV1,
  object: FabricObjectLike,
): CanvasPoint[] | undefined {
  if (!element.points?.length) return undefined;
  const base = getElementBounds(element);
  const metadata = object.get("canvasElement") as FabricMetadata | undefined;
  const left = readNumber(object, "left", metadata?.baseLeft ?? base.x);
  const top = readNumber(object, "top", metadata?.baseTop ?? base.y);
  const scaleX = readNumber(object, "scaleX", 1);
  const scaleY = readNumber(object, "scaleY", 1);
  const deltaX = left - (metadata?.baseLeft ?? base.x);
  const deltaY = top - (metadata?.baseTop ?? base.y);
  return element.points.map(([x, y]) => [
    base.x + (x - base.x) * scaleX + deltaX,
    base.y + (y - base.y) * scaleY + deltaY,
  ]);
}

function fabricObjectToElement(
  object: FabricObjectLike,
  z: number,
): CanvasElementV1 | null {
  if (object.get("isCanvasPreview") === true) return null;
  const metadata = object.get("canvasElement") as FabricMetadata | undefined;
  if (!metadata?.element) return null;

  const base = metadata.element;
  const styleObject =
    base.type === "arrow" ? object.getObjects?.()[0] ?? object : object;
  const next: CanvasElementV1 = {
    ...base,
    x: base.x,
    y: base.y,
    width: base.width,
    height: base.height,
    rotation: readNumber(object, "angle", base.rotation),
    style: {
      ...base.style,
      stroke: readString(styleObject, "stroke") ?? base.style.stroke,
      fill: readString(styleObject, "fill") ?? base.style.fill,
      strokeWidth: readNumber(
        styleObject,
        "strokeWidth",
        base.style.strokeWidth ?? 3,
      ),
    },
    z,
  };

  if (base.type === "text") {
    next.text = readString(object, "text") ?? base.text ?? "";
    next.style = {
      ...next.style,
      fill: readString(object, "fill") ?? base.style.fill,
      fontSize: readNumber(object, "fontSize", base.style.fontSize ?? 24),
      fontFamily: readString(object, "fontFamily") ?? base.style.fontFamily,
    };
  }

  if (["stroke", "line", "arrow"].includes(base.type)) {
    next.points = translatePointList(base, object);
    if (next.points) {
      const bounds = getElementBounds({ ...next, points: next.points });
      next.x = bounds.x;
      next.y = bounds.y;
      next.width = bounds.width;
      next.height = bounds.height;
    }
  }

  return next;
}

function readCanvasDimension(
  canvas: FabricCanvasLike,
  dimension: keyof CanvasPageDimensions,
) {
  const getterValue =
    dimension === "width" ? canvas.getWidth?.() : canvas.getHeight?.();
  if (typeof getterValue === "number" && Number.isFinite(getterValue)) {
    return getterValue;
  }

  const propertyValue = canvas[dimension];
  return typeof propertyValue === "number" && Number.isFinite(propertyValue)
    ? propertyValue
    : undefined;
}

function getCanvasPageDimensions(canvas: FabricCanvasLike): CanvasPageDimensions {
  return {
    width: readCanvasDimension(canvas, "width") ?? CANVAS_PAGE.width,
    height: readCanvasDimension(canvas, "height") ?? CANVAS_PAGE.height,
  };
}

export function fabricCanvasToDocument(
  canvas: FabricCanvasLike,
  pageDimensions: CanvasPageDimensions = getCanvasPageDimensions(canvas),
): CanvasDocumentV1 {
  const elements = canvas
    .getObjects()
    .map((object, index) => fabricObjectToElement(object, index))
    .filter((element): element is CanvasElementV1 => element !== null);

  return {
    schemaVersion: 1,
    page: {
      width: pageDimensions.width,
      height: pageDimensions.height,
      background: "paper",
    },
    elements,
  };
}
