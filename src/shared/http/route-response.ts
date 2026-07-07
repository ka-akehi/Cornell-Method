import { NextResponse } from "next/server";
import { apiErrorStatus, type ApiErrorBody } from "./api-error";

export function apiErrorResponse(
  body: ApiErrorBody,
  status = apiErrorStatus[body.code],
) {
  return NextResponse.json(body, { status });
}
