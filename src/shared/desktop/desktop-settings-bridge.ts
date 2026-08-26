"use client";

import { invoke } from "@tauri-apps/api/core";

export const DESKTOP_SETTINGS_REQUEST_EVENT = "cornell:desktop-settings-request";
export const DESKTOP_MANUAL_UPDATE_CHECK_REQUEST_FRAGMENT =
  "cornell-desktop-manual-update-check";
export const DESKTOP_MANUAL_UPDATE_CHECK_RESULT_EVENT =
  "cornell:desktop-manual-update-check-result";
export const DESKTOP_UPDATE_STATE_REQUEST_FRAGMENT =
  "cornell-desktop-read-update-state";
export const DESKTOP_UPDATE_STATE_RESULT_EVENT =
  "cornell:desktop-read-update-state-result";
export const DESKTOP_VERIFY_PENDING_UPDATE_REQUEST_FRAGMENT =
  "cornell-desktop-verify-pending-update";
export const DESKTOP_VERIFY_PENDING_UPDATE_RESULT_EVENT =
  "cornell:desktop-verify-pending-update-result";

const MANUAL_UPDATE_CHECK_COMMAND = "manual_update_check";
const READ_UPDATE_STATE_COMMAND = "read_update_state";
const VERIFY_PENDING_UPDATE_COMMAND = "verify_pending_update";
const UPDATE_STATE_SNAPSHOT_VERSION = 1;
const MANUAL_UPDATE_CHECK_TIMEOUT_MS = 30_000;
const VERIFY_PENDING_UPDATE_TIMEOUT_MS = 30_000;
const DESKTOP_DATA_BACKUP_PROTOCOL_VERSION = 1;
const DATA_BACKUP_SAVE_DESTINATION_COMMAND =
  "choose_data_backup_save_destination_command";
const DATA_BACKUP_EXTERNAL_SOURCE_COMMAND =
  "choose_data_backup_external_source_command";
const DATA_BACKUP_OPERATION_COMMAND = "run_desktop_data_backup_operation";
const MANAGED_BACKUP_CATALOG_COMMAND = "read_desktop_managed_backup_catalog";
const DESKTOP_MANAGED_BACKUP_CATALOG_PROTOCOL_VERSION = 1;
const DATABASE_RECOVERY_SNAPSHOT_COMMAND =
  "read_desktop_database_recovery_snapshot";
const DESKTOP_DATABASE_RECOVERY_SCHEMA_VERSION = 1;
const PENDING_RESTORE_STATUS_COMMAND = "read_desktop_pending_restore_status";
const PENDING_RESTORE_RESUME_COMMAND = "resume_desktop_pending_restore";
const DESKTOP_PENDING_RESTORE_PROTOCOL_VERSION = 1;
const DIAGNOSTIC_EXPORT_PROTOCOL_VERSION = 1;
const DIAGNOSTIC_DESTINATION_COMMAND =
  "choose_diagnostic_export_destination_command";
const DIAGNOSTIC_EXPORT_COMMAND = "export_desktop_diagnostics";
const MIN_DYNAMIC_PORT = 1;
const MAX_DYNAMIC_PORT = 65_535;
const NOTES_PATH = "/notes";
const NEW_NOTE_PATH = "/notes/new";
const BACKUP_PATH = "/backup";

type DesktopUpdateStatus =
  | "not-checked"
  | "checking"
  | "no-update"
  | "available"
  | "failed";

type DesktopVerificationState = "not-verified" | "verified" | "failed";

type DesktopPendingUpdateSnapshot = {
  version: string;
  channel: string;
  architecture: string;
  artifact: string;
  verificationState: DesktopVerificationState;
  discoveredAt: number;
};

type DesktopFailureSnapshot = {
  code: string;
  retryAt: number;
};

export type DesktopUpdateStateSnapshot = {
  snapshotVersion: 1;
  status: DesktopUpdateStatus;
  lastCheckAt: number | null;
  checkStartedAt: number | null;
  pendingUpdate: DesktopPendingUpdateSnapshot | null;
  failure: DesktopFailureSnapshot | null;
};

type DesktopManualUpdateCheckOutcome =
  | "no-update"
  | "available"
  | "failed"
  | "suppressed"
  | "already-checking";

type DesktopManualUpdateCheckResponse = {
  outcome: DesktopManualUpdateCheckOutcome;
  state: DesktopUpdateStateSnapshot;
};

type DesktopManualUpdateCheckCommandErrorCode =
  | "update-target-app-version-invalid"
  | "update-target-macos-command-failed"
  | "update-target-macos-output-invalid"
  | "provider-internal"
  | "update-command-worker-failed"
  | "command-unavailable";

export type DesktopManualUpdateCheckResult =
  | {
      kind: DesktopManualUpdateCheckOutcome;
      response: DesktopManualUpdateCheckResponse;
    }
  | { kind: "unsupported-web" }
  | {
      kind: "command-error";
      code: DesktopManualUpdateCheckCommandErrorCode;
    }
  | { kind: "state-error"; code: "update-state" };

export type DesktopUpdateStateReadResult =
  | { kind: "snapshot"; snapshot: DesktopUpdateStateSnapshot }
  | { kind: "unsupported-web" }
  | { kind: "state-error"; code: "update-state" };

type DesktopVerifyPendingUpdateOutcome =
  | "verified"
  | "no-pending-update"
  | "no-update"
  | "update-candidate-changed"
  | "failed"
  | "busy";

type DesktopVerifyPendingUpdateResponse = {
  outcome: DesktopVerifyPendingUpdateOutcome;
  state: DesktopUpdateStateSnapshot;
};

type DesktopVerifyPendingUpdateCommandErrorCode =
  | "update-revalidation"
  | "update-download"
  | "update-signature-key"
  | "update-state"
  | "staging-path"
  | "staging-read"
  | "staging-write"
  | "staging-rename"
  | "update-target-app-version-invalid"
  | "update-target-macos-command-failed"
  | "update-target-macos-output-invalid"
  | "update-command-worker-failed";

export type DesktopVerifyPendingUpdateResult =
  | {
      kind: DesktopVerifyPendingUpdateOutcome;
      response: DesktopVerifyPendingUpdateResponse;
    }
  | { kind: "unsupported-web" }
  | {
      kind: "command-error";
      code: DesktopVerifyPendingUpdateCommandErrorCode | "command-unavailable";
    }
  | { kind: "state-error"; code: "update-state" | "command-unavailable" };

export type DesktopDataBackupDialog =
  | "save-destination"
  | "open-external-source";

export type DesktopDataBackupFileSelection = {
  kind: "external-file";
  selectionId: string;
  fileName: string;
};

export type DesktopDataBackupDialogErrorCode =
  | "command-worker-failed"
  | "command-unavailable"
  | "dialog-unavailable"
  | "dialog-error"
  | "dialog-invalid-response"
  | "dialog-response-too-large"
  | "unsupported-platform"
  | "storage-unavailable"
  | "selection-store-failed"
  | "invalid-path"
  | "relative-path"
  | "unsafe-path"
  | "managed-path"
  | "symlink-path"
  | "path-unavailable"
  | "path-not-file"
  | "path-not-found"
  | "destination-exists";

export type DesktopDataBackupDialogResponse = {
  kind: "desktop-file-dialog";
  schemaVersion: 1;
  dialog: DesktopDataBackupDialog;
  ok: boolean;
  status: "selected" | "cancelled" | "error";
  phase: "dialog";
  selection: DesktopDataBackupFileSelection | null;
  errorCode: DesktopDataBackupDialogErrorCode | null;
};

export type DesktopDataBackupDialogResult =
  | DesktopDataBackupDialogResponse
  | { kind: "unsupported-web" };

export type DesktopDataBackupLocation =
  | { kind: "managed-backup"; backupId: string }
  | { kind: "external-selection"; selectionId: string };

export type DesktopDataBackupOperationRequest = {
  schemaVersion: 1;
  operation: "export" | "restore" | "delete";
  source: DesktopDataBackupLocation | null;
  destination: DesktopDataBackupLocation | null;
  /** Restore and complete deletion are only allowed after the Settings confirmation boundary. */
  confirmed?: boolean;
};

export type DesktopDataBackupOperationErrorCode =
  | "command-worker-failed"
  | "command-unavailable"
  | "storage-unavailable"
  | "selection-store-failed"
  | "invalid-request"
  | "unsupported-protocol-version"
  | "managed-source-invalid"
  | "invalid-selection"
  | "selection-not-found"
  | "selection-kind-mismatch"
  | "confirmation-required"
  | "invalid-path"
  | "relative-path"
  | "unsafe-path"
  | "managed-path"
  | "symlink-path"
  | "path-unavailable"
  | "path-not-file"
  | "path-not-found"
  | "runtime-unavailable"
  | "sidecar-unavailable"
  | "protocol-error"
  | "malformed-json"
  | "operation-not-implemented"
  | "destination-exists"
  | "layout-invalid"
  | "permission-failed"
  | "unsafe-name"
  | "unexpected-directory"
  | "special-file"
  | "preflight-failed"
  | "staging-conflict"
  | "partial-delete"
  | "cleanup-required"
  | "delete-failed"
  | "source-invalid"
  | "destination-unavailable"
  | "staging-failed"
  | "quiesce-failed"
  | "invalid-live-database"
  | "source-changed"
  | "backup-failed"
  | "integrity-check-failed"
  | "foreign-key-check-failed"
  | "schema-read-back-failed"
  | "schema-mismatch"
  | "newer-schema-pending-required"
  | "required-data-invalid"
  | "markdown-invalid"
  | "canvas-invalid"
  | "search-text-mismatch"
  | "read-back-failed"
  | "migration-failed"
  | "switch-failed"
  | "reopen-failed"
  | "rollback-failed"
  | "publish-race"
  | "publish-failed"
  | "cleanup-failed"
  | "restore-failed";

