(function () {
  "use strict";

  var COMMANDS = Object.freeze({
    snapshot: "read_desktop_database_recovery_snapshot",
    diagnosticDestination: "choose_diagnostic_export_destination_command",
    diagnosticExport: "export_desktop_diagnostics",
    managedCatalog: "read_desktop_managed_backup_catalog",
    externalSource: "choose_data_backup_external_source_command",
    backupOperation: "run_desktop_data_backup_operation",
    pendingStatus: "read_desktop_pending_restore_status",
    pendingResume: "resume_desktop_pending_restore",
    closeWindow: "plugin:window|close"
  });
  var RECOVERY_STATES = ["first-run", "restore-available", "diagnostic-required", "restore-unavailable"];
  var REASON_CODES = ["database-missing", "database-missing-after-initialization", "database-not-a-file", "database-read-failed", "database-integrity-failed", "database-foreign-key-failed", "database-schema-invalid", "database-migration-required", "database-initialization-failed", "database-initialization-marker-invalid", "storage-unavailable"];
  var DIAGNOSTIC_ERRORS = ["command-worker-failed", "command-unavailable", "storage-unavailable", "selection-store-failed", "dialog-unavailable", "dialog-response-too-large", "dialog-invalid-response", "dialog-error", "unsupported-platform", "relative-path", "invalid-path", "managed-path", "unsafe-path", "symlink-path", "path-unavailable", "path-not-file", "path-not-found", "invalid-selection", "selection-not-found", "selection-kind-mismatch", "invalid-request", "unsupported-protocol-version", "destination-exists", "diagnostics-unavailable", "log-lock-failed", "temporary-artifact-exists", "serialization-failed", "archive-too-large", "archive-write-failed", "publish-failed", "cleanup-failed", "unsafe-log-entry", "unsafe-log-directory", "log-directory-unavailable", "log-read-failed", "log-invalid", "log-file-too-large", "log-prune-failed", "internal-error"];
  var BACKUP_DIALOG_ERRORS = ["command-worker-failed", "command-unavailable", "dialog-unavailable", "dialog-error", "dialog-invalid-response", "dialog-response-too-large", "unsupported-platform", "storage-unavailable", "selection-store-failed", "invalid-path", "relative-path", "unsafe-path", "managed-path", "symlink-path", "path-unavailable", "path-not-file", "path-not-found", "destination-exists"];
  var BACKUP_OPERATION_ERRORS = ["command-worker-failed", "command-unavailable", "storage-unavailable", "selection-store-failed", "invalid-request", "unsupported-protocol-version", "managed-source-invalid", "invalid-selection", "selection-not-found", "selection-kind-mismatch", "confirmation-required", "invalid-path", "relative-path", "unsafe-path", "managed-path", "symlink-path", "path-unavailable", "path-not-file", "path-not-found", "runtime-unavailable", "sidecar-unavailable", "protocol-error", "malformed-json", "operation-not-implemented", "destination-exists", "layout-invalid", "permission-failed", "unsafe-name", "unexpected-directory", "special-file", "preflight-failed", "staging-conflict", "partial-delete", "cleanup-required", "delete-failed", "source-invalid", "destination-unavailable", "staging-failed", "quiesce-failed", "invalid-live-database", "source-changed", "backup-failed", "integrity-check-failed", "foreign-key-check-failed", "schema-read-back-failed", "schema-mismatch", "newer-schema-pending-required", "required-data-invalid", "markdown-invalid", "canvas-invalid", "search-text-mismatch", "read-back-failed", "migration-failed", "switch-failed", "reopen-failed", "rollback-failed", "publish-race", "publish-failed", "cleanup-failed", "restore-failed"];
  var PENDING_STATUS_ERRORS = ["command-worker-failed", "command-unavailable", "storage-unavailable", "runtime-unavailable", "sidecar-unavailable", "protocol-error", "pending-unavailable", "pending-invalid", "pending-multiple", "pending-extra-entry", "pending-manifest-mismatch", "pending-cleanup-required"];
  var PENDING_RESUME_ERRORS = BACKUP_OPERATION_ERRORS.concat(["pending-not-found", "pending-invalid", "pending-id-mismatch", "pending-manifest-mismatch", "pending-race", "pending-conflict", "pending-publish-failed", "pending-publish-race", "pending-cleanup-required", "pending-unavailable"]);

  var app = document.getElementById("recovery-app");
  var diagnosticButton = document.getElementById("diagnostic-button");
  var exitButton = document.getElementById("exit-button");
  var externalButton = document.getElementById("external-button");
  var managedRefresh = document.getElementById("managed-refresh");
  var pendingButton = document.getElementById("pending-button");
  var confirmation = document.getElementById("confirmation");
  var confirmRestore = document.getElementById("confirm-restore");
  var cancelRestore = document.getElementById("cancel-restore");
  var lastFocus = null;
  var recoverySnapshot = null;
  var pendingRestore = null;
  var restoreSelection = null;
  var managedSelectionButtons = [];
  var busy = false;
  var closing = false;

  function isRecord(value) { return value !== null && typeof value === "object" && !Array.isArray(value); }
  function hasExactKeys(value, keys) { if (!isRecord(value)) return false; var actual = Object.keys(value).sort(); return actual.length === keys.length && keys.slice().sort().every(function (key, index) { return actual[index] === key; }); }
  function isSafeBasename(value) { return typeof value === "string" && value.length > 0 && value.length <= 255 && value !== "." && value !== ".." && !(/[\\/\u0000-\u001f\u007f]/).test(value); }
  function isBackupId(value) { return typeof value === "string" && value.length > 0 && value.length <= 128 && /^[A-Za-z0-9._-]+$/.test(value) && value !== "." && value !== ".."; }
  function isSelectionId(value) { return typeof value === "string" && /^[a-z0-9]{64}$/.test(value); }
  function isDiagnosticSelectionId(value) { return typeof value === "string" && value.length > 0 && value.length <= 128 && /^[A-Za-z0-9._-]+$/.test(value); }
  function isPendingToken(value) { return typeof value === "string" && /^[a-f0-9]{64}$/.test(value); }
  function isCatalogTimestamp(value) { if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)) return false; var parsed = new Date(value); return !Number.isNaN(parsed.getTime()) && parsed.toISOString() === value; }
  function isOneOf(value, values) { return typeof value === "string" && values.indexOf(value) >= 0; }

  function nativeInvoke(command, args) {
    var internals = window.__TAURI_INTERNALS__;
    if (!isRecord(internals) || typeof internals.invoke !== "function") return Promise.reject();
    return Promise.resolve().then(function () { return args === undefined ? internals.invoke(command) : internals.invoke(command, args); });
  }
  function normalizeSnapshot(value) {
    if (!hasExactKeys(value, ["kind", "schemaVersion", "status", "snapshot"]) || value.kind !== "desktop-database-recovery-snapshot" || value.schemaVersion !== 1 || value.status !== "recovery" || !isRecord(value.snapshot)) return null;
    var snapshot = value.snapshot;
    if (!hasExactKeys(snapshot, ["schemaVersion", "state", "reasonCode", "managedBackupAvailable", "pendingRestoreAvailable", "canStartEmpty"]) || snapshot.schemaVersion !== 1 || !isOneOf(snapshot.state, RECOVERY_STATES) || !isOneOf(snapshot.reasonCode, REASON_CODES) || typeof snapshot.managedBackupAvailable !== "boolean" || typeof snapshot.pendingRestoreAvailable !== "boolean" || typeof snapshot.canStartEmpty !== "boolean") return null;
    if (snapshot.state === "first-run" || snapshot.canStartEmpty !== false || (snapshot.state === "restore-available" && !snapshot.managedBackupAvailable && !snapshot.pendingRestoreAvailable) || (snapshot.state === "restore-unavailable" && (snapshot.managedBackupAvailable || snapshot.pendingRestoreAvailable))) return null;
    return snapshot;
  }
  function normalizeDiagnosticSelection(value) { return hasExactKeys(value, ["kind", "selectionId", "fileName"]) && value.kind === "diagnostic-export" && isDiagnosticSelectionId(value.selectionId) && isSafeBasename(value.fileName) ? value : null; }
  function normalizeDiagnosticDestination(value) {
    if (!hasExactKeys(value, ["kind", "schemaVersion", "dialog", "operation", "status", "phase", "ok", "selection", "errorCode"]) || value.kind !== "desktop-diagnostic-dialog" || value.schemaVersion !== 1 || value.dialog !== "diagnostic-export" || value.operation !== "select-destination" || value.phase !== "dialog" || !isOneOf(value.status, ["selected", "cancelled", "error"]) || typeof value.ok !== "boolean" || !(value.selection === null || normalizeDiagnosticSelection(value.selection)) || !(value.errorCode === null || isOneOf(value.errorCode, DIAGNOSTIC_ERRORS))) return null;
    if ((value.status === "selected" && (!value.ok || value.selection === null || value.errorCode !== null)) || (value.status === "cancelled" && (value.ok || value.selection !== null || value.errorCode !== null)) || (value.status === "error" && (value.ok || value.selection !== null || value.errorCode === null))) return null;
    return { status: value.status, selection: value.status === "selected" ? value.selection : null, errorCode: value.status === "error" ? value.errorCode : null };
  }
  function normalizeDiagnosticExport(value, selectionId) {
    if (!hasExactKeys(value, ["kind", "schemaVersion", "dialog", "operation", "status", "phase", "ok", "selection", "errorCode", "result"]) || value.kind !== "desktop-diagnostic-export" || value.schemaVersion !== 1 || value.dialog !== "diagnostic-export" || value.operation !== "export" || !isOneOf(value.status, ["success", "error"]) || !isOneOf(value.phase, ["request", "validation", "archive", "publish"]) || typeof value.ok !== "boolean" || !(value.selection === null || normalizeDiagnosticSelection(value.selection)) || !(value.errorCode === null || isOneOf(value.errorCode, DIAGNOSTIC_ERRORS)) || !(value.result === null || (hasExactKeys(value.result, ["fileName", "size"]) && isSafeBasename(value.result.fileName) && Number.isSafeInteger(value.result.size) && value.result.size > 0))) return null;
    if (value.selection !== null && value.selection.selectionId !== selectionId) return null;
    if ((value.status === "success" && (!value.ok || value.phase !== "publish" || value.selection === null || value.errorCode !== null || value.result === null)) || (value.status === "error" && (value.ok || value.errorCode === null || value.result !== null))) return null;
    return { status: value.status, result: value.status === "success" ? value.result : null, errorCode: value.status === "error" ? value.errorCode : null };
  }
  function normalizeCatalog(value) {
    if (!hasExactKeys(value, ["kind", "schemaVersion", "status", "phase", "errorCode", "backups"]) || value.kind !== "desktop-managed-backup-catalog" || value.schemaVersion !== 1 || !isOneOf(value.status, ["ready", "empty", "error"]) || value.phase !== "catalog" || !(value.errorCode === null || isOneOf(value.errorCode, ["command-worker-failed", "command-unavailable", "storage-unavailable", "runtime-unavailable", "sidecar-unavailable", "protocol-error", "invalid-catalog"])) || !Array.isArray(value.backups)) return null;
    var entries = value.backups.map(function (entry) { return hasExactKeys(entry, ["backupId", "fileName", "size", "createdAt", "recoveryOnly"]) && isBackupId(entry.backupId) && entry.fileName === entry.backupId && isSafeBasename(entry.fileName) && Number.isSafeInteger(entry.size) && entry.size >= 0 && isCatalogTimestamp(entry.createdAt) && typeof entry.recoveryOnly === "boolean" ? entry : null; });
    if (entries.some(function (entry) { return entry === null; }) || (value.status === "ready" && (value.errorCode !== null || entries.length === 0)) || (value.status === "empty" && (value.errorCode !== null || entries.length !== 0)) || (value.status === "error" && (value.errorCode === null || entries.length !== 0))) return null;
    return { status: value.status, errorCode: value.errorCode, backups: entries };
  }
  function normalizeFileSelection(value) { return hasExactKeys(value, ["kind", "selectionId", "fileName"]) && value.kind === "external-file" && isSelectionId(value.selectionId) && isSafeBasename(value.fileName) ? value : null; }
  function normalizeExternalSource(value) {
    if (!hasExactKeys(value, ["kind", "schemaVersion", "dialog", "ok", "status", "phase", "selection", "errorCode"]) || value.kind !== "desktop-file-dialog" || value.schemaVersion !== 1 || value.dialog !== "open-external-source" || value.phase !== "dialog" || !isOneOf(value.status, ["selected", "cancelled", "error"]) || typeof value.ok !== "boolean" || !(value.selection === null || normalizeFileSelection(value.selection)) || !(value.errorCode === null || isOneOf(value.errorCode, BACKUP_DIALOG_ERRORS))) return null;
    if ((value.status === "selected" && (!value.ok || value.selection === null || value.errorCode !== null)) || (value.status === "cancelled" && (value.ok || value.selection !== null || value.errorCode !== null)) || (value.status === "error" && (value.ok || value.selection !== null || value.errorCode === null))) return null;
    return { status: value.status, selection: value.status === "selected" ? value.selection : null, errorCode: value.status === "error" ? value.errorCode : null };
  }
  function normalizeOperation(value, expectedOperation) {
    if (!hasExactKeys(value, ["kind", "schemaVersion", "ok", "status", "operation", "phase", "errorCode", "result"]) || value.kind !== "desktop-data-backup-operation" || value.schemaVersion !== 1 || typeof value.ok !== "boolean" || value.operation !== expectedOperation || !isOneOf(value.status, ["success", "cancelled", "error"]) || !isOneOf(value.phase, ["request", "validation", "operation", "complete"]) || !(value.errorCode === null || isOneOf(value.errorCode, BACKUP_OPERATION_ERRORS)) || value.result !== null) return null;
    if ((value.status === "success" && (!value.ok || value.errorCode !== null || value.phase !== "complete")) || (value.status === "cancelled" && (value.ok || value.errorCode !== null)) || (value.status === "error" && (value.ok || value.errorCode === null))) return null;
    return { status: value.status, errorCode: value.errorCode };
  }
  function normalizePendingStatus(value) {
    if (!hasExactKeys(value, ["kind", "schemaVersion", "status", "phase", "operationId", "errorCode", "pending"]) || value.kind !== "desktop-pending-restore-status" || value.schemaVersion !== 1 || !isOneOf(value.status, ["none", "available", "invalid"]) || value.phase !== "status" || value.operationId !== null || !(value.errorCode === null || isOneOf(value.errorCode, PENDING_STATUS_ERRORS)) || !(value.pending === null || isRecord(value.pending))) return null;
    if (value.pending !== null && (!hasExactKeys(value.pending, ["pendingId", "manifestToken", "sourceKind", "createdAt", "candidateDigest", "candidateSize", "candidateSchemaIdentity"]) || !isPendingToken(value.pending.pendingId) || !isPendingToken(value.pending.manifestToken) || !isOneOf(value.pending.sourceKind, ["managed-backup", "external-file"]) || typeof value.pending.createdAt !== "string" || !/^[a-f0-9]{64}$/.test(value.pending.candidateDigest) || !Number.isSafeInteger(value.pending.candidateSize) || value.pending.candidateSize < 1 || !/^[a-f0-9]{64}$/.test(value.pending.candidateSchemaIdentity))) return null;
    if ((value.status === "none" && (value.errorCode !== null || value.pending !== null)) || (value.status === "available" && (value.errorCode !== null || value.pending === null)) || (value.status === "invalid" && (value.errorCode === null || value.pending !== null))) return null;
    return { status: value.status, pending: value.pending };
  }
  function normalizePendingResume(value, expectedPendingId) {
    if (!hasExactKeys(value, ["kind", "schemaVersion", "ok", "status", "phase", "operationId", "pendingId", "errorCode", "result"]) || value.kind !== "desktop-pending-restore-resume" || value.schemaVersion !== 1 || typeof value.ok !== "boolean" || !isOneOf(value.status, ["success", "error"]) || !isOneOf(value.phase, ["request", "validation", "operation", "complete"]) || !(value.operationId === null || (typeof value.operationId === "string" && value.operationId.length > 0 && value.operationId.length <= 256 && !/[\\/\u0000-\u001f\u007f]/.test(value.operationId))) || value.pendingId !== expectedPendingId || !(value.errorCode === null || isOneOf(value.errorCode, PENDING_RESUME_ERRORS)) || !(value.result === null || (hasExactKeys(value.result, ["safetyBackupId", "size"]) && (value.result.safetyBackupId === null || isBackupId(value.result.safetyBackupId)) && Number.isSafeInteger(value.result.size) && value.result.size > 0))) return null;
    if ((value.status === "success" && (!value.ok || value.errorCode !== null || value.phase !== "complete" || value.result === null)) || (value.status === "error" && (value.ok || value.errorCode === null || value.result !== null))) return null;
    return { status: value.status, result: value.status === "success" ? value.result : null, errorCode: value.status === "error" ? value.errorCode : null };
  }

  function showMessage(text, kind) { var element = document.getElementById("global-message"); element.textContent = text; element.className = "message" + (kind ? " " + kind : ""); element.hidden = !text; }
  function setText(id, text) { document.getElementById(id).textContent = text || ""; }
  function reasonCopy(reasonCode) {
    if (reasonCode === "database-missing" || reasonCode === "database-missing-after-initialization") return "保存されていたデータを見つけられませんでした。診断情報を保存し、バックアップから復元できます。";
    if (["database-not-a-file", "database-read-failed", "database-integrity-failed", "database-foreign-key-failed", "database-schema-invalid"].indexOf(reasonCode) >= 0) return "保存されていたデータを読み取れませんでした。診断情報を保存してから、バックアップを確認してください。";
    if (["database-migration-required", "database-initialization-failed", "database-initialization-marker-invalid"].indexOf(reasonCode) >= 0) return "このアプリでデータを開けませんでした。診断情報を保存してから、バックアップを確認してください。";
    if (reasonCode === "storage-unavailable") return "アプリの保存領域を確認できませんでした。診断情報を保存し、アプリを終了してもう一度お試しください。";
    return "保存データの復旧が必要です。まず診断情報を保存してください。";
  }
  function setBusy(nextBusy, diagnosticText) {
    busy = nextBusy; app.setAttribute("aria-busy", String(nextBusy)); diagnosticButton.disabled = nextBusy || !recoverySnapshot; exitButton.disabled = nextBusy || closing || !recoverySnapshot; externalButton.disabled = nextBusy || !recoverySnapshot; managedRefresh.disabled = nextBusy; pendingButton.disabled = nextBusy || !pendingRestore; confirmRestore.disabled = nextBusy; cancelRestore.disabled = nextBusy; managedSelectionButtons.forEach(function (button) { button.disabled = nextBusy; }); if (diagnosticText !== undefined) setText("diagnostic-status", diagnosticText);
  }
  function diagnosticErrorCopy(code) {
    if (code === "destination-exists") return "その保存先には同名の診断情報があります。別の保存先を選んで再試行してください。";
    if (code === "log-lock-failed" || code === "temporary-artifact-exists") return "診断情報を準備できませんでした。少し待ってから再試行してください。";
    if (code === "diagnostics-unavailable" || code === "storage-unavailable") return "診断情報を保存できませんでした。保存先を変えて再試行してください。";
    return "診断情報を保存できませんでした。保存先を変えるか、少し待ってから再試行してください。";
  }
  function restoreErrorCopy() { return "バックアップを復元できませんでした。別のバックアップを選ぶか、少し待ってから再試行してください。"; }
  function formatBytes(size) { if (size < 1024) return size + " B"; if (size < 1024 * 1024) return (size / 1024).toFixed(1) + " KB"; return (size / (1024 * 1024)).toFixed(1) + " MB"; }
  function openConfirmation(selection, label) { restoreSelection = selection; lastFocus = document.activeElement; setText("confirmation-copy", "選択したバックアップ「" + label + "」で現在のアプリデータを置き換えます。よろしいですか？"); setText("restore-status", ""); confirmation.hidden = false; confirmRestore.focus(); }
  function closeConfirmation() { restoreSelection = null; confirmation.hidden = true; if (lastFocus && typeof lastFocus.focus === "function") lastFocus.focus(); }
  function renderCatalog(catalog) {
    var list = document.getElementById("backup-list"); list.replaceChildren(); managedSelectionButtons = [];
    if (catalog.status === "empty") { setText("managed-status", ""); var empty = document.createElement("li"); empty.className = "empty-copy"; empty.textContent = "利用できるバックアップがありません。外部のバックアップを選べます。"; list.appendChild(empty); return; }
    if (catalog.status === "error") { setText("managed-status", "バックアップ一覧を読み込めませんでした。外部のバックアップを選ぶか、再読み込みしてください。"); return; }
    setText("managed-status", "");
    catalog.backups.forEach(function (backup) { var item = document.createElement("li"); item.className = "backup-item"; var meta = document.createElement("div"); meta.className = "backup-meta"; var name = document.createElement("span"); name.className = "backup-name"; name.textContent = backup.fileName; var details = document.createElement("span"); details.className = "backup-details"; details.textContent = formatBytes(backup.size) + " · 保存日時 " + backup.createdAt.slice(0, 10); meta.append(name, details); var select = document.createElement("button"); select.className = "quiet-action"; select.type = "button"; select.textContent = "このバックアップを選ぶ"; select.disabled = busy; select.addEventListener("click", function () { if (!busy) openConfirmation({ kind: "managed-backup", backupId: backup.backupId }, backup.fileName); }); managedSelectionButtons.push(select); item.append(meta, select); list.appendChild(item); });
  }
  function loadCatalog() { setText("managed-status", "バックアップ一覧を読み込んでいます…"); return nativeInvoke(COMMANDS.managedCatalog).then(function (value) { var catalog = normalizeCatalog(value); renderCatalog(catalog || { status: "error", backups: [] }); }, function () { renderCatalog({ status: "error", backups: [] }); }); }
  function loadPendingStatus() {
    setText("pending-status", "保留中の復元を確認しています…");
    return nativeInvoke(COMMANDS.pendingStatus).then(function (value) { var status = normalizePendingStatus(value); if (!status || status.status === "invalid") { pendingRestore = null; document.getElementById("pending-section").hidden = true; setText("pending-status", "保留中の復元を確認できませんでした。別のバックアップを選ぶか、少し待ってから再試行してください。"); return; } if (status.status === "none") { pendingRestore = null; document.getElementById("pending-section").hidden = true; return; } pendingRestore = { pendingId: status.pending.pendingId, manifestToken: status.pending.manifestToken }; document.getElementById("pending-section").hidden = false; setText("pending-status", ""); pendingButton.disabled = busy ? true : false; }, function () { pendingRestore = null; document.getElementById("pending-section").hidden = true; setText("pending-status", "保留中の復元を確認できませんでした。少し待ってから再試行してください。"); });
  }
  function loadRecoveryOptions(snapshot) {
    var panel = document.getElementById("recovery-panel"); panel.hidden = false; externalButton.disabled = false; if (snapshot.state === "restore-available") setText("recovery-copy", "バックアップを確認してから、復元を実行できます。元のデータは確認後の処理で扱われます。"); else setText("recovery-copy", "利用できるバックアップがあれば、確認してから復元できます。"); document.getElementById("managed-section").hidden = !snapshot.managedBackupAvailable; document.getElementById("pending-section").hidden = !snapshot.pendingRestoreAvailable; var tasks = []; if (snapshot.managedBackupAvailable) tasks.push(loadCatalog()); if (snapshot.pendingRestoreAvailable) tasks.push(loadPendingStatus()); return Promise.all(tasks);
  }
  function loadSnapshot() { return nativeInvoke(COMMANDS.snapshot).then(function (value) { var snapshot = normalizeSnapshot(value); if (!snapshot) return Promise.reject(); recoverySnapshot = snapshot; setText("reason-copy", reasonCopy(snapshot.reasonCode)); diagnosticButton.disabled = false; exitButton.disabled = false; externalButton.disabled = false; return loadRecoveryOptions(snapshot); }); }
  function failClosed() { recoverySnapshot = null; app.setAttribute("aria-busy", "false"); document.getElementById("recovery-panel").hidden = true; document.getElementById("confirmation").hidden = true; document.getElementById("terminal").hidden = false; diagnosticButton.disabled = true; externalButton.disabled = true; exitButton.disabled = true; setText("reason-copy", "復旧画面を準備できませんでした。アプリを終了してもう一度お試しください。"); }
  function closeWindow() { if (closing) return Promise.resolve(false); closing = true; exitButton.disabled = true; setText("exit-status", "ウィンドウを閉じています…"); return nativeInvoke(COMMANDS.closeWindow, { label: "primary" }).then(function () { return true; }, function () { closing = false; exitButton.disabled = busy || !recoverySnapshot; setText("exit-status", "ウィンドウを閉じられませんでした。右上の閉じる操作で終了してください。"); return false; }); }
  function exportDiagnostics() {
    if (busy || !recoverySnapshot) return; setBusy(true, "診断情報の保存先を選択しています…"); showMessage("");
    nativeInvoke(COMMANDS.diagnosticDestination).then(function (value) { var destination = normalizeDiagnosticDestination(value); if (!destination || destination.status !== "selected") { if (destination && destination.status === "cancelled") setText("diagnostic-status", "保存先の選択をキャンセルしました。"); else showMessage(diagnosticErrorCopy(destination && destination.errorCode), "error"); setBusy(false); return null; } setText("diagnostic-status", "診断情報を作成しています…"); return nativeInvoke(COMMANDS.diagnosticExport, { request: { schemaVersion: 1, operation: "export", selectionId: destination.selection.selectionId } }).then(function (exportValue) { var result = normalizeDiagnosticExport(exportValue, destination.selection.selectionId); if (!result || result.status !== "success") { showMessage(diagnosticErrorCopy(result && result.errorCode), "error"); setBusy(false); return null; } showMessage("診断情報を保存しました: " + result.result.fileName, "success"); setText("diagnostic-status", "保存が完了しました。ウィンドウを閉じています…"); return closeWindow(); }, function () { showMessage(diagnosticErrorCopy(), "error"); setBusy(false); return null; }); }, function () { showMessage(diagnosticErrorCopy(), "error"); setBusy(false); return null; });
  }
  function chooseExternalSource() { if (busy || !recoverySnapshot) return; setBusy(true, "バックアップを選択しています…"); nativeInvoke(COMMANDS.externalSource).then(function (value) { var source = normalizeExternalSource(value); setBusy(false); if (!source || source.status !== "selected") { if (source && source.status === "cancelled") setText("external-status", "バックアップの選択をキャンセルしました。"); else setText("external-status", "バックアップを選べませんでした。もう一度お試しください。"); return; } setText("external-status", ""); openConfirmation({ kind: "external-selection", selectionId: source.selection.selectionId }, source.selection.fileName); }, function () { setBusy(false); setText("external-status", "バックアップを選べませんでした。もう一度お試しください。"); }); }
  function restoreSelected() {
    if (busy || !restoreSelection) return; setBusy(true, ""); setText("restore-status", "復元しています…");
    var operation;
    if (restoreSelection.kind === "pending-restore") {
      operation = nativeInvoke(COMMANDS.pendingResume, { request: { schemaVersion: 1, pendingId: restoreSelection.pendingId, manifestToken: restoreSelection.manifestToken, confirmed: true } }).then(function (value) { return normalizePendingResume(value, restoreSelection.pendingId); });
    } else {
      var request = { schemaVersion: 1, operation: "restore", source: restoreSelection, destination: null, confirmed: true };
      operation = nativeInvoke(COMMANDS.backupOperation, { request: request }).then(function (value) { return normalizeOperation(value, "restore"); });
    }
    operation.then(function (result) { if (result && result.status === "success") { setText("restore-status", "復元が完了しました。ノートを開いています…"); confirmRestore.disabled = true; cancelRestore.disabled = true; return; } setText("restore-status", restoreErrorCopy()); setBusy(false); }, function () { setText("restore-status", restoreErrorCopy()); setBusy(false); });
  }

  diagnosticButton.addEventListener("click", exportDiagnostics);
  exitButton.addEventListener("click", function () { if (!busy && recoverySnapshot) closeWindow(); });
  externalButton.addEventListener("click", chooseExternalSource);
  managedRefresh.addEventListener("click", function () { if (!busy) loadCatalog(); });
  pendingButton.addEventListener("click", function () { if (pendingRestore) openConfirmation({ kind: "pending-restore", pendingId: pendingRestore.pendingId, manifestToken: pendingRestore.manifestToken }, "保留中のバックアップ"); });
  confirmRestore.addEventListener("click", restoreSelected);
  cancelRestore.addEventListener("click", closeConfirmation);
  setBusy(true, "復旧画面を準備しています…");
  loadSnapshot().then(function () { setBusy(false, ""); }, failClosed);
}());
