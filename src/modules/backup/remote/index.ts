import type {
  BackupEntryDto,
  CreateBackupResponseDto,
  ListBackupsResponseDto,
} from "@/modules/backup/contracts";
import { requestDesktopStateChangingApi } from "@/shared/desktop/desktop-api-bridge";
import { decodeApiErrorResponse, type ApiErrorBody } from "@/shared/http";

export class BackupRemoteError extends Error {
  readonly status: number;
  readonly body: ApiErrorBody | null;

  constructor(
    message: string,
    options: { status: number; body?: ApiErrorBody | null },
  ) {
    super(message);
    this.name = "BackupRemoteError";
    this.status = options.status;
    this.body = options.body ?? null;
  }
}

async function requestBackupJson<T>(
  init: RequestInit,
  fallbackMessage = "バックアップ処理に失敗しました。",
): Promise<T> {
  const desktopResponse = await requestDesktopStateChangingApi("/api/backups", init);
  const response = desktopResponse ?? (await fetch("/api/backups", init));

  if (!response.ok) {
    const body = await decodeApiErrorResponse(response);
    throw new BackupRemoteError(body?.message ?? fallbackMessage, {
      status: response.status,
      body,
    });
  }

  return (await response.json()) as T;
}

export async function fetchBackups(): Promise<BackupEntryDto[]> {
  const json = await requestBackupJson<ListBackupsResponseDto>({
    cache: "no-store",
  });
  return json.backups ?? [];
}

export async function createBackup(): Promise<CreateBackupResponseDto> {
  return requestBackupJson<CreateBackupResponseDto>({
    method: "POST",
  });
}