export type DesktopDataBackupExportResult = {
  fileName: string;
  size: number;
};

export type DesktopDataBackupOperationResponse = {
  kind: "desktop-data-backup-operation";
  schemaVersion: 1;
  ok: boolean;
  status: "success" | "cancelled" | "error";
  operation: "export" | "restore" | "delete" | null;
  phase: "request" | "validation" | "operation" | "complete";
  errorCode: DesktopDataBackupOperationErrorCode | null;
  result: DesktopDataBackupExportResult | null;
};

export type DesktopDataBackupOperationResult =
  | DesktopDataBackupOperationResponse
  | { kind: "unsupported-web" };

export type DesktopDiagnosticSelection = {
  kind: "diagnostic-export";
  selectionId: string;
  fileName: string;
};

export type DesktopDiagnosticDialogStatus = "selected" | "cancelled" | "error";

export type DesktopDiagnosticErrorCode =
  | "command-worker-failed"
  | "command-unavailable"
  | "storage-unavailable"
  | "selection-store-failed"
  | "dialog-unavailable"
  | "dialog-response-too-large"
  | "dialog-invalid-response"
  | "dialog-error"
  | "unsupported-platform"
  | "relative-path"
  | "invalid-path"
  | "managed-path"
  | "unsafe-path"
  | "symlink-path"
  | "path-unavailable"
  | "path-not-file"
  | "path-not-found"
  | "invalid-selection"
  | "selection-not-found"
  | "selection-kind-mismatch"
  | "invalid-request"
  | "unsupported-protocol-version"
  | "destination-exists"
  | "diagnostics-unavailable"
  | "log-lock-failed"
  | "temporary-artifact-exists"
  | "serialization-failed"
  | "archive-too-large"
  | "archive-write-failed"
  | "publish-failed"
  | "cleanup-failed"
  | "unsafe-log-entry"
  | "unsafe-log-directory"
  | "log-directory-unavailable"
  | "log-read-failed"
  | "log-invalid"
  | "log-file-too-large"
  | "log-prune-failed"
  | "internal-error";

export type DesktopDiagnosticDialogResponse = {
  kind: "desktop-diagnostic-dialog";
  schemaVersion: 1;
  dialog: "diagnostic-export";
  operation: "select-destination";
  status: DesktopDiagnosticDialogStatus;
  phase: "dialog";
  ok: boolean;
  selection: DesktopDiagnosticSelection | null;
  errorCode: DesktopDiagnosticErrorCode | null;
};

export type DesktopDiagnosticDialogResult =
  | DesktopDiagnosticDialogResponse
  | { kind: "unsupported-web" };

export type DesktopDiagnosticsExportRequest = {
  schemaVersion: 1;
  operation: "export";
  selectionId: string;
};

export type DesktopDiagnosticExportStatus = "success" | "error";
export type DesktopDiagnosticExportPhase =
  | "request"
  | "validation"
  | "archive"
  | "publish";

export type DesktopDiagnosticExportResult = {
  fileName: string;
  size: number;
};

export type DesktopDiagnosticExportResponse = {
  kind: "desktop-diagnostic-export";
  schemaVersion: 1;
  dialog: "diagnostic-export";
  operation: "export";
  status: DesktopDiagnosticExportStatus;
  phase: DesktopDiagnosticExportPhase;
  ok: boolean;
  selection: DesktopDiagnosticSelection | null;
  errorCode: DesktopDiagnosticErrorCode | null;
  result: DesktopDiagnosticExportResult | null;
};

export type DesktopDiagnosticExportResultResponse =
  | DesktopDiagnosticExportResponse
  | { kind: "unsupported-web" };

export type DesktopDatabaseRecoverySnapshotState =
  | "first-run"
  | "restore-available"
  | "diagnostic-required"
  | "restore-unavailable";

export type DesktopDatabaseRecoveryReasonCode =
  | "database-missing"
  | "database-missing-after-initialization"
  | "database-not-a-file"
  | "database-read-failed"
  | "database-integrity-failed"
  | "database-foreign-key-failed"
  | "database-schema-invalid"
  | "database-migration-required"
  | "database-initialization-failed"
  | "database-initialization-marker-invalid"
  | "storage-unavailable";

export type DesktopDatabaseRecoverySnapshot = {
  schemaVersion: 1;
  state: DesktopDatabaseRecoverySnapshotState;
  reasonCode: DesktopDatabaseRecoveryReasonCode;
  managedBackupAvailable: boolean;
  pendingRestoreAvailable: boolean;
  canStartEmpty: boolean;
};

export type DesktopDatabaseRecoverySnapshotResponse = {
  kind: "desktop-database-recovery-snapshot";
  schemaVersion: 1;
  status: "ready" | "recovery";
  snapshot: DesktopDatabaseRecoverySnapshot | null;
};

export type DesktopDatabaseRecoverySnapshotResult =
  | DesktopDatabaseRecoverySnapshotResponse
  | { kind: "unsupported-web" };

export type DesktopManagedBackupCatalogEntry = {
  backupId: string;
  fileName: string;
  size: number;
  createdAt: string;
};

export type DesktopManagedBackupCatalogErrorCode =
  | "command-worker-failed"
  | "command-unavailable"
  | "storage-unavailable"
  | "runtime-unavailable"
  | "sidecar-unavailable"
  | "protocol-error"
  | "invalid-catalog";

export type DesktopManagedBackupCatalogResponse = {
  kind: "desktop-managed-backup-catalog";
  schemaVersion: 1;
  status: "ready" | "empty" | "error";
  phase: "catalog";
  errorCode: DesktopManagedBackupCatalogErrorCode | null;
  backups: DesktopManagedBackupCatalogEntry[];
};

export type DesktopManagedBackupCatalogResult =
  | DesktopManagedBackupCatalogResponse
  | { kind: "unsupported-web" };

export type DesktopPendingRestoreStatusSummary = {
  pendingId: string;
  manifestToken: string;
  sourceKind: "managed-backup" | "external-file";
  createdAt: string;
  candidateDigest: string;
  candidateSize: number;
  candidateSchemaIdentity: string;
};

export type DesktopPendingRestoreStatusErrorCode =
  | "command-worker-failed"
  | "command-unavailable"
  | "storage-unavailable"
  | "runtime-unavailable"
  | "sidecar-unavailable"
  | "protocol-error"
  | "pending-unavailable"
  | "pending-invalid"
  | "pending-multiple"
  | "pending-extra-entry"
  | "pending-manifest-mismatch"
  | "pending-cleanup-required";

export type DesktopPendingRestoreStatusResponse = {
  kind: "desktop-pending-restore-status";
  schemaVersion: 1;
  status: "none" | "available" | "invalid";
  phase: "status";
  operationId: null;
  errorCode: DesktopPendingRestoreStatusErrorCode | null;
  pending: DesktopPendingRestoreStatusSummary | null;
};

export type DesktopPendingRestoreStatusResult =
  | DesktopPendingRestoreStatusResponse
  | { kind: "unsupported-web" };

export type DesktopPendingRestoreResumeRequest = {
  schemaVersion: 1;
  pendingId: string;
  manifestToken: string;
  confirmed: true;
};

export type DesktopPendingRestoreResumeErrorCode =
  | "command-worker-failed"
  | "command-unavailable"
  | "storage-unavailable"
  | "runtime-unavailable"
  | "sidecar-unavailable"
  | "protocol-error"
  | "invalid-request"
  | "unsupported-protocol-version"
  | "confirmation-required"
  | "pending-not-found"
  | "pending-invalid"
  | "pending-id-mismatch"
  | "pending-manifest-mismatch"
  | "pending-race"
  | "pending-conflict"
  | "pending-publish-failed"
  | "pending-publish-race"
  | "pending-cleanup-required"
  | "pending-unavailable"
  | "source-invalid"
  | "invalid-path"
  | "relative-path"
  | "unsafe-path"
  | "managed-path"
  | "symlink-path"
  | "path-unavailable"
  | "path-not-file"
  | "path-not-found"
  | "source-changed"
  | "staging-failed"
  | "invalid-live-database"
  | "backup-failed"
  | "integrity-check-failed"
  | "foreign-key-check-failed"
  | "schema-read-back-failed"
  | "schema-mismatch"
  | "newer-schema-pending-required"
  | "required-data-invalid"
  | "markdown-invalid"
  | "canvas-invalid"
  | "search-text-mismatch"
  | "read-back-failed"
  | "migration-failed"
  | "switch-failed"
  | "reopen-failed"
  | "rollback-failed"
  | "quiesce-failed"
  | "publish-race"
  | "publish-failed"
  | "cleanup-failed"
  | "restore-failed";

