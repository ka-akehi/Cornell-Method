import { NextResponse } from "next/server";
import {
  createBackupEntry,
  listBackupEntries,
} from "@/server/backup/application";
import { apiErrorResponse, createBackupApiError } from "@/shared/http";

function backupApiError(error: unknown) {
  const code =
    error && typeof error === "object" && "code" in error
      ? error.code
      : undefined;

  if (code === "database_unavailable") {
    return createBackupApiError("backup_database_unavailable");
  }
  if (code === "storage_failure") {
    return createBackupApiError("backup_storage_failure");
  }
  if (code === "configuration_invalid") {
    return createBackupApiError("backup_configuration_invalid");
  }

  // Do not expose exception text, including text from unknown providers.
  return createBackupApiError("backup_unknown_failure");
}

function backupOptions() {
  return {
    backupsDirectory: process.env.CORNELL_DESKTOP_BACKUPS_DIRECTORY,
  };
}

export async function GET() {
  try {
    return NextResponse.json({ backups: listBackupEntries(backupOptions()) });
  } catch (error) {
    return apiErrorResponse(backupApiError(error));
  }
}

export async function POST() {
  try {
    const backup = createBackupEntry(backupOptions());
    return NextResponse.json({ ok: true, backup });
  } catch (error) {
    return apiErrorResponse(backupApiError(error));
  }
}
