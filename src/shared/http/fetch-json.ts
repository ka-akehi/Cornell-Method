import type { ApiErrorBody } from "./api-error";

export function isApiErrorBody(value: unknown): value is ApiErrorBody {
  if (!value || typeof value !== "object") {
    return false;
  }

  const body = value as Partial<ApiErrorBody>;
  return typeof body.code === "string" && typeof body.message === "string";
}

export async function decodeApiErrorResponse(
  response: Response,
): Promise<ApiErrorBody | null> {
  const json = await response.json().catch(() => null);
  return isApiErrorBody(json) ? json : null;
}
