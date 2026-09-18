import { z } from "zod";
import { emptyStringToNull } from "./schema-helpers";

// MVP examples use Japanese tag names such as "読書", so Han characters are allowed
// in addition to the original hiragana/katakana/alphanumeric/symbol set.
export const tagNameRegex =
  /^[\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Han}A-Za-z0-9０-９!"#$%&'()0=~|\-^¥@\[\]`{;:+*},.\/<>?_\\]+$/u;

export const tagSchema = z.object({
  id: z.string().optional(),
  name: z
    .string()
    .trim()
    .min(1, "タグ名は必須です")
    .max(30, "タグ名は30文字以内で入力してください")
    .regex(tagNameRegex, "タグ名に使用できない文字が含まれています"),
  color: z.preprocess(emptyStringToNull, z.string().nullable()).optional(),
});

export type TagInput = z.infer<typeof tagSchema>;

export const tagDtoSchema = z.object({
  id: z.string(),
  name: z.string(),
  color: z.string().nullable(),
});

export const tagOptionsResponseSchema = z.array(tagDtoSchema);

export type TagDto = z.infer<typeof tagDtoSchema>;
export type TagOptionsResponse = z.infer<typeof tagOptionsResponseSchema>;