export type DesktopPendingRestoreResumeResult = {
  kind: "desktop-pending-restore-resume";
  schemaVersion: 1;
  ok: boolean;
  status: "success" | "error";
  phase: "request" | "validation" | "operation" | "complete";
  operationId: string | null;
  pendingId: string | null;
  errorCode: DesktopPendingRestoreResumeErrorCode | null;
  result: { safetyBackupId: string | null; size: number } | null;
};

export type DesktopPendingRestoreResumeResponse =
  | DesktopPendingRestoreResumeResult
  | { kind: "unsupported-web" };

type TauriWindow = Window & {
  __TAURI_INTERNALS__?: unknown;
};

let manualUpdateCheckInFlight: Promise<DesktopManualUpdateCheckResult> | null =
  null;
let updateStateReadInFlight: Promise<DesktopUpdateStateReadResult> | null = null;
let verifyPendingUpdateInFlight: Promise<DesktopVerifyPendingUpdateResult> | null =
  null;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasOnlyKeys(value: Record<string, unknown>, keys: string[]) {
  return Object.keys(value).every((key) => keys.includes(key));
}

function hasExactKeys(value: Record<string, unknown>, keys: string[]) {
  return hasOnlyKeys(value, keys) && Object.keys(value).length === keys.length;
}

function isTimestamp(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isSafeInteger(value) &&
    value >= 0
  );
}

function isNullableTimestamp(value: unknown): value is number | null {
  return value === null || isTimestamp(value);
}

function isOpaqueIdentifier(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= 256 &&
    !/[\u0000-\u001f\u007f]/.test(value)
  );
}

function isSafeStateIdentifier(value: unknown): value is string {
  return (
    isOpaqueIdentifier(value) &&
    !value.includes("/") &&
    !value.includes("\\") &&
    !value.includes("://")
  );
}

function isDataBackupSelectionId(value: unknown): value is string {
  return typeof value === "string" && /^[a-z0-9]{64}$/.test(value);
}

function isDataBackupId(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= 128 &&
    value !== "." &&
    value !== ".." &&
    /^[A-Za-z0-9._-]+$/.test(value)
  );
}

function isManagedBackupCatalogTimestamp(value: unknown): value is string {
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)
  ) {
    return false;
  }

  const parsed = new Date(value);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString() === value;
}

function isManagedBackupCatalogEntry(
  value: unknown,
): value is DesktopManagedBackupCatalogEntry {
  return (
    isRecord(value) &&
    hasExactKeys(value, ["backupId", "fileName", "size", "createdAt"]) &&
    isDataBackupId(value.backupId) &&
    typeof value.fileName === "string" &&
    value.fileName === value.backupId &&
    value.fileName.length <= 255 &&
    !/[\\/\u0000-\u001f\u007f]/.test(value.fileName) &&
    typeof value.size === "number" &&
    Number.isSafeInteger(value.size) &&
    value.size >= 0 &&
    isManagedBackupCatalogTimestamp(value.createdAt)
  );
}

function isManagedBackupCatalogErrorCode(
  value: unknown,
): value is DesktopManagedBackupCatalogErrorCode {
  return (
    typeof value === "string" &&
    [
      "command-worker-failed",
      "command-unavailable",
      "storage-unavailable",
      "runtime-unavailable",
      "sidecar-unavailable",
      "protocol-error",
      "invalid-catalog",
    ].includes(value)
  );
}

function isDatabaseRecoverySnapshot(
  value: unknown,
): value is DesktopDatabaseRecoverySnapshot {
  return (
    isRecord(value) &&
    hasExactKeys(value, [
      "schemaVersion",
      "state",
      "reasonCode",
      "managedBackupAvailable",
      "pendingRestoreAvailable",
      "canStartEmpty",
    ]) &&
    value.schemaVersion === DESKTOP_DATABASE_RECOVERY_SCHEMA_VERSION &&
    [
      "first-run",
      "restore-available",
      "diagnostic-required",
      "restore-unavailable",
    ].includes(value.state as string) &&
    [
      "database-missing",
      "database-missing-after-initialization",
      "database-not-a-file",
      "database-read-failed",
      "database-integrity-failed",
      "database-foreign-key-failed",
      "database-schema-invalid",
      "database-migration-required",
      "database-initialization-failed",
      "database-initialization-marker-invalid",
      "storage-unavailable",
    ].includes(value.reasonCode as string) &&
    typeof value.managedBackupAvailable === "boolean" &&
    typeof value.pendingRestoreAvailable === "boolean" &&
    typeof value.canStartEmpty === "boolean" &&
    (value.state === "first-run"
      ? value.canStartEmpty === true
      : value.canStartEmpty === false) &&
    (value.state !== "restore-available" ||
      value.managedBackupAvailable ||
      value.pendingRestoreAvailable) &&
    (value.state !== "restore-unavailable" ||
      (!value.managedBackupAvailable && !value.pendingRestoreAvailable))
  );
}

function isDataBackupLocation(value: unknown): value is DesktopDataBackupLocation {
  if (!isRecord(value) || typeof value.kind !== "string") {
    return false;
  }
  if (value.kind === "managed-backup") {
    return (
      hasExactKeys(value, ["kind", "backupId"]) &&
      isDataBackupId(value.backupId)
    );
  }
  return (
    value.kind === "external-selection" &&
    hasExactKeys(value, ["kind", "selectionId"]) &&
    isDataBackupSelectionId(value.selectionId)
  );
}

function isDataBackupOperationRequest(
  value: unknown,
): value is DesktopDataBackupOperationRequest {
  if (
    !isRecord(value) ||
    !hasOnlyKeys(value, [
      "schemaVersion",
      "operation",
      "source",
      "destination",
      "confirmed",
    ]) ||
    !["schemaVersion", "operation", "source", "destination"].every((key) =>
      Object.hasOwn(value, key),
    ) ||
    value.schemaVersion !== DESKTOP_DATA_BACKUP_PROTOCOL_VERSION ||
    !["export", "restore", "delete"].includes(value.operation as string) ||
    !(value.source === null || isDataBackupLocation(value.source)) ||
    !(value.destination === null || isDataBackupLocation(value.destination)) ||
    (value.confirmed !== undefined && typeof value.confirmed !== "boolean")
  ) {
    return false;
  }

  if (value.operation === "export") {
    return (
      value.source === null &&
      isRecord(value.destination) &&
      value.destination.kind === "external-selection"
    );
  }
  if (value.operation === "restore") {
    return value.source !== null && value.destination === null;
  }
  return (
    value.source === null &&
    value.destination === null &&
    value.confirmed === true
  );
}

function isPendingRestoreToken(value: unknown): value is string {
  return typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
}

function isPendingRestoreResumeRequest(
  value: unknown,
): value is DesktopPendingRestoreResumeRequest {
  return (
    isRecord(value) &&
    hasExactKeys(value, [
      "schemaVersion",
      "pendingId",
      "manifestToken",
      "confirmed",
    ]) &&
    value.schemaVersion === DESKTOP_PENDING_RESTORE_PROTOCOL_VERSION &&
    isPendingRestoreToken(value.pendingId) &&
    isPendingRestoreToken(value.manifestToken) &&
    value.confirmed === true
  );
}

function isPendingRestoreStatusErrorCode(
  value: unknown,
): value is DesktopPendingRestoreStatusErrorCode {
  return (
    typeof value === "string" &&
    [
      "command-worker-failed",
      "command-unavailable",
      "storage-unavailable",
      "runtime-unavailable",
      "sidecar-unavailable",
      "protocol-error",
      "pending-unavailable",
      "pending-invalid",
      "pending-multiple",
      "pending-extra-entry",
      "pending-manifest-mismatch",
      "pending-cleanup-required",
    ].includes(value)
  );
}

function isPendingRestoreResumeErrorCode(
  value: unknown,
): value is DesktopPendingRestoreResumeErrorCode {
  return (
    typeof value === "string" &&
    [
      "command-worker-failed",
      "command-unavailable",
      "storage-unavailable",
      "runtime-unavailable",
      "sidecar-unavailable",
      "protocol-error",
      "invalid-request",
      "unsupported-protocol-version",
      "confirmation-required",
      "pending-not-found",
      "pending-invalid",
      "pending-id-mismatch",
      "pending-manifest-mismatch",
      "pending-race",
      "pending-conflict",
      "pending-publish-failed",
      "pending-publish-race",
      "pending-cleanup-required",
      "pending-unavailable",
      "source-invalid",
      "invalid-path",
      "relative-path",
      "unsafe-path",
      "managed-path",
      "symlink-path",
      "path-unavailable",
      "path-not-file",
      "path-not-found",
      "source-changed",
      "staging-failed",
      "invalid-live-database",
      "backup-failed",
      "integrity-check-failed",
      "foreign-key-check-failed",
      "schema-read-back-failed",
      "schema-mismatch",
      "newer-schema-pending-required",
      "required-data-invalid",
      "markdown-invalid",
      "canvas-invalid",
      "search-text-mismatch",
      "read-back-failed",
      "migration-failed",
      "switch-failed",
      "reopen-failed",
      "rollback-failed",
      "quiesce-failed",
      "publish-race",
      "publish-failed",
      "cleanup-failed",
      "restore-failed",
    ].includes(value)
  );
}

