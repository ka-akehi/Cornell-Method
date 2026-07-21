import type { CanvasDocumentV1 } from "./canvas-document-types";
import { serializedByteLength } from "./canvas-document-size";

export function extractCanvasSearchText(document: CanvasDocumentV1) {
  return document.elements
    .filter(
      (element) =>
        element.type === "text" ||
        element.type === "rect" ||
        element.type === "ellipse",
    )
    .slice()
    .sort((a, b) => a.z - b.z)
    .map((element) => element.text?.trim() ?? "")
    .filter(Boolean)
    .join("\n");
}

export function formatDocumentBytes(serialized: string) {
  const bytes = serializedByteLength(serialized);
  return `${bytes.toLocaleString("ja-JP")} bytes`;
}
