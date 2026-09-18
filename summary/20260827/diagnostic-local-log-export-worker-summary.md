# Desktop diagnostic local log / export worker summary

## Result

Implemented the backend/native diagnostic boundary without changing the TypeScript bridge or recovery UI.

## Changes

- Added `src-tauri/src/diagnostics.rs`.
  - Version `1` protocols for diagnostic destination selection and export.
  - Privacy-safe structured local records under the canonical Application Support `logs/` directory.
  - Allowlisted components, error codes, fixed sanitized messages, and `stack: "redacted"`; raw errors and paths are never serialized.
  - Atomic per-record files, bounded 16 KiB record/file size, unsafe-entry/symlink fail-closed validation, 14-day retention, and 20 MiB total pruning.
  - Minimal dependency-free ZIP writer containing only `diagnostic.json` and the allowlisted diagnostic document fields.
  - Explicit external destination selection, selection-store resolution, existing-file/symlink/directory/managed-root rejection, temporary cleanup, and typed failure responses.
- Extended `runtime.rs` with the dedicated `DiagnosticExport` native dialog/selection kind while preserving backup dialog kinds and the discarded sidecar stderr boundary.
- Added `choose_diagnostic_export_destination_command` and `export_desktop_diagnostics` to `main.rs`.
- Added startup, recovery, restore, pending-restore, sidecar start/restart/exit cleanup, and bootstrap failure hooks in `main.rs`/`lifecycle.rs`.
- Added `test/desktop/desktop-diagnostics.test.js` and Rust unit tests in `diagnostics.rs`.

## Bridge contract for the next worker

- Dialog command: `choose_diagnostic_export_destination_command`
  - response: `{ kind: "desktop-diagnostic-dialog", schemaVersion: 1, dialog: "diagnostic-export", operation: "select-destination", status, phase: "dialog", ok, selection, errorCode }`
  - selection: `{ kind: "diagnostic-export", selectionId, fileName }`
  - cancel is `{ ok: false, status: "cancelled", errorCode: null }`.
- Export command: `export_desktop_diagnostics`
  - request: `{ schemaVersion: 1, operation: "export", selectionId }`
  - response: `{ kind: "desktop-diagnostic-export", schemaVersion: 1, dialog: "diagnostic-export", operation: "export", status, phase, ok, selection, errorCode, result }`
  - result on success: `{ fileName, size }`.
- No response contains an absolute path or raw exception. Current typed error codes include `invalid-request`, `unsupported-protocol-version`, `selection-not-found`, `selection-kind-mismatch`, `managed-path`, `symlink-path`, `path-not-file`, `destination-exists`, `archive-write-failed`, `publish-failed`, `cleanup-failed`, `unsafe-log-entry`, `log-prune-failed`, and `command-worker-failed`.

## Verification

- PASS: `cargo fmt --manifest-path src-tauri/Cargo.toml -- --check`
- PASS: `node --test test/desktop/desktop-diagnostics.test.js` (3/3)
- PASS: `node --test test/desktop/desktop-startup-recovery.test.js` (8/8)
- PASS: `node --test test/desktop/desktop-data-backup-restore.test.js` (9/9)
- PASS: `npx eslint test/desktop/desktop-diagnostics.test.js`
- PASS: `node --check test/desktop/desktop-diagnostics.test.js`
- PASS: `git diff --check`
- BLOCKED: `cargo test --manifest-path src-tauri/Cargo.toml --offline diagnostics::tests` could not resolve cached `tauri`.
- BLOCKED: online `cargo check --manifest-path src-tauri/Cargo.toml` could not resolve `index.crates.io` (`Could not resolve host`).

## Next Read

1. `src-tauri/src/diagnostics.rs` (protocol structs, allowlist, retention, ZIP publish)
2. `src-tauri/src/runtime.rs` (`DesktopFileDialogKind::DiagnosticExport`, selection store, native dialog)
3. `src-tauri/src/main.rs` (registered command names and startup setup)
4. `test/desktop/desktop-diagnostics.test.js`
5. Follow-up bridge/UI task: `src/shared/desktop/desktop-settings-bridge.ts` and `src-tauri/ui/index.html` remain intentionally unchanged.
