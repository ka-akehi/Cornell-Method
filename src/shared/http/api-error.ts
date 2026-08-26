import { z } from "zod";

export type ApiErrorCode =
  | "unauthorized"
  | "forbidden"
  | "invalid_body"
  | "invalid_query"
  | "not_found"
  | "backup_database_unavailable"
  | "backup_storage_failure"
  | "backup_configuration_invalid"
  | "backup_unknown_failure"
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
  unauthorized: 401,
  forbidden: 403,
  invalid_body: 400,
  invalid_query: 400,
  not_found: 404,
  backup_database_unavailable: 500,
  backup_storage_failure: 500,
  backup_configuration_invalid: 500,
  backup_unknown_failure: 500,
  server_error: 500,
};

const defaultApiErrorMessages: Record<ApiErrorCode, string> = {
  unauthorized: "認証が必要です",
  forbidden: "同一オリジンのリクエストのみ許可されます",
  invalid_body: "入力内容に誤りがあります",
  invalid_query: "検索条件に誤りがあります",
  not_found: "対象が見つかりません",
  backup_database_unavailable:
    "データベースを確認できません。アプリを再起動し、データが表示されるか確認してください。",
  backup_storage_failure:
    "バックアップを保存できません。空き容量とアクセス権を確認してください。",
  backup_configuration_invalid:
    "バックアップ設定が正しくありません。管理された設定を確認してください。",
  backup_unknown_failure:
    "バックアップに失敗しました。しばらく待ってから再試行してください。",
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

export type BackupApiErrorCode =
  | "backup_database_unavailable"
  | "backup_storage_failure"
  | "backup_configuration_invalid"
  | "backup_unknown_failure";

export function createBackupApiError(code: BackupApiErrorCode): ApiErrorBody {
  return createApiError(code);
}
