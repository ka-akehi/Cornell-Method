import { z } from "zod";

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
