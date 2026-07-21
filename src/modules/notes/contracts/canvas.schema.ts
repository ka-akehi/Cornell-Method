import { z } from "zod";
import {
  validateCanvasDocument,
  type CanvasDocumentV1,
} from "@/shared/canvas";

export const canvasDocumentSchema = z.unknown().transform((value, context) => {
  try {
    return validateCanvasDocument(value);
  } catch (error) {
    context.addIssue({
      code: "custom",
      message: error instanceof Error ? error.message : "Canvas document is invalid",
    });
    return z.NEVER;
  }
});

export type CanvasDocumentInput = CanvasDocumentV1;