function isDesktopDataBackupDialogErrorCode(
  value: unknown,
): value is DesktopDataBackupDialogErrorCode {
  return (
    typeof value === "string" &&
    [
      "command-worker-failed",
      "command-unavailable",
      "dialog-unavailable",
      "dialog-error",
      "dialog-invalid-response",
      "dialog-response-too-large",
      "unsupported-platform",
      "storage-unavailable",
      "selection-store-failed",
      "invalid-path",
      "relative-path",
      "unsafe-path",
      "managed-path",
      "symlink-path",
      "path-unavailable",
      "path-not-file",
      "path-not-found",
      "destination-exists",
    ].includes(value)
  );
}

function isDesktopDataBackupOperationErrorCode(
  value: unknown,
): value is DesktopDataBackupOperationErrorCode {
  return (
    typeof value === "string" &&
    [
      "command-worker-failed",
      "command-unavailable",
      "storage-unavailable",
      "selection-store-failed",
      "invalid-request",
      "unsupported-protocol-version",
      "managed-source-invalid",
      "invalid-selection",
      "selection-not-found",
      "selection-kind-mismatch",
      "confirmation-required",
      "invalid-path",
      "relative-path",
      "unsafe-path",
      "managed-path",
      "symlink-path",
      "path-unavailable",
      "path-not-file",
      "path-not-found",
      "runtime-unavailable",
      "sidecar-unavailable",
      "protocol-error",
      "malformed-json",
      "operation-not-implemented",
      "destination-exists",
      "layout-invalid",
      "permission-failed",
      "unsafe-name",
      "unexpected-directory",
      "special-file",
      "preflight-failed",
      "staging-conflict",
      "partial-delete",
      "cleanup-required",
      "delete-failed",
      "source-invalid",
      "destination-unavailable",
      "staging-failed",
      "quiesce-failed",
      "invalid-live-database",
      "source-changed",
      "backup-failed",
      "integrity-check-failed",
      "foreign-key-check-failed",
      "schema-read-back-failed",
      "schema-mismatch",
      "newer-schema-pending-required",
      "required-data-invalid",
      "markdown-invalid",
      "canvas-invalid",
      "search-text-mismatch",
      "read-back-failed",
      "migration-failed",
      "switch-failed",
      "reopen-failed",
      "rollback-failed",
      "publish-race",
      "publish-failed",
      "cleanup-failed",
      "restore-failed",
    ].includes(value)
  );
}

function isDiagnosticSelectionId(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= 128 &&
    /^[A-Za-z0-9._-]+$/.test(value)
  );
}

function isDiagnosticBasename(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= 255 &&
    value !== "." &&
    value !== ".." &&
    !/[\\/\u0000-\u001f\u007f]/.test(value)
  );
}

function isDiagnosticSelection(
  value: unknown,
): value is DesktopDiagnosticSelection {
  return (
    isRecord(value) &&
    hasExactKeys(value, ["kind", "selectionId", "fileName"]) &&
    value.kind === "diagnostic-export" &&
    isDiagnosticSelectionId(value.selectionId) &&
    isDiagnosticBasename(value.fileName)
  );
}

function isDiagnosticErrorCode(
  value: unknown,
): value is DesktopDiagnosticErrorCode {
  return (
    typeof value === "string" &&
    [
      "command-worker-failed",
      "command-unavailable",
      "storage-unavailable",
      "selection-store-failed",
      "dialog-unavailable",
      "dialog-response-too-large",
      "dialog-invalid-response",
      "dialog-error",
      "unsupported-platform",
      "relative-path",
      "invalid-path",
      "managed-path",
      "unsafe-path",
      "symlink-path",
      "path-unavailable",
      "path-not-file",
      "path-not-found",
      "invalid-selection",
      "selection-not-found",
      "selection-kind-mismatch",
      "invalid-request",
      "unsupported-protocol-version",
      "destination-exists",
      "diagnostics-unavailable",
      "log-lock-failed",
      "temporary-artifact-exists",
      "serialization-failed",
      "archive-too-large",
      "archive-write-failed",
      "publish-failed",
      "cleanup-failed",
      "unsafe-log-entry",
      "unsafe-log-directory",
      "log-directory-unavailable",
      "log-read-failed",
      "log-invalid",
      "log-file-too-large",
      "log-prune-failed",
      "internal-error",
    ].includes(value)
  );
}

function isDiagnosticExportRequest(
  value: unknown,
): value is DesktopDiagnosticsExportRequest {
  return (
    isRecord(value) &&
    hasExactKeys(value, ["schemaVersion", "operation", "selectionId"]) &&
    value.schemaVersion === DIAGNOSTIC_EXPORT_PROTOCOL_VERSION &&
    value.operation === "export" &&
    isDiagnosticSelectionId(value.selectionId)
  );
}

function unavailableDiagnosticDialog(
  errorCode: DesktopDiagnosticErrorCode = "command-unavailable",
): DesktopDiagnosticDialogResponse {
  return {
    kind: "desktop-diagnostic-dialog",
    schemaVersion: DIAGNOSTIC_EXPORT_PROTOCOL_VERSION,
    dialog: "diagnostic-export",
    operation: "select-destination",
    status: "error",
    phase: "dialog",
    ok: false,
    selection: null,
    errorCode,
  };
}

function unavailableDiagnosticExport(
  errorCode: DesktopDiagnosticErrorCode = "command-unavailable",
): DesktopDiagnosticExportResponse {
  return {
    kind: "desktop-diagnostic-export",
    schemaVersion: DIAGNOSTIC_EXPORT_PROTOCOL_VERSION,
    dialog: "diagnostic-export",
    operation: "export",
    status: "error",
    phase: "request",
    ok: false,
    selection: null,
    errorCode,
    result: null,
  };
}

function normalizeDiagnosticDialogResponse(
  value: unknown,
): DesktopDiagnosticDialogResponse {
  if (
    !isRecord(value) ||
    !hasExactKeys(value, [
      "kind",
      "schemaVersion",
      "dialog",
      "operation",
      "status",
      "phase",
      "ok",
      "selection",
      "errorCode",
    ]) ||
    value.kind !== "desktop-diagnostic-dialog" ||
    value.schemaVersion !== DIAGNOSTIC_EXPORT_PROTOCOL_VERSION ||
    value.dialog !== "diagnostic-export" ||
    value.operation !== "select-destination" ||
    value.phase !== "dialog" ||
    !["selected", "cancelled", "error"].includes(value.status as string) ||
    typeof value.ok !== "boolean" ||
    !(value.selection === null || isDiagnosticSelection(value.selection)) ||
    !(value.errorCode === null || isDiagnosticErrorCode(value.errorCode))
  ) {
    return unavailableDiagnosticDialog();
  }

  const status = value.status as DesktopDiagnosticDialogStatus;
  if (
    (status === "selected" &&
      (!value.ok || value.selection === null || value.errorCode !== null)) ||
    (status === "cancelled" &&
      (value.ok || value.selection !== null || value.errorCode !== null)) ||
    (status === "error" &&
      (value.ok || value.selection !== null || value.errorCode === null))
  ) {
    return unavailableDiagnosticDialog();
  }

  return {
    kind: "desktop-diagnostic-dialog",
    schemaVersion: DIAGNOSTIC_EXPORT_PROTOCOL_VERSION,
    dialog: "diagnostic-export",
    operation: "select-destination",
    status,
    phase: "dialog",
    ok: status === "selected",
    selection:
      status === "selected"
        ? (value.selection as DesktopDiagnosticSelection)
        : null,
    errorCode:
      status === "error"
        ? (value.errorCode as DesktopDiagnosticErrorCode)
        : null,
  };
}

function normalizeDiagnosticExportResponse(
  value: unknown,
  expectedSelectionId: string,
): DesktopDiagnosticExportResponse {
  if (
    !isRecord(value) ||
    !hasExactKeys(value, [
      "kind",
      "schemaVersion",
      "dialog",
      "operation",
      "status",
      "phase",
      "ok",
      "selection",
      "errorCode",
      "result",
    ]) ||
    value.kind !== "desktop-diagnostic-export" ||
    value.schemaVersion !== DIAGNOSTIC_EXPORT_PROTOCOL_VERSION ||
    value.dialog !== "diagnostic-export" ||
    value.operation !== "export" ||
    !["success", "error"].includes(value.status as string) ||
    !["request", "validation", "archive", "publish"].includes(
      value.phase as string,
    ) ||
    typeof value.ok !== "boolean" ||
    !(value.selection === null || isDiagnosticSelection(value.selection)) ||
    !(value.errorCode === null || isDiagnosticErrorCode(value.errorCode)) ||
    !(value.result === null || isRecord(value.result))
  ) {
    return unavailableDiagnosticExport();
  }

  if (value.selection !== null) {
    if (value.selection.selectionId !== expectedSelectionId) {
      return unavailableDiagnosticExport();
    }
  }

  if (value.result !== null) {
    if (
      !hasExactKeys(value.result, ["fileName", "size"]) ||
      !isDiagnosticBasename(value.result.fileName) ||
      typeof value.result.size !== "number" ||
      !Number.isSafeInteger(value.result.size) ||
      value.result.size < 1
    ) {
      return unavailableDiagnosticExport();
    }
  }

  const status = value.status as DesktopDiagnosticExportStatus;
  const phase = value.phase as DesktopDiagnosticExportPhase;
  if (
    (status === "success" &&
      (!value.ok ||
        phase !== "publish" ||
        value.selection === null ||
        value.errorCode !== null ||
        value.result === null)) ||
    (status === "error" &&
      (value.ok || value.errorCode === null || value.result !== null))
  ) {
    return unavailableDiagnosticExport();
  }

  return {
    kind: "desktop-diagnostic-export",
    schemaVersion: DIAGNOSTIC_EXPORT_PROTOCOL_VERSION,
    dialog: "diagnostic-export",
    operation: "export",
    status,
    phase,
    ok: status === "success",
    selection:
      status === "success"
        ? (value.selection as DesktopDiagnosticSelection)
        : null,
    errorCode:
      status === "error"
        ? (value.errorCode as DesktopDiagnosticErrorCode)
        : null,
    result:
      status === "success"
        ? (value.result as DesktopDiagnosticExportResult)
        : null,
  };
}

