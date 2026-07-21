import { z } from "zod";
import { emptyStringToUndefined } from "./schema-helpers";

export const cueSchema = z.object({
  id: z.string().optional(),
  text: z
    .string()
    .trim()
    .min(1, "キューは必須です")
    .max(120, "キューは120文字以内で入力してください"),
  order: z.preprocess(
    emptyStringToUndefined,
    z.coerce
      .number()
      .int("表示順は整数で入力してください")
      .nonnegative("表示順は0以上で入力してください")
      .optional(),
  ),
});

export type CueInput = z.infer<typeof cueSchema>;
