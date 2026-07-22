import { z } from "zod";
import { emptyStringToNull } from "./schema-helpers";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function isValidDateString(value: string) {
  if (!DATE_PATTERN.test(value)) {
    return false;
  }

  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export const dateStringSchema = z
  .string()
  .refine(isValidDateString, "YYYY-MM-DD形式で入力してください");

export const nullableDateStringSchema = z.preprocess(
  emptyStringToNull,
  dateStringSchema.nullable(),
);
