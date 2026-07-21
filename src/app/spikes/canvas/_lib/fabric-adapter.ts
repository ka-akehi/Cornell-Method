import {
  CANVAS_PAGE,
  cloneCanvasDocument,
  getElementBounds,
  type CanvasElementType,
  type CanvasElementV1,
  type CanvasDocumentV1,
  type CanvasPageDimensions,
  type CanvasPoint,
  type CanvasTextAlign,
} from "@/shared/canvas";

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

type FabricMetadata = {
  element: CanvasElementV1;
  baseLeft: number;
  baseTop: number;
};

const DEFAULT_STROKE = "#2f5544";
const DEFAULT_STROKE_WIDTH = 3;
const DEFAULT_TEXT = "#25302e";
const DEFAULT_TEXT_FONT_SIZE = 12;
const DEFAULT_TEXT_FONT_FAMILY = "Arial, sans-serif";
const DEFAULT_STANDALONE_TEXT_ALIGN: CanvasTextAlign = "left";
const DEFAULT_SHAPE_TEXT_ALIGN: CanvasTextAlign = "center";
const SHAPE_TEXT_PADDING = 12;

export function applyFabricObjectStyle(
  object: FabricObjectLike,
  elementType: CanvasElementType,
  change: FabricStyleChange,
) {
  const styleObject = ["arrow", "rect", "ellipse"].includes(elementType)
    ? object.getObjects?.()[0] ?? object
    : object;
  const properties: Record<string, unknown> = {};
  if (change.stroke !== undefined) properties.stroke = change.stroke;
  if (change.fill !== undefined) properties.fill = change.fill;
  if (change.strokeWidth !== undefined) properties.strokeWidth = change.strokeWidth;
  if (change.fontSize !== undefined) properties.fontSize = change.fontSize;
  if (change.textAlign !== undefined) properties.textAlign = change.textAlign;
  if (Object.keys(properties).length > 0) styleObject.set(properties);

  if (elementType === "arrow" && change.stroke !== undefined) {
    object.getObjects?.()[1]?.set({ fill: change.stroke });
  }
}

function readNumber(object: FabricObjectLike, key: string, fallback: number) {
  const value = object.get(key);
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function readString(object: FabricObjectLike, key: string) {
  const value = object.get(key);
  return typeof value === "string" ? value : undefined;
}

function readTextAlign(
  object: FabricObjectLike,
  fallback: CanvasTextAlign,
): CanvasTextAlign {
  const value = readString(object, "textAlign");
  return value === "left" || value === "center" || value === "right"
    ? value
    : fallback;
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
    stroke: style.stroke ?? DEFAULT_STROKE,
    strokeWidth: style.strokeWidth ?? DEFAULT_STROKE_WIDTH,
    strokeUniform: true,
    selectable: true,
    evented: true,
    objectCaching: false,
  };
}

type CanvasShapeElementV1 = Extract<
  CanvasElementV1,
  { type: "rect" | "ellipse" }
>;

type FabricCanvasElementOwner = {
  object: FabricObjectLike;
  element: CanvasElementV1;
};

function findCanvasElementOwner(object?: FabricObjectLike) {
  const visited = new Set<FabricObjectLike>();
  let current = object;

  while (current && !visited.has(current)) {
    visited.add(current);
    const metadata = current.get("canvasElement") as FabricMetadata | undefined;
    if (metadata?.element) {
      return {
        object: current,
        element: metadata.element,
      } satisfies FabricCanvasElementOwner;
    }
    current = current.group;
  }

  return null;
}

export function resolveFabricShapeTarget(
  event: Pick<FabricEventLike, "target" | "subTargets">,
) {
  const candidates = [event.target, ...(event.subTargets ?? [])];
  for (const candidate of candidates) {
    const owner = findCanvasElementOwner(candidate);
    if (
      owner &&
      (owner.element.type === "rect" || owner.element.type === "ellipse")
    ) {
      return {
        object: owner.object,
        element: owner.element as CanvasShapeElementV1,
      };
    }
  }

  return null;
}

function shapeChildOptions(element: CanvasShapeElementV1) {
  return {
    ...shapeOptions(element),
    left: 0,
    top: 0,
    angle: 0,
    originX: "center",
    originY: "center",
    selectable: false,
    evented: false,
  };
}

function shapeTextOptions(element: CanvasShapeElementV1) {
  const textStyle = element.textStyle ?? {};
  return {
    left: 0,
    top: 0,
    width: Math.max(2, element.width - SHAPE_TEXT_PADDING * 2),
    originX: "center",
    originY: "center",
    angle: 0,
    fill: textStyle.fill ?? DEFAULT_TEXT,
    stroke: undefined,
    fontSize: textStyle.fontSize ?? DEFAULT_TEXT_FONT_SIZE,
    fontFamily: textStyle.fontFamily ?? DEFAULT_TEXT_FONT_FAMILY,
    textAlign: textStyle.textAlign ?? DEFAULT_SHAPE_TEXT_ALIGN,
    editable: false,
    selectable: false,
    evented: false,
    splitByGrapheme: true,
    objectCaching: false,
  };
}

