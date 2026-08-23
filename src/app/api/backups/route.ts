import { NextResponse } from "next/server";
import {
  createBackupEntry,
  listBackupEntries,
} from "@/server/backup/application";
import { apiErrorResponse, createServerError } from "@/shared/http";

function backupOptions() {
  return {
    backupsDirectory: process.env.CORNELL_DESKTOP_BACKUPS_DIRECTORY,
  };
}

export async function GET() {
  try {
    return NextResponse.json({ backups: listBackupEntries(backupOptions()) });
  } catch (error) {
    const body = createServerError(
      error instanceof Error ? error.message : undefined,
    );
    return apiErrorResponse(body);
  }
}

export async function POST() {
  try {
    const backup = createBackupEntry(backupOptions());
    return NextResponse.json({ ok: true, backup });
  } catch (error) {
    const body = createServerError(
      error instanceof Error ? error.message : undefined,
    );
    return apiErrorResponse(body);
  }
}
