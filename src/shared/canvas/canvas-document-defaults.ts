import {
  CANVAS_PAGE,
  CANVAS_SCHEMA_VERSION,
} from "./canvas-document-types";
import type {
  CanvasDocumentV1,
  CanvasElementV1,
} from "./canvas-document-types";

const DEFAULT_STROKE = "#2f5544";
const DEFAULT_TEXT = "#25302e";

export function createElementId(prefix = "element") {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }

  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function createEmptyCanvasDocument(): CanvasDocumentV1 {
  return {
    schemaVersion: CANVAS_SCHEMA_VERSION,
    page: { ...CANVAS_PAGE },
    elements: [],
  };
}

export function createDemoCanvasDocument(): CanvasDocumentV1 {
  const elements: CanvasElementV1[] = [
    {
      id: "demo-stroke",
      type: "stroke",
      x: 92,
      y: 112,
      width: 148,
      height: 88,
      rotation: 0,
      points: [
        [92, 182],
        [108, 160],
        [121, 174],
        [138, 132],
        [158, 154],
        [180, 120],
        [204, 145],
        [240, 112],
      ],
      style: { stroke: DEFAULT_STROKE, strokeWidth: 5 },
      z: 0,
    },
    {
      id: "demo-line",
      type: "line",
      x: 315,
      y: 108,
      width: 204,
      height: 1,
      rotation: 0,
      points: [
        [315, 108],
        [519, 108],
      ],
      style: { stroke: "#c66b3d", strokeWidth: 4 },
      z: 1,
    },
    {
      id: "demo-arrow",
      type: "arrow",
      x: 570,
      y: 108,
      width: 206,
      height: 98,
      rotation: 0,
      points: [
        [570, 190],
        [655, 128],
        [776, 108],
      ],
      style: { stroke: "#98492c", strokeWidth: 4 },
      z: 2,
    },
    {
      id: "demo-rect",
      type: "rect",
      x: 94,
      y: 286,
      width: 236,
      height: 132,
      rotation: 0,
      style: {
        stroke: "#2f5544",
        fill: "#e8f0e7",
        strokeWidth: 4,
      },
      z: 3,
    },
    {
      id: "demo-ellipse",
      type: "ellipse",
      x: 404,
      y: 286,
      width: 220,
      height: 132,
      rotation: 0,
      style: {
        stroke: "#c66b3d",
        fill: "#fff2df",
        strokeWidth: 4,
      },
      z: 4,
    },
    {
      id: "demo-text",
      type: "text",
      x: 704,
      y: 300,
      width: 300,
      height: 72,
      rotation: 0,
      text: "Canvas text is searchable",
      style: {
        fill: DEFAULT_TEXT,
        fontSize: 28,
        fontFamily: "Arial, sans-serif",
      },
      z: 5,
    },
  ];

  return { schemaVersion: CANVAS_SCHEMA_VERSION, page: { ...CANVAS_PAGE }, elements };
}
