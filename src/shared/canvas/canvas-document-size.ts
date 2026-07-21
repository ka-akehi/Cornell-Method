import {
  CANVAS_MAX_SERIALIZED_BYTES,
  CanvasDocumentValidationError,
} from "./canvas-document-types";

export function serializedByteLength(serialized: string) {
  if (typeof TextEncoder !== "undefined") {
    return new TextEncoder().encode(serialized).byteLength;
  }

  return encodeURIComponent(serialized).replace(/%[0-9A-F]{2}|./g, "x").length;
}

export function assertSerializedSize(serialized: string): void {
  const bytes = serializedByteLength(serialized);
  if (bytes > CANVAS_MAX_SERIALIZED_BYTES) {
    throw new CanvasDocumentValidationError(
      `Canvas document must be at most ${CANVAS_MAX_SERIALIZED_BYTES} bytes`,
    );
  }
}
