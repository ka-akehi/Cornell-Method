import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";

const projectRoot = path.resolve(__dirname, "../..");
const diagnosticsSource = fs.readFileSync(
  path.join(projectRoot, "src-tauri", "src", "diagnostics.rs"),
  "utf8",
);
const runtimeSource = fs.readFileSync(
  path.join(projectRoot, "src-tauri", "src", "runtime.rs"),
  "utf8",
);
const mainSource = fs.readFileSync(
  path.join(projectRoot, "src-tauri", "src", "main.rs"),
  "utf8",
);

test("diagnostic native protocol is versioned and selection-id-only", () => {
  assert.match(diagnosticsSource, /DIAGNOSTIC_PROTOCOL_VERSION: u8 = 1/);
  assert.match(diagnosticsSource, /DIAGNOSTIC_DIALOG_KIND: &str = "desktop-diagnostic-dialog"/);
  assert.match(diagnosticsSource, /DIAGNOSTIC_EXPORT_KIND: &str = "desktop-diagnostic-export"/);
  assert.match(diagnosticsSource, /selection_id: String/);
  assert.match(diagnosticsSource, /file_name: String/);
  assert.doesNotMatch(
    diagnosticsSource,
    /pub\(crate\) struct Diagnostic(?:DialogResponse|ExportResponse) \{[^}]*path:/,
  );
  assert.match(mainSource, /choose_diagnostic_export_destination_command/);
  assert.match(mainSource, /export_desktop_diagnostics/);
});

test("diagnostic archive and local log boundaries are explicit", () => {
  assert.match(diagnosticsSource, /LOG_MAX_AGE: Duration = Duration::from_secs\(14 \* 24 \* 60 \* 60\)/);
  assert.match(diagnosticsSource, /LOG_TOTAL_MAX_BYTES: u64 = 20 \* 1024 \* 1024/);
  assert.match(diagnosticsSource, /deny_unknown_fields/);
  assert.match(diagnosticsSource, /DIAGNOSTIC_FILE_NAME: &str = "diagnostic.json"/);
  assert.match(diagnosticsSource, /destination_metadata_is_present/);
  assert.match(diagnosticsSource, /cleanup_temporary_archive/);
  assert.match(diagnosticsSource, /operation_lock: Mutex<\(\)>/);
  assert.match(diagnosticsSource, /operation_lock\.lock\(\)/);
  assert.match(diagnosticsSource, /build_document\(SystemTime::now\(\)\)/);
  assert.match(diagnosticsSource, /fs::hard_link\(temporary, destination\)/);
  const publishFunction = diagnosticsSource.match(
    /fn publish_archive\([\s\S]*?\n\}\n/,
  )?.[0];
  assert.ok(publishFunction);
  assert.doesNotMatch(publishFunction, /fs::rename/);
});

test("file-dialog diagnostics keep only bounded metadata and use the existing local retention path", () => {
  assert.equal(
    (runtimeSource.match(/on error errorMessage number errorNumber/g) ?? []).length,
    3,
  );
  assert.doesNotMatch(runtimeSource, /on error number -128/);
  assert.match(runtimeSource, /if errorNumber is -128 then/);
  assert.match(diagnosticsSource, /"file-dialog" => "file-dialog"/);
  assert.match(diagnosticsSource, /dialog_kind: Option<String>/);
  assert.match(diagnosticsSource, /failure_phase: Option<String>/);
  assert.match(diagnosticsSource, /exit_status_category: Option<String>/);
  assert.match(diagnosticsSource, /dialogKind/);
  assert.match(diagnosticsSource, /failurePhase/);
  assert.match(diagnosticsSource, /exitStatusCategory/);
  assert.match(diagnosticsSource, /record_file_dialog_failure_for_app/);
  assert.match(runtimeSource, /DesktopFileDialogFailurePhase::DialogProcess/);
  assert.match(runtimeSource, /DesktopFileDialogFailurePhase::ResponseParse/);
  assert.match(runtimeSource, /DesktopFileDialogFailurePhase::PathValidation/);
  assert.match(runtimeSource, /DesktopFileDialogFailurePhase::SelectionStore/);
  assert.match(runtimeSource, /DesktopFileDialogExitStatus::NonZero/);
  assert.match(runtimeSource, /MAX_DESKTOP_DIALOG_OUTPUT_BYTES/);
  assert.doesNotMatch(diagnosticsSource, /process::stderr|read_to_string\([^)]*stderr/);
  assert.doesNotMatch(diagnosticsSource, /path: PathBuf/);
});

test("native diagnostic destination uses the dedicated dialog kind and keeps sidecar stderr discarded", () => {
  assert.match(runtimeSource, /DiagnosticExport/);
  assert.match(runtimeSource, /"diagnostic-export"/);
  assert.match(runtimeSource, /\.stderr\(Stdio::null\(\)\)/);
  assert.doesNotMatch(diagnosticsSource, /process::stderr|read_to_string\([^)]*stderr/);
});