function unavailableDialogResult(
  dialog: DesktopDataBackupDialog,
  errorCode: DesktopDataBackupDialogErrorCode = "command-unavailable",
): DesktopDataBackupDialogResponse {
  return {
    kind: "desktop-file-dialog",
    schemaVersion: 1,
    dialog,
    ok: false,
    status: "error",
    phase: "dialog",
    selection: null,
    errorCode,
  };
}

function unavailableOperationResult(
  operation: DesktopDataBackupOperationRequest["operation"] | null = null,
  errorCode: DesktopDataBackupOperationErrorCode = "command-unavailable",
): DesktopDataBackupOperationResponse {
  return {
    kind: "desktop-data-backup-operation",
    schemaVersion: 1,
    ok: false,
    status: "error",
    operation,
    phase: "request",
    errorCode,
    result: null,
  };
}

function unavailableManagedBackupCatalog(
  errorCode: DesktopManagedBackupCatalogErrorCode = "command-unavailable",
): DesktopManagedBackupCatalogResponse {
  return {
    kind: "desktop-managed-backup-catalog",
    schemaVersion: DESKTOP_MANAGED_BACKUP_CATALOG_PROTOCOL_VERSION,
    status: "error",
    phase: "catalog",
    errorCode,
    backups: [],
  };
}

function unavailableDatabaseRecoverySnapshot(): DesktopDatabaseRecoverySnapshotResponse {
  return {
    kind: "desktop-database-recovery-snapshot",
    schemaVersion: DESKTOP_DATABASE_RECOVERY_SCHEMA_VERSION,
    status: "recovery",
    snapshot: {
      schemaVersion: DESKTOP_DATABASE_RECOVERY_SCHEMA_VERSION,
      state: "diagnostic-required",
      reasonCode: "storage-unavailable",
      managedBackupAvailable: false,
      pendingRestoreAvailable: false,
      canStartEmpty: false,
    },
  };
}

function normalizeDatabaseRecoverySnapshotResponse(
  value: unknown,
): DesktopDatabaseRecoverySnapshotResponse {
  if (
    !isRecord(value) ||
    !hasExactKeys(value, ["kind", "schemaVersion", "status", "snapshot"]) ||
    value.kind !== "desktop-database-recovery-snapshot" ||
    value.schemaVersion !== DESKTOP_DATABASE_RECOVERY_SCHEMA_VERSION ||
    !["ready", "recovery"].includes(value.status as string) ||
    !(value.snapshot === null || isDatabaseRecoverySnapshot(value.snapshot)) ||
    (value.status === "recovery" && value.snapshot === null)
  ) {
    return unavailableDatabaseRecoverySnapshot();
  }

  return value as DesktopDatabaseRecoverySnapshotResponse;
}

function normalizeManagedBackupCatalogResponse(
  value: unknown,
): DesktopManagedBackupCatalogResponse {
  if (
    !isRecord(value) ||
    !hasExactKeys(value, [
      "kind",
      "schemaVersion",
      "status",
      "phase",
      "errorCode",
      "backups",
    ]) ||
    value.kind !== "desktop-managed-backup-catalog" ||
    value.schemaVersion !== DESKTOP_MANAGED_BACKUP_CATALOG_PROTOCOL_VERSION ||
    !["ready", "empty", "error"].includes(value.status as string) ||
    value.phase !== "catalog" ||
    !(value.errorCode === null || isManagedBackupCatalogErrorCode(value.errorCode)) ||
    !Array.isArray(value.backups)
  ) {
    return unavailableManagedBackupCatalog("invalid-catalog");
  }

  const backups = value.backups as unknown[];
  const identifiers = new Set<string>();
  for (const backup of backups) {
    if (!isManagedBackupCatalogEntry(backup) || identifiers.has(backup.backupId)) {
      return unavailableManagedBackupCatalog("invalid-catalog");
    }
    identifiers.add(backup.backupId);
  }
  if (backups.some((backup, index) => {
    if (index === 0) return false;
    const previous = backups[index - 1] as DesktopManagedBackupCatalogEntry;
    const current = backup as DesktopManagedBackupCatalogEntry;
    return previous.createdAt < current.createdAt ||
      (previous.createdAt === current.createdAt && previous.backupId > current.backupId);
  })) {
    return unavailableManagedBackupCatalog("invalid-catalog");
  }

  const status = value.status as DesktopManagedBackupCatalogResponse["status"];
  if (
    (status === "ready" && (value.errorCode !== null || backups.length === 0)) ||
    (status === "empty" && (value.errorCode !== null || backups.length !== 0)) ||
    (status === "error" && (value.errorCode === null || backups.length !== 0))
  ) {
    return unavailableManagedBackupCatalog("invalid-catalog");
  }

  return value as DesktopManagedBackupCatalogResponse;
}

function normalizeDataBackupDialogResponse(
  value: unknown,
  dialog: DesktopDataBackupDialog,
): DesktopDataBackupDialogResponse {
  if (
    !isRecord(value) ||
    !hasExactKeys(value, [
      "kind",
      "schemaVersion",
      "dialog",
      "ok",
      "status",
      "phase",
      "selection",
      "errorCode",
    ]) ||
    value.kind !== "desktop-file-dialog" ||
    value.schemaVersion !== DESKTOP_DATA_BACKUP_PROTOCOL_VERSION ||
    value.dialog !== dialog ||
    value.phase !== "dialog" ||
    !["selected", "cancelled", "error"].includes(value.status as string) ||
    typeof value.ok !== "boolean" ||
    !(value.selection === null || isRecord(value.selection)) ||
    !(value.errorCode === null ||
      isDesktopDataBackupDialogErrorCode(value.errorCode))
  ) {
    return unavailableDialogResult(dialog);
  }

  if (value.selection !== null) {
    if (
      !hasExactKeys(value.selection, ["kind", "selectionId", "fileName"]) ||
      value.selection.kind !== "external-file" ||
      !isDataBackupSelectionId(value.selection.selectionId) ||
      typeof value.selection.fileName !== "string" ||
      value.selection.fileName.length === 0 ||
      value.selection.fileName.length > 255 ||
      /[\\/\u0000-\u001f\u007f]/.test(value.selection.fileName)
    ) {
      return unavailableDialogResult(dialog);
    }
  }

  const status = value.status as DesktopDataBackupDialogResponse["status"];
  if (
    (status === "selected" &&
      (!value.ok || value.selection === null || value.errorCode !== null)) ||
    (status === "cancelled" &&
      (value.ok || value.selection !== null || value.errorCode !== null)) ||
    (status === "error" &&
      (value.ok || value.selection !== null || value.errorCode === null))
  ) {
    return unavailableDialogResult(dialog);
  }

  return value as DesktopDataBackupDialogResponse;
}

function normalizeDataBackupOperationResponse(
  value: unknown,
  operation: DesktopDataBackupOperationRequest["operation"] | null = null,
): DesktopDataBackupOperationResponse {
  if (
    !isRecord(value) ||
    !hasExactKeys(value, [
      "kind",
      "schemaVersion",
      "ok",
      "status",
      "operation",
      "phase",
      "errorCode",
      "result",
    ]) ||
    value.kind !== "desktop-data-backup-operation" ||
    value.schemaVersion !== DESKTOP_DATA_BACKUP_PROTOCOL_VERSION ||
    typeof value.ok !== "boolean" ||
    (operation !== null && value.operation !== operation) ||
    !["success", "cancelled", "error"].includes(value.status as string) ||
    !(value.operation === null ||
      ["export", "restore", "delete"].includes(value.operation as string)) ||
    !["request", "validation", "operation", "complete"].includes(
      value.phase as string,
    ) ||
    !(value.errorCode === null ||
      isDesktopDataBackupOperationErrorCode(value.errorCode)) ||
    !(value.result === null || isRecord(value.result))
  ) {
    return unavailableOperationResult(operation);
  }

  if (value.result !== null) {
    if (
      value.operation !== "export" ||
      !hasExactKeys(value.result, ["fileName", "size"]) ||
      typeof value.result.fileName !== "string" ||
      value.result.fileName.length === 0 ||
      value.result.fileName.length > 255 ||
      /[\\/\u0000-\u001f\u007f]/.test(value.result.fileName) ||
      typeof value.result.size !== "number" ||
      !Number.isSafeInteger(value.result.size) ||
      value.result.size < 1
    ) {
      return unavailableOperationResult(operation);
    }
  }

  const status = value.status as DesktopDataBackupOperationResponse["status"];
  if (
    (status === "success" &&
      (value.ok === false ||
        value.errorCode !== null ||
        (value.operation === "export" && value.result === null))) ||
    (status === "cancelled" &&
      (value.ok || value.errorCode !== null || value.result !== null)) ||
    (status === "error" &&
      (value.ok || value.errorCode === null || value.result !== null))
  ) {
    return unavailableOperationResult(operation);
  }

  return value as DesktopDataBackupOperationResponse;
}

