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
