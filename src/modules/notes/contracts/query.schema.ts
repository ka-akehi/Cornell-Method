import { z } from "zod";
import { dateStringSchema } from "./date.schema";
import {
  emptyStringToUndefined,
} from "./schema-helpers";

const commaSeparatedTagsSchema = z
  .preprocess((value) => {
    if (Array.isArray(value)) {
      return value.join(",");
    }
    return value ?? "";
  }, z.string())
  .transform((value) =>
    Array.from(
      new Set(
        value
          .split(",")
          .map((tag) => tag.trim())
          .filter(Boolean),
      ),
    ),
  );

const booleanQuerySchema = z
  .preprocess((value) => {
    if (value === undefined || value === null || value === "") {
      return false;
    }
    if (value === "true" || value === true) {
      return true;
    }
    if (value === "false" || value === false) {
      return false;
    }
    return value;
  }, z.boolean())
  .default(false);

const pageQuerySchema = z.preprocess(
  (value) => (value === undefined || value === null || value === "" ? 1 : value),
  z.coerce
    .number()
    .int("pageは整数で指定してください")
    .min(1, "pageは1以上で指定してください"),
);

export const notesQuerySchema = z
  .object({
    query: z.preprocess(emptyStringToUndefined, z.string().trim().optional()),
    tag: commaSeparatedTagsSchema.default([]),
    from: z.preprocess(emptyStringToUndefined, dateStringSchema.optional()),
    to: z.preprocess(emptyStringToUndefined, dateStringSchema.optional()),
    reviewDue: booleanQuerySchema,
    page: pageQuerySchema.default(1),
  })
  .superRefine((input, context) => {
    if (input.from && input.to && input.from > input.to) {
      context.addIssue({
        code: "custom",
        path: ["from"],
        message: "開始日は終了日以前の日付を入力してください",
      });
    }
  });

export type NotesQuery = z.infer<typeof notesQuerySchema>;