function createShapeObject(
  fabric: FabricApiLike,
  element: CanvasShapeElementV1,
): FabricObjectLike {
  if (element.type === "rect") {
    return new fabric.Rect(shapeChildOptions(element));
  }

  return new fabric.Ellipse({
    ...shapeChildOptions(element),
    rx: element.width / 2,
    ry: element.height / 2,
    width: undefined,
    height: undefined,
  });
}

function createShapeTextGroup(
  fabric: FabricApiLike,
  element: CanvasShapeElementV1,
): FabricObjectLike {
  const shape = createShapeObject(fabric, element);
  const text = new fabric.Textbox(element.text ?? "", shapeTextOptions(element));
  const group = new fabric.Group([shape, text], {
    left: element.x,
    top: element.y,
    width: element.width,
    height: element.height,
    angle: element.rotation,
    originX: "left",
    originY: "top",
    selectable: true,
    evented: true,
    subTargetCheck: false,
    objectCaching: false,
    layoutManager: new fabric.LayoutManager(new fabric.FixedLayout()),
  });

  // FixedLayout keeps the shape box authoritative even when the text wraps.
  group.set({
    left: element.x,
    top: element.y,
    width: element.width,
    height: element.height,
    angle: element.rotation,
    scaleX: 1,
    scaleY: 1,
  });
  group.setCoords?.();
  return group;
}

export function createFabricShapeTextEditor(
  fabric: FabricApiLike,
  element: CanvasShapeElementV1,
): FabricObjectLike {
  return new fabric.Textbox(element.text ?? "", {
    ...shapeTextOptions(element),
    left: element.x + element.width / 2,
    top: element.y + element.height / 2,
    angle: element.rotation,
    editable: true,
    selectable: true,
    evented: true,
    isCanvasShapeTextEditor: true,
  });
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
  const halfStrokeWidth =
    (element.style.strokeWidth ?? DEFAULT_STROKE_WIDTH) / 2;
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
      fill: style.stroke ?? DEFAULT_STROKE,
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
  } else if (
    (element.type === "rect" || element.type === "ellipse") &&
    Boolean(element.text?.trim())
  ) {
    object = createShapeTextGroup(fabric, element);
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
      textAlign: style.textAlign ?? DEFAULT_STANDALONE_TEXT_ALIGN,
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
  if (
    object.get("isCanvasPreview") === true ||
    object.get("isCanvasShapeTextEditor") === true
  ) {
    return null;
  }
  const metadata = object.get("canvasElement") as FabricMetadata | undefined;
  if (!metadata?.element) return null;

  const base = metadata.element;
  const styleObject =
    ["arrow", "rect", "ellipse"].includes(base.type)
      ? object.getObjects?.()[0] ?? object
      : object;
  const scaleX = readNumber(object, "scaleX", 1);
  const scaleY = readNumber(object, "scaleY", 1);
  const next: CanvasElementV1 = {
    ...base,
    x: ["rect", "ellipse"].includes(base.type)
      ? readNumber(object, "left", base.x)
      : base.x,
    y: ["rect", "ellipse"].includes(base.type)
      ? readNumber(object, "top", base.y)
      : base.y,
    width: ["rect", "ellipse"].includes(base.type)
      ? base.width * Math.abs(scaleX)
      : base.width,
    height: ["rect", "ellipse"].includes(base.type)
      ? base.height * Math.abs(scaleY)
      : base.height,
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
      textAlign: readTextAlign(
        object,
        base.style.textAlign ?? DEFAULT_STANDALONE_TEXT_ALIGN,
      ),
    };
  }

  if (
    (base.type === "rect" || base.type === "ellipse") &&
    base.text !== undefined
  ) {
    const textObject = object.getObjects?.()[1];
    if (textObject) {
      next.text = readString(textObject, "text") ?? base.text;
      const baseTextStyle = base.textStyle ?? {};
      next.textStyle = {
        ...baseTextStyle,
        fill: readString(textObject, "fill") ?? baseTextStyle.fill,
        fontSize: readNumber(
          textObject,
          "fontSize",
          baseTextStyle.fontSize ?? DEFAULT_TEXT_FONT_SIZE,
        ),
        fontFamily:
          readString(textObject, "fontFamily") ?? baseTextStyle.fontFamily,
        textAlign: readTextAlign(
          textObject,
          baseTextStyle.textAlign ?? DEFAULT_SHAPE_TEXT_ALIGN,
        ),
      };
    }
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
    .map((object) => fabricObjectToElement(object, 0))
    .filter((element): element is CanvasElementV1 => element !== null)
    .map((element, index) => ({ ...element, z: index }));

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
