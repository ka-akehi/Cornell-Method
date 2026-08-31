---
summary_type: task-summary
created_at: 2026-08-28 JST
task_kind: worker-task
task_status: done
---

## Objective

current source の sanitized focus-endpoint error observability を含む、Web Inspector feature と runtime opt-in 付きの fresh Apple Silicon diagnostic app を、既存 artifact と分離して生成・検証した。

## Artifact

- exact app: `/private/tmp/cornell-method-tauri-target-devtools-error-observability-20260828/aarch64-apple-darwin/release/bundle/macos/Cornell Method Notebook.app`
- target: `aarch64-apple-darwin`
- `CFBundleIdentifier`: `com.cornellmethod.notebook`
- `CFBundleExecutable`: `cornell-method-notebook`
- executable: Mach-O 64-bit `arm64`
- packaged `runtime/.next/BUILD_ID`: `EDrKC5_Fdl3X2g1DpD5ud`
- main executable SHA-256: `3fb0b9f12249e14f2df3528855ea25ac15715d25e6f7a29abc834eb0d7e84e7b`
- codesign: ad-hoc (`Signature=adhoc`); `codesign --verify --deep --strict`: PASS

## Build

Used a new `CARGO_TARGET_DIR` at `/private/tmp/cornell-method-tauri-target-devtools-error-observability-20260828`:

```sh
CARGO_TARGET_DIR=/private/tmp/cornell-method-tauri-target-devtools-error-observability-20260828 \
  cargo tauri build --target aarch64-apple-darwin --bundles app --ci \
  --features diagnostic-web-inspector \
  --config '{"build":{"beforeBuildCommand":""}}'
```

The build completed successfully. The feature mapping remains `diagnostic-web-inspector = ["tauri/devtools"]`; runtime opt-in remains exact `CORNELL_DESKTOP_DIAGNOSTIC_WEB_INSPECTOR=1`. The normal release default feature set was not changed.

Packaged resources checked: `runtime/node`, `runtime/package.json`, `runtime/node_modules`, `runtime/sidecar/launcher.cjs`, `runtime/.next/BUILD_ID`, `.next/server`, `.next/static`, `runtime/prisma`, `runtime/config/project-env.js`, generated sources, and desktop storage module.

## Error observability

Static packaged-binary inspection found the diagnostic marker and the sanitized `socket-connect`, `metadata-lookup`, and `raw_os_error` strings. Source tests verify that `Unavailable` diagnostics contain `stage=...`, sanitized `kind=...`, and numeric `raw_os_error=...` or `raw_os_error=unset`, without the endpoint path.

Focused fresh-target Rust tests:

- `cargo test ... --features diagnostic-web-inspector instance::tests`: 21 passed, 0 failed
- `unavailable_endpoint_diagnostic_is_structured_and_path_free`: included and passed
- `cargo fmt --manifest-path src-tauri/Cargo.toml -- --check`: PASS
- `git diff --check`: PASS
- desktop devtools/capability contract tests: 8 passed, 0 failed

## Disposable launch

Launch command used the fresh app with disposable `HOME`, `CORNELL_DESKTOP_HOME`, and `TMPDIR`, plus `CORNELL_DESKTOP_DIAGNOSTIC_WEB_INSPECTOR=1`. The Worker host emitted `nice(5) failed: operation not permitted`; no focus-endpoint sanitized error was emitted to stderr before the single bounded launch was terminated. Therefore the focus-endpoint runtime string was not observed in this host. GUI, Safari/Web Inspector, WebView, sidecar readiness, loopback binding, HTTP/API, and SQLite read-back remain unverified.

## Scope and changes

No repository source/config/lockfile changes were made by this task. Existing uncommitted changes were preserved. `src-tauri/tauri.conf.json` and `src-tauri/Cargo.lock` remained clean relative to the task start; capability, permission, proxy, API, DB schema, regular artifact, old diagnostic artifact, `Notebook.app` alias, and user data were not modified or used.

The only intentional repository file added by this task is this summary. No commit was created. The diagnostic target/output and disposable runtime are outside the repository.

## Next Read

- `summary/20260828/worker-diagnostic-error-observability-build-20260828-summary.md`
- `summary/20260828/worker-single-instance-error-observability-20260828-summary.md`
- `HANDOFF_2026-08-28.md`
