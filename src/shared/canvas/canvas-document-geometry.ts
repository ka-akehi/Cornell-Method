import type { CanvasElementV1 } from "./canvas-document-types";

export function getElementBounds(
  element: Pick<CanvasElementV1, "x" | "y" | "width" | "height" | "points">,
) {
  if (!element.points?.length) {
    return {
      x: element.x,
      y: element.y,
      width: Math.max(1, element.width),
      height: Math.max(1, element.height),
    };
  }

  const xs = element.points.map(([x]) => x);
  const ys = element.points.map(([, y]) => y);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  const width = Math.max(1, Math.max(...xs) - x);
  const height = Math.max(1, Math.max(...ys) - y);

  return { x, y, width, height };
}