function unavailablePendingRestoreStatus(
  errorCode: DesktopPendingRestoreStatusErrorCode = "command-unavailable",
): DesktopPendingRestoreStatusResponse {
  return {
    kind: "desktop-pending-restore-status",
    schemaVersion: DESKTOP_PENDING_RESTORE_PROTOCOL_VERSION,
    status: "invalid",
    phase: "status",
    operationId: null,
    errorCode,
    pending: null,
  };
}

function unavailablePendingRestoreResume(
  pendingId: string | null = null,
  errorCode: DesktopPendingRestoreResumeErrorCode = "command-unavailable",
): DesktopPendingRestoreResumeResult {
  return {
    kind: "desktop-pending-restore-resume",
    schemaVersion: DESKTOP_PENDING_RESTORE_PROTOCOL_VERSION,
    ok: false,
    status: "error",
    phase: "request",
    operationId: null,
    pendingId,
    errorCode,
    result: null,
  };
}

function normalizePendingRestoreStatusResponse(
  value: unknown,
): DesktopPendingRestoreStatusResponse {
  if (
    !isRecord(value) ||
    !hasExactKeys(value, [
      "kind",
      "schemaVersion",
      "status",
      "phase",
      "operationId",
      "errorCode",
      "pending",
    ]) ||
    value.kind !== "desktop-pending-restore-status" ||
    value.schemaVersion !== DESKTOP_PENDING_RESTORE_PROTOCOL_VERSION ||
    !["none", "available", "invalid"].includes(value.status as string) ||
    value.phase !== "status" ||
    value.operationId !== null ||
    !(value.errorCode === null || isPendingRestoreStatusErrorCode(value.errorCode)) ||
    !(value.pending === null || isRecord(value.pending))
  ) {
    return unavailablePendingRestoreStatus();
  }

  if (value.pending !== null) {
    if (
      !hasExactKeys(value.pending, [
        "pendingId",
        "manifestToken",
        "sourceKind",
        "createdAt",
        "candidateDigest",
        "candidateSize",
        "candidateSchemaIdentity",
      ]) ||
      !isPendingRestoreToken(value.pending.pendingId) ||
      !isPendingRestoreToken(value.pending.manifestToken) ||
      !["managed-backup", "external-file"].includes(value.pending.sourceKind as string) ||
      typeof value.pending.createdAt !== "string" ||
      !/^[a-f0-9]{64}$/.test(value.pending.candidateDigest as string) ||
      !Number.isSafeInteger(value.pending.candidateSize) ||
      (value.pending.candidateSize as number) < 1 ||
      !/^[a-f0-9]{64}$/.test(value.pending.candidateSchemaIdentity as string)
    ) {
      return unavailablePendingRestoreStatus();
    }
  }

  const status = value.status as DesktopPendingRestoreStatusResponse["status"];
  if (
    (status === "none" && (value.errorCode !== null || value.pending !== null)) ||
    (status === "available" && (value.errorCode !== null || value.pending === null)) ||
    (status === "invalid" && (value.errorCode === null || value.pending !== null))
  ) {
    return unavailablePendingRestoreStatus();
  }
  return value as DesktopPendingRestoreStatusResponse;
}

function normalizePendingRestoreResumeResponse(
  value: unknown,
  expectedPendingId: string | null = null,
): DesktopPendingRestoreResumeResult {
  if (
    !isRecord(value) ||
    !hasExactKeys(value, [
      "kind",
      "schemaVersion",
      "ok",
      "status",
      "phase",
      "operationId",
      "pendingId",
      "errorCode",
      "result",
    ]) ||
    value.kind !== "desktop-pending-restore-resume" ||
    value.schemaVersion !== DESKTOP_PENDING_RESTORE_PROTOCOL_VERSION ||
    typeof value.ok !== "boolean" ||
    !["success", "error"].includes(value.status as string) ||
    !["request", "validation", "operation", "complete"].includes(value.phase as string) ||
    !(value.operationId === null || isSafeStateIdentifier(value.operationId)) ||
    (expectedPendingId !== null && value.pendingId !== expectedPendingId) ||
    !(value.pendingId === null || isPendingRestoreToken(value.pendingId)) ||
    !(value.errorCode === null || isPendingRestoreResumeErrorCode(value.errorCode)) ||
    !(value.result === null || isRecord(value.result))
  ) {
    return unavailablePendingRestoreResume(expectedPendingId);
  }

  if (value.result !== null && (
    !hasExactKeys(value.result, ["safetyBackupId", "size"]) ||
    !(value.result.safetyBackupId === null || isDataBackupId(value.result.safetyBackupId)) ||
    !Number.isSafeInteger(value.result.size) ||
    (value.result.size as number) < 1
  )) {
    return unavailablePendingRestoreResume(expectedPendingId);
  }

  const status = value.status as DesktopPendingRestoreResumeResult["status"];
  if (
    (status === "success" &&
      (!value.ok || value.errorCode !== null || value.result === null || value.phase !== "complete")) ||
    (status === "error" && (value.ok || value.errorCode === null || value.result !== null))
  ) {
    return unavailablePendingRestoreResume(expectedPendingId);
  }
  return value as DesktopPendingRestoreResumeResult;
}

function isSnapshot(value: unknown): value is DesktopUpdateStateSnapshot {
  if (!isRecord(value) || !hasOnlyKeys(value, [
    "snapshotVersion",
    "status",
    "lastCheckAt",
    "checkStartedAt",
    "pendingUpdate",
    "failure",
  ])) {
    return false;
  }

  if (
    value.snapshotVersion !== UPDATE_STATE_SNAPSHOT_VERSION ||
    ![
      "not-checked",
      "checking",
      "no-update",
      "available",
      "failed",
    ].includes(value.status as string) ||
    !isNullableTimestamp(value.lastCheckAt) ||
    !isNullableTimestamp(value.checkStartedAt)
  ) {
    return false;
  }

  if (value.pendingUpdate !== null) {
    if (
      !isRecord(value.pendingUpdate) ||
      !hasOnlyKeys(value.pendingUpdate, [
        "version",
        "channel",
        "architecture",
        "artifact",
        "verificationState",
        "discoveredAt",
      ]) ||
      !isSafeStateIdentifier(value.pendingUpdate.version) ||
      !isSafeStateIdentifier(value.pendingUpdate.channel) ||
      !isSafeStateIdentifier(value.pendingUpdate.architecture) ||
      !isOpaqueIdentifier(value.pendingUpdate.artifact) ||
      !["not-verified", "verified", "failed"].includes(
        value.pendingUpdate.verificationState as string,
      ) ||
      !isTimestamp(value.pendingUpdate.discoveredAt)
    ) {
      return false;
    }
  }

  if (value.failure !== null) {
    if (
      !isRecord(value.failure) ||
      !hasOnlyKeys(value.failure, ["code", "retryAt"]) ||
      typeof value.failure.code !== "string" ||
      !/^[a-z0-9._-]{1,64}$/.test(value.failure.code) ||
      !isTimestamp(value.failure.retryAt)
    ) {
      return false;
    }
  }

  return true;
}

function normalizeResponse(value: unknown): DesktopManualUpdateCheckResult {
  if (
    !isRecord(value) ||
    !hasOnlyKeys(value, ["outcome", "state"]) ||
    ![
      "no-update",
      "available",
      "failed",
      "suppressed",
      "already-checking",
    ].includes(value.outcome as string) ||
    !isSnapshot(value.state)
  ) {
    return { kind: "command-error", code: "command-unavailable" };
  }

  return {
    kind: value.outcome as DesktopManualUpdateCheckOutcome,
    response: value as DesktopManualUpdateCheckResponse,
  };
}

function normalizeUpdateStateReadResult(
  value: unknown,
): DesktopUpdateStateReadResult {
  if (isSnapshot(value)) {
    return { kind: "snapshot", snapshot: value };
  }

  return { kind: "state-error", code: "update-state" };
}

function normalizeVerifyPendingUpdateResponse(
  value: unknown,
): DesktopVerifyPendingUpdateResult {
  if (
    !isRecord(value) ||
    !hasOnlyKeys(value, ["outcome", "state"]) ||
    ![
      "verified",
      "no-pending-update",
      "no-update",
      "update-candidate-changed",
      "failed",
      "busy",
    ].includes(value.outcome as string) ||
    !isSnapshot(value.state)
  ) {
    return { kind: "command-error", code: "command-unavailable" };
  }

  return {
    kind: value.outcome as DesktopVerifyPendingUpdateOutcome,
    response: value as DesktopVerifyPendingUpdateResponse,
  };
}

function isVerifyPendingUpdateCommandErrorCode(
  value: unknown,
): value is
  | DesktopVerifyPendingUpdateCommandErrorCode
  | "command-unavailable" {
  return (
    typeof value === "string" &&
    [
      "update-revalidation",
      "update-download",
      "update-signature-key",
      "update-state",
      "staging-path",
      "staging-read",
      "staging-write",
      "staging-rename",
      "update-target-app-version-invalid",
      "update-target-macos-command-failed",
      "update-target-macos-output-invalid",
      "update-command-worker-failed",
      "command-unavailable",
    ].includes(value)
  );
}

