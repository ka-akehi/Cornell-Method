import { NextResponse } from "next/server";
import { listTagOptions } from "@/server/notes/application";
import { apiErrorResponse, createServerError } from "@/shared/http";

export async function GET() {
  try {
    return NextResponse.json(await listTagOptions());
  } catch (error) {
    console.error(error);
    return apiErrorResponse(createServerError());
  }
}
