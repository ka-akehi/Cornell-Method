import type { CanvasElementV1 } from "@/shared/canvas/canvas-document-types";
import { getElementBounds } from "@/shared/canvas/canvas-document-geometry";
import { attachFabricMetadata } from "./fabric-metadata";
import {
  DEFAULT_STANDALONE_TEXT_ALIGN,
  DEFAULT_STANDALONE_TEXT_FONT_SIZE,
  DEFAULT_STROKE,
  DEFAULT_STROKE_WIDTH,
  DEFAULT_TEXT,
  DEFAULT_TEXT_FONT_FAMILY,
  readFabricNumber,
} from "./fabric-style";
import {
  createFabricShapeTextGroup,
  fabricShapeOptions,
} from "./fabric-shape-factory";
import type { FabricApiLike, FabricObjectLike } from "./fabric-types";

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
    ...fabricShapeOptions(element),
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
    object = new fabric.Polyline(localPointList(element), {
      ...pointElementOptions(element),
      fill: "transparent",
    });
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
    const line = new fabric.Polyline(points, {
      ...fabricShapeOptions(element),
      left: 0,
      top: 0,
      angle: 0,
      fill: "transparent",
    });
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
          readFabricNumber(object, "left", bounds.x) +
          firstPoint[0] -
          renderedLinePoints[0].x,
        top:
          readFabricNumber(object, "top", bounds.y) +
          firstPoint[1] -
          renderedLinePoints[0].y,
      });
      object.setCoords?.();
    }
  } else if (
    (element.type === "rect" || element.type === "ellipse") &&
    Boolean(element.text?.trim())
  ) {
    object = createFabricShapeTextGroup(fabric, element);
  } else if (element.type === "rect") {
    object = new fabric.Rect(fabricShapeOptions(element));
  } else if (element.type === "ellipse") {
    object = new fabric.Ellipse({
      ...fabricShapeOptions(element),
      rx: element.width / 2,
      ry: element.height / 2,
      width: undefined,
      height: undefined,
    });
  } else {
    object = new fabric.Textbox(element.text ?? "", {
      ...fabricShapeOptions(element),
      width: element.width,
      height: element.height,
      fill: style.fill ?? DEFAULT_TEXT,
      stroke: undefined,
      fontSize: style.fontSize ?? DEFAULT_STANDALONE_TEXT_FONT_SIZE,
      fontFamily: style.fontFamily ?? DEFAULT_TEXT_FONT_FAMILY,
      textAlign: style.textAlign ?? DEFAULT_STANDALONE_TEXT_ALIGN,
      editable: false,
      splitByGrapheme: true,
    });
  }

  return attachFabricMetadata(object, element, {
    left: readFabricNumber(object, "left", element.x),
    top: readFabricNumber(object, "top", element.y),
  });
}
