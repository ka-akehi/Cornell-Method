import type { NotebookInput } from "@/modules/notes/contracts";
import {
  extractCanvasSearchText,
  serializeCanvasDocument,
  validateCanvasDocument,
} from "@/shared/canvas";

export type PreparedCanvasPersistence = {
  schemaVersion: number;
  documentJson: string;
  searchText: string;
};

export function prepareCanvasPersistence(
  input: NotebookInput,
): PreparedCanvasPersistence | null {
  if (input.bodyMode !== "canvas" || !input.canvas) {
    return null;
  }

  const document = validateCanvasDocument(input.canvas);

  return {
    schemaVersion: document.schemaVersion,
    documentJson: serializeCanvasDocument(document),
    searchText: extractCanvasSearchText(document),
  };
}