function normalizeVerifyPendingUpdateInvokeError(
  value: unknown,
): DesktopVerifyPendingUpdateResult {
  if (
    !isRecord(value) ||
    !hasOnlyKeys(value, ["kind", "code"]) ||
    (value.kind !== "command-error" && value.kind !== "state-error") ||
    !isVerifyPendingUpdateCommandErrorCode(value.code)
  ) {
    return { kind: "command-error", code: "command-unavailable" };
  }

  if (value.kind === "state-error" && value.code === "update-state") {
    return { kind: "state-error", code: "update-state" };
  }

  if (value.kind === "command-error") {
    return {
      kind: "command-error",
      code: value.code,
    };
  }

  return { kind: "state-error", code: "command-unavailable" };
}

function normalizeVerifyPendingUpdateExternalResult(
  value: unknown,
): DesktopVerifyPendingUpdateResult {
  if (isRecord(value) && "outcome" in value) {
    return normalizeVerifyPendingUpdateResponse(value);
  }

  return normalizeVerifyPendingUpdateInvokeError(value);
}

function isCommandErrorCode(
  value: unknown,
): value is Exclude<DesktopManualUpdateCheckCommandErrorCode, "command-unavailable"> {
  return (
    typeof value === "string" &&
    [
      "update-target-app-version-invalid",
      "update-target-macos-command-failed",
      "update-target-macos-output-invalid",
      "provider-internal",
      "update-command-worker-failed",
    ].includes(value)
  );
}

function normalizeInvokeError(value: unknown): DesktopManualUpdateCheckResult {
  if (!isRecord(value) || !hasOnlyKeys(value, ["kind", "code"])) {
    return { kind: "command-error", code: "command-unavailable" };
  }

  if (value.kind === "state-error" && value.code === "update-state") {
    return { kind: "state-error", code: "update-state" };
  }

  if (value.kind === "command-error" && isCommandErrorCode(value.code)) {
    return {
      kind: "command-error",
      code: value.code,
    };
  }

  return { kind: "command-error", code: "command-unavailable" };
}

function normalizeExternalResult(value: unknown): DesktopManualUpdateCheckResult {
  if (isRecord(value) && "outcome" in value) {
    return normalizeResponse(value);
  }

  return normalizeInvokeError(value);
}

function isValidDynamicPort(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d+$/.test(value)) {
    return false;
  }

  const port = Number(value);
  return (
    Number.isSafeInteger(port) &&
    port >= MIN_DYNAMIC_PORT &&
    port <= MAX_DYNAMIC_PORT
  );
}

function isCanonicalManualUpdateCheckPath(pathname: string) {
  if (
    pathname === NOTES_PATH ||
    pathname === NEW_NOTE_PATH ||
    pathname === BACKUP_PATH
  ) {
    return true;
  }

  const noteDetailPrefix = `${NOTES_PATH}/`;
  if (!pathname.startsWith(noteDetailPrefix)) {
    return false;
  }

  const noteId = pathname.slice(noteDetailPrefix.length);
  return noteId.length > 0 && !noteId.includes("/");
}

function isExternalLoopbackPage() {
  if (typeof window === "undefined") {
    return false;
  }

  return (
    window.location.protocol === "http:" &&
    window.location.hostname === "127.0.0.1" &&
    isValidDynamicPort(window.location.port) &&
    isCanonicalManualUpdateCheckPath(window.location.pathname)
  );
}

function clearExternalRequestFragment(requestFragment: string) {
  try {
    if (window.location.hash === `#${requestFragment}`) {
      window.history.replaceState(
        null,
        "",
        `${window.location.pathname}${window.location.search}`,
      );
    }
  } catch {
    // A closed or partially initialized WebView is already unavailable.
  }
}

function requestManualUpdateCheckFromExternalWeb(): Promise<DesktopManualUpdateCheckResult> {
  return new Promise((resolve) => {
    let settled = false;
    let timeoutId: number | undefined;

    const cleanup = () => {
      try {
        window.removeEventListener(
          DESKTOP_MANUAL_UPDATE_CHECK_RESULT_EVENT,
          handleResult,
        );
      } catch {
        // The WebView may be closing while the request is settling.
      }

      if (timeoutId !== undefined) {
        try {
          window.clearTimeout(timeoutId);
        } catch {
          // The WebView may be closing while the request is settling.
        }
      }
      clearExternalRequestFragment(
        DESKTOP_MANUAL_UPDATE_CHECK_REQUEST_FRAGMENT,
      );
    };

    const settle = (result: DesktopManualUpdateCheckResult) => {
      if (settled) {
        return;
      }
      settled = true;
      cleanup();
      resolve(result);
    };

    const handleResult = (event: Event) => {
      settle(
        normalizeExternalResult((event as CustomEvent<unknown>).detail),
      );
    };

    try {
      window.addEventListener(
        DESKTOP_MANUAL_UPDATE_CHECK_RESULT_EVENT,
        handleResult,
      );
      timeoutId = window.setTimeout(
        () =>
          settle({
            kind: "command-error",
            code: "command-unavailable",
          }),
        MANUAL_UPDATE_CHECK_TIMEOUT_MS,
      );
      window.location.hash = DESKTOP_MANUAL_UPDATE_CHECK_REQUEST_FRAGMENT;
    } catch {
      settle({
        kind: "command-error",
        code: "command-unavailable",
      });
    }
  });
}

function requestUpdateStateFromExternalWeb(): Promise<DesktopUpdateStateReadResult> {
  return new Promise((resolve) => {
    let settled = false;
    let timeoutId: number | undefined;

    const cleanup = () => {
      try {
        window.removeEventListener(
          DESKTOP_UPDATE_STATE_RESULT_EVENT,
          handleResult,
        );
      } catch {
        // The WebView may be closing while the request is settling.
      }

      if (timeoutId !== undefined) {
        try {
          window.clearTimeout(timeoutId);
        } catch {
          // The WebView may be closing while the request is settling.
        }
      }
      clearExternalRequestFragment(DESKTOP_UPDATE_STATE_REQUEST_FRAGMENT);
    };

    const settle = (result: DesktopUpdateStateReadResult) => {
      if (settled) {
        return;
      }
      settled = true;
      cleanup();
      resolve(result);
    };

    const handleResult = (event: Event) => {
      settle(
        normalizeUpdateStateReadResult(
          (event as CustomEvent<unknown>).detail,
        ),
      );
    };

    try {
      window.addEventListener(DESKTOP_UPDATE_STATE_RESULT_EVENT, handleResult);
      timeoutId = window.setTimeout(
        () => settle({ kind: "state-error", code: "update-state" }),
        MANUAL_UPDATE_CHECK_TIMEOUT_MS,
      );
      window.location.hash = DESKTOP_UPDATE_STATE_REQUEST_FRAGMENT;
    } catch {
      settle({ kind: "state-error", code: "update-state" });
    }
  });
}

function requestVerifyPendingUpdateFromExternalWeb(): Promise<DesktopVerifyPendingUpdateResult> {
  return new Promise((resolve) => {
    let settled = false;
    let timeoutId: number | undefined;

    const cleanup = () => {
      try {
        window.removeEventListener(
          DESKTOP_VERIFY_PENDING_UPDATE_RESULT_EVENT,
          handleResult,
        );
      } catch {
        // The WebView may be closing while the request is settling.
      }

      if (timeoutId !== undefined) {
        try {
          window.clearTimeout(timeoutId);
        } catch {
          // The WebView may be closing while the request is settling.
        }
      }
      clearExternalRequestFragment(
        DESKTOP_VERIFY_PENDING_UPDATE_REQUEST_FRAGMENT,
      );
    };

    const settle = (result: DesktopVerifyPendingUpdateResult) => {
      if (settled) {
        return;
      }
      settled = true;
      cleanup();
      resolve(result);
    };

    const handleResult = (event: Event) => {
      settle(
        normalizeVerifyPendingUpdateExternalResult(
          (event as CustomEvent<unknown>).detail,
        ),
      );
    };

    try {
      window.addEventListener(
        DESKTOP_VERIFY_PENDING_UPDATE_RESULT_EVENT,
        handleResult,
      );
      timeoutId = window.setTimeout(
        () =>
          settle({
            kind: "command-error",
            code: "command-unavailable",
          }),
        VERIFY_PENDING_UPDATE_TIMEOUT_MS,
      );
      window.location.hash = DESKTOP_VERIFY_PENDING_UPDATE_REQUEST_FRAGMENT;
    } catch {
      settle({
        kind: "command-error",
        code: "command-unavailable",
      });
    }
  });
}

function hasTauriRuntime() {
  if (typeof window === "undefined") {
    return false;
  }

  return Boolean((window as TauriWindow).__TAURI_INTERNALS__);
}

export function requestManualUpdateCheck(): Promise<DesktopManualUpdateCheckResult> {
  if (typeof window === "undefined") {
    return Promise.resolve({ kind: "unsupported-web" });
  }

  const nativeRuntime = hasTauriRuntime();
  if (!nativeRuntime && !isExternalLoopbackPage()) {
    return Promise.resolve({ kind: "unsupported-web" });
  }

  if (manualUpdateCheckInFlight) {
    return manualUpdateCheckInFlight;
  }

  const request = (
    nativeRuntime
      ? Promise.resolve()
          .then(() => invoke<unknown>(MANUAL_UPDATE_CHECK_COMMAND))
          .then(normalizeResponse, normalizeInvokeError)
      : requestManualUpdateCheckFromExternalWeb()
  ).catch(() => ({
    kind: "command-error" as const,
    code: "command-unavailable" as const,
  }));
  manualUpdateCheckInFlight = request;
  request.then(() => {
    if (manualUpdateCheckInFlight === request) {
      manualUpdateCheckInFlight = null;
    }
  });
  return request;
}

