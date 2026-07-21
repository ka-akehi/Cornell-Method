import {
  CanvasDocumentValidationError,
} from "./canvas-document-types";
import type { CanvasDocumentV1 } from "./canvas-document-types";
import { assertSerializedSize } from "./canvas-document-size";
import { validateCanvasDocument } from "./canvas-document-validation";

function invalid(message: string): never {
  throw new CanvasDocumentValidationError(message);
}

export function serializeCanvasDocument(document: CanvasDocumentV1) {
  const validated = validateCanvasDocument(document);
  const serialized = JSON.stringify(validated);
  assertSerializedSize(serialized);
  return serialized;
}

export function restoreCanvasDocument(serialized: string): CanvasDocumentV1 {
  if (typeof serialized !== "string") {
    invalid("Serialized canvas document must be a string");
  }
  assertSerializedSize(serialized);
  return validateCanvasDocument(JSON.parse(serialized) as unknown);
}

export function cloneCanvasDocument(document: CanvasDocumentV1) {
  return validateCanvasDocument(JSON.parse(serializeCanvasDocument(document)) as unknown);
}
