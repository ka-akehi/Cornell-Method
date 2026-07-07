import { NextResponse } from "next/server";
import {
  createBackupEntry,
  listBackupEntries,
} from "@/server/backup/application";
import { apiErrorResponse, createServerError } from "@/shared/http";

export async function GET() {
  try {
    return NextResponse.json({ backups: listBackupEntries() });
  } catch (error) {
    const body = createServerError(
      error instanceof Error ? error.message : undefined,
    );
    return apiErrorResponse(body);
  }
}

export async function POST() {
  try {
    const backup = createBackupEntry();
    return NextResponse.json({ ok: true, backup });
  } catch (error) {
    const body = createServerError(
      error instanceof Error ? error.message : undefined,
    );
    return apiErrorResponse(body);
  }
}