export function readUpdateStateSnapshot(): Promise<DesktopUpdateStateReadResult> {
  if (typeof window === "undefined") {
    return Promise.resolve({ kind: "unsupported-web" });
  }

  const nativeRuntime = hasTauriRuntime();
  if (!nativeRuntime && !isExternalLoopbackPage()) {
    return Promise.resolve({ kind: "unsupported-web" });
  }

  if (updateStateReadInFlight) {
    return updateStateReadInFlight;
  }

  const request = (
    nativeRuntime
      ? Promise.resolve()
          .then(() => invoke<unknown>(READ_UPDATE_STATE_COMMAND))
          .then(normalizeUpdateStateReadResult, () => ({
            kind: "state-error" as const,
            code: "update-state" as const,
          }))
      : requestUpdateStateFromExternalWeb()
  ).catch(() => ({
    kind: "state-error" as const,
    code: "update-state" as const,
  }));
  updateStateReadInFlight = request;
  request.then(() => {
    if (updateStateReadInFlight === request) {
      updateStateReadInFlight = null;
    }
  });
  return request;
}

export function requestVerifyPendingUpdate(): Promise<DesktopVerifyPendingUpdateResult> {
  if (typeof window === "undefined") {
    return Promise.resolve({ kind: "unsupported-web" });
  }

  const nativeRuntime = hasTauriRuntime();
  if (!nativeRuntime && !isExternalLoopbackPage()) {
    return Promise.resolve({ kind: "unsupported-web" });
  }

  if (verifyPendingUpdateInFlight) {
    return verifyPendingUpdateInFlight;
  }

  const request = (
    nativeRuntime
      ? Promise.resolve()
          .then(() => invoke<unknown>(VERIFY_PENDING_UPDATE_COMMAND))
          .then(
            normalizeVerifyPendingUpdateResponse,
            normalizeVerifyPendingUpdateInvokeError,
          )
      : requestVerifyPendingUpdateFromExternalWeb()
  ).catch(() => ({
    kind: "command-error" as const,
    code: "command-unavailable" as const,
  }));
  verifyPendingUpdateInFlight = request;
  request.then(() => {
    if (verifyPendingUpdateInFlight === request) {
      verifyPendingUpdateInFlight = null;
    }
  });
  return request;
}

export function verifyPendingUpdate(): Promise<DesktopVerifyPendingUpdateResult> {
  return requestVerifyPendingUpdate();
}

export function requestDataBackupSaveDestination(): Promise<DesktopDataBackupDialogResult> {
  if (typeof window === "undefined" || !hasTauriRuntime()) {
    return Promise.resolve({ kind: "unsupported-web" });
  }

  return Promise.resolve()
    .then(() => invoke<unknown>(DATA_BACKUP_SAVE_DESTINATION_COMMAND))
    .then(
      (value) =>
        normalizeDataBackupDialogResponse(value, "save-destination"),
      () => unavailableDialogResult("save-destination"),
    )
    .catch(() => unavailableDialogResult("save-destination"));
}

export function requestDataBackupExternalSource(): Promise<DesktopDataBackupDialogResult> {
  if (typeof window === "undefined" || !hasTauriRuntime()) {
    return Promise.resolve({ kind: "unsupported-web" });
  }

  return Promise.resolve()
    .then(() => invoke<unknown>(DATA_BACKUP_EXTERNAL_SOURCE_COMMAND))
    .then(
      (value) =>
        normalizeDataBackupDialogResponse(value, "open-external-source"),
      () => unavailableDialogResult("open-external-source"),
    )
    .catch(() => unavailableDialogResult("open-external-source"));
}

export function requestDataBackupOperation(
  request: DesktopDataBackupOperationRequest,
): Promise<DesktopDataBackupOperationResult> {
  if (!isDataBackupOperationRequest(request)) {
    return Promise.resolve(unavailableOperationResult(null, "invalid-request"));
  }
  if (typeof window === "undefined" || !hasTauriRuntime()) {
    return Promise.resolve({ kind: "unsupported-web" });
  }

  return Promise.resolve()
    .then(() =>
      invoke<unknown>(DATA_BACKUP_OPERATION_COMMAND, { request }),
    )
    .then(
      (value) => normalizeDataBackupOperationResponse(value, request.operation),
      () => unavailableOperationResult(request.operation),
    )
    .catch(() => unavailableOperationResult(request.operation));
}

export function requestDiagnosticExportDestination(): Promise<DesktopDiagnosticDialogResult> {
  if (typeof window === "undefined" || !hasTauriRuntime()) {
    return Promise.resolve({ kind: "unsupported-web" });
  }

  return Promise.resolve()
    .then(() => invoke<unknown>(DIAGNOSTIC_DESTINATION_COMMAND))
    .then(
      normalizeDiagnosticDialogResponse,
      () => unavailableDiagnosticDialog(),
    )
    .catch(() => unavailableDiagnosticDialog());
}

export function requestDesktopDiagnostics(
  selectionId: string,
): Promise<DesktopDiagnosticExportResultResponse> {
  if (typeof window === "undefined" || !hasTauriRuntime()) {
    return Promise.resolve({ kind: "unsupported-web" });
  }

  const request = {
    schemaVersion: DIAGNOSTIC_EXPORT_PROTOCOL_VERSION,
    operation: "export" as const,
    selectionId,
  };
  if (!isDiagnosticExportRequest(request)) {
    return Promise.resolve(unavailableDiagnosticExport("invalid-request"));
  }

  return Promise.resolve()
    .then(() => invoke<unknown>(DIAGNOSTIC_EXPORT_COMMAND, { request }))
    .then(
      (value) => normalizeDiagnosticExportResponse(value, selectionId),
      () => unavailableDiagnosticExport(),
    )
    .catch(() => unavailableDiagnosticExport());
}

export function requestDesktopDatabaseRecoverySnapshot(): Promise<DesktopDatabaseRecoverySnapshotResult> {
  if (typeof window === "undefined" || !hasTauriRuntime()) {
    return Promise.resolve({ kind: "unsupported-web" });
  }

  return Promise.resolve()
    .then(() => invoke<unknown>(DATABASE_RECOVERY_SNAPSHOT_COMMAND))
    .then(
      normalizeDatabaseRecoverySnapshotResponse,
      unavailableDatabaseRecoverySnapshot,
    )
    .catch(unavailableDatabaseRecoverySnapshot);
}

export function requestManagedBackupCatalog(): Promise<DesktopManagedBackupCatalogResult> {
  if (typeof window === "undefined" || !hasTauriRuntime()) {
    return Promise.resolve({ kind: "unsupported-web" });
  }

  return Promise.resolve()
    .then(() => invoke<unknown>(MANAGED_BACKUP_CATALOG_COMMAND))
    .then(
      normalizeManagedBackupCatalogResponse,
      () => unavailableManagedBackupCatalog(),
    )
    .catch(() => unavailableManagedBackupCatalog());
}

export function requestPendingRestoreStatus(): Promise<DesktopPendingRestoreStatusResult> {
  if (typeof window === "undefined" || !hasTauriRuntime()) {
    return Promise.resolve({ kind: "unsupported-web" });
  }

  return Promise.resolve()
    .then(() => invoke<unknown>(PENDING_RESTORE_STATUS_COMMAND))
    .then(normalizePendingRestoreStatusResponse, () => unavailablePendingRestoreStatus())
    .catch(() => unavailablePendingRestoreStatus());
}

export function requestPendingRestoreResume(
  request: DesktopPendingRestoreResumeRequest,
): Promise<DesktopPendingRestoreResumeResponse> {
  if (!isPendingRestoreResumeRequest(request)) {
    return Promise.resolve(unavailablePendingRestoreResume(null, "invalid-request"));
  }
  if (typeof window === "undefined" || !hasTauriRuntime()) {
    return Promise.resolve({ kind: "unsupported-web" });
  }

  return Promise.resolve()
    .then(() => invoke<unknown>(PENDING_RESTORE_RESUME_COMMAND, { request }))
    .then(
      (value) => normalizePendingRestoreResumeResponse(value, request.pendingId),
      () => unavailablePendingRestoreResume(request.pendingId),
    )
    .catch(() => unavailablePendingRestoreResume(request.pendingId));
}

export function confirmPendingRestore(
  pendingId: string,
  manifestToken: string,
): Promise<DesktopPendingRestoreResumeResponse> {
  return requestPendingRestoreResume({
    schemaVersion: DESKTOP_PENDING_RESTORE_PROTOCOL_VERSION,
    pendingId,
    manifestToken,
    confirmed: true,
  });
}

export function sendDesktopSettingsRequest() {
  if (typeof window === "undefined") {
    return false;
  }

  try {
    window.dispatchEvent(new CustomEvent(DESKTOP_SETTINGS_REQUEST_EVENT));
    return true;
  } catch {
    return false;
  }
}
