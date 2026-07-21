import { z } from "zod";
import { nullableDateStringSchema } from "./date.schema";

export const reviewUpdateSchema = z.object({
  nextReviewDate: nullableDateStringSchema.optional(),
});

export type ReviewUpdateInput = z.infer<typeof reviewUpdateSchema>;
