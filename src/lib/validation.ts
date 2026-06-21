import { z } from "zod";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const SOURCE_TYPES = ["book", "lecture", "video", "article", "other"] as const;

function isValidDateString(value: string) {
  if (!DATE_PATTERN.test(value)) {
    return false;
  }

  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function todayDateString() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function emptyStringToUndefined(value: unknown) {
  return value === "" ? undefined : value;
}

function emptyStringToNull(value: unknown) {
  return value === "" || value === undefined ? null : value;
}

export const dateStringSchema = z
  .string()
  .refine(isValidDateString, "YYYY-MM-DD形式で入力してください");

export const nullableDateStringSchema = z.preprocess(
  emptyStringToNull,
  dateStringSchema.nullable(),
);

// MVP examples use Japanese tag names such as "読書", so Han characters are allowed
// in addition to the original hiragana/katakana/alphanumeric/symbol set.
export const tagNameRegex =
  /^[\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Han}A-Za-z0-9!"#$%&'()0=~|\-^¥@\[\]`{;:+*},.\/<>?_\\]+$/u;

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

export const cueSchema = z.object({
  id: z.string().optional(),
  text: z
    .string()
    .trim()
    .min(1, "キューは必須です")
    .max(120, "キューは120文字以内で入力してください"),
  order: z
    .preprocess(
      emptyStringToUndefined,
      z.coerce
        .number()
        .int("表示順は整数で入力してください")
        .nonnegative("表示順は0以上で入力してください")
        .optional(),
    ),
});

export const notebookInputSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(1, "タイトルは必須です")
      .max(120, "タイトルは120文字以内で入力してください"),
    noteDate: dateStringSchema,
    sourceType: z.preprocess(
      emptyStringToUndefined,
      z.enum(SOURCE_TYPES).optional(),
    ),
    sourceTitle: z.preprocess(
      (value) => value ?? "",
      z.string().max(120, "出典タイトルは120文字以内で入力してください"),
    ),
    overview: z.preprocess(
      (value) => value ?? "",
      z.string().max(400, "概要は400文字以内で入力してください"),
    ),
    body: z.preprocess((value) => value ?? "", z.string()),
    summary: z.preprocess((value) => value ?? "", z.string()),
    nextReviewDate: nullableDateStringSchema.optional(),
    cues: z.array(cueSchema).default([]),
    tags: z.array(tagSchema).max(12, "タグは12件以内で入力してください").default([]),
  })
  .superRefine((input, context) => {
    if (input.noteDate > todayDateString()) {
      context.addIssue({
        code: "custom",
        path: ["noteDate"],
        message: "未来日は入力できません",
      });
    }

    if (input.nextReviewDate && input.nextReviewDate < input.noteDate) {
      context.addIssue({
        code: "custom",
        path: ["nextReviewDate"],
        message: "次回復習日は記載日以降の日付を入力してください",
      });
    }

    const tagNames = new Set<string>();
    input.tags.forEach((tag, index) => {
      if (tagNames.has(tag.name)) {
        context.addIssue({
          code: "custom",
          path: ["tags", index, "name"],
          message: "タグが重複しています",
        });
      }
      tagNames.add(tag.name);
    });
  });

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
  z.coerce.number().int("pageは整数で指定してください").min(1, "pageは1以上で指定してください"),
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

export const reviewUpdateSchema = z.object({
  nextReviewDate: nullableDateStringSchema.optional(),
});

export type TagInput = z.infer<typeof tagSchema>;
export type CueInput = z.infer<typeof cueSchema>;
export type NotebookInput = z.infer<typeof notebookInputSchema>;
export type NotesQuery = z.infer<typeof notesQuerySchema>;
export type ReviewUpdateInput = z.infer<typeof reviewUpdateSchema>;

export type ApiErrorCode =
  | "invalid_body"
  | "invalid_query"
  | "not_found"
  | "server_error";

export type ApiFieldError = {
  field: string;
  message: string;
};

export type ApiErrorBody = {
  code: ApiErrorCode;
  message: string;
  errors?: ApiFieldError[];
};

export const apiErrorStatus: Record<ApiErrorCode, number> = {
  invalid_body: 400,
  invalid_query: 400,
  not_found: 404,
  server_error: 500,
};

const defaultApiErrorMessages: Record<ApiErrorCode, string> = {
  invalid_body: "入力内容に誤りがあります",
  invalid_query: "検索条件に誤りがあります",
  not_found: "対象が見つかりません",
  server_error: "予期しないエラーが発生しました",
};

export function zodErrorToFieldErrors(error: z.ZodError): ApiFieldError[] {
  return error.issues.map((issue) => ({
    field: issue.path.join("."),
    message: issue.message,
  }));
}

export function createApiError(
  code: ApiErrorCode,
  options: { message?: string; errors?: ApiFieldError[] } = {},
): ApiErrorBody {
  return {
    code,
    message: options.message ?? defaultApiErrorMessages[code],
    ...(options.errors && options.errors.length > 0 ? { errors: options.errors } : {}),
  };
}

export function createInvalidBodyError(error: z.ZodError): ApiErrorBody {
  return createApiError("invalid_body", {
    errors: zodErrorToFieldErrors(error),
  });
}

export function createInvalidQueryError(error: z.ZodError): ApiErrorBody {
  return createApiError("invalid_query", {
    errors: zodErrorToFieldErrors(error),
  });
}

export function createNotFoundError(message?: string): ApiErrorBody {
  return createApiError("not_found", { message });
}

export function createServerError(message?: string): ApiErrorBody {
  return createApiError("server_error", { message });
}
