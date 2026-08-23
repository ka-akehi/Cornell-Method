"use client";

import { invoke } from "@tauri-apps/api/core";

export const DESKTOP_SETTINGS_REQUEST_EVENT = "cornell:desktop-settings-request";

const MANUAL_UPDATE_CHECK_COMMAND = "manual_update_check";
const UPDATE_STATE_SNAPSHOT_VERSION = 1;

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

type TauriWindow = Window & {
  __TAURI_INTERNALS__?: unknown;
};

let manualUpdateCheckInFlight: Promise<DesktopManualUpdateCheckResult> | null =
  null;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasOnlyKeys(value: Record<string, unknown>, keys: string[]) {
  return Object.keys(value).every((key) => keys.includes(key));
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

function hasTauriRuntime() {
  if (typeof window === "undefined") {
    return false;
  }

  return Boolean((window as TauriWindow).__TAURI_INTERNALS__);
}

export function requestManualUpdateCheck(): Promise<DesktopManualUpdateCheckResult> {
  if (!hasTauriRuntime()) {
    return Promise.resolve({ kind: "unsupported-web" });
  }

  if (manualUpdateCheckInFlight) {
    return manualUpdateCheckInFlight;
  }

  const request = Promise.resolve()
    .then(() => invoke<unknown>(MANUAL_UPDATE_CHECK_COMMAND))
    .then(normalizeResponse, normalizeInvokeError)
    .catch(() => ({
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
