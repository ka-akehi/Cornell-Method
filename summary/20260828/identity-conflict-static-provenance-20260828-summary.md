---
summary_type: task-summary
created_at: 2026-08-28 JST
task_kind: worker-task
task_status: done
---

## Objective

Exact fresh packaged app の BUILD_ID identity conflict を、source build output、Tauri resource mapping、packaged resource、既存 summary の記録値と read-only で照合した。

## Scope and preservation

- 対象 app: `/private/tmp/cornell-method-tauri-target-runtime-qa-20260828/aarch64-apple-darwin/release/bundle/macos/Cornell Method Notebook.app`
- app 起動、GUI、loopback bind、HTTP request、外部接続は未実施。
- source、設定、依存関係、lockfile、DB、alias、既存 artifact、既存 summary は変更していない。
- 新規作成ファイルは本 summary のみ。

## BUILD_ID comparison

| source / record | path or source | value | byte length | mtime | result |
|---|---|---:|---:|---|---|
| source build output | `.next/BUILD_ID` | `EDrKC5_Fdl3X2g1DpD5ud` | 21 | 2026-08-28 11:26:45 +0900 | fact |
| packaged runtime resource | `Contents/Resources/runtime/.next/BUILD_ID` | `EDrKC5_Fdl3X2g1DpD5ud` | 21 | 2026-08-28 11:26:45 +0900 | fact; bytes identical to source |
| fresh packaged QA summary | `summary/20260828/fresh-packaged-runtime-qa-20260828-summary.md` | `EDrKC5_Fdl3X2g1DpD5udDMG` | 25 as recorded | recorded value only | conflicts with artifact |
| rebuild summary | `summary/20260828/1144-rebuild-current-packaged-alpha-for-runtime-qa-20260828-275c316f-summary.md` | `EDrKC5_Fdl3X2g1DpD5udDMG` | 25 as recorded | recorded value only | conflicts with artifact |

The recorded suffix `DMG` was not present in either inspected BUILD_ID file. It was not inferred or corrected.

## Resource mapping and app identity

`src-tauri/tauri.conf.json` maps `../.next/BUILD_ID` to `runtime/.next/BUILD_ID`; this matches the observed source and packaged paths. The exact app also has:

- bundle ID: `com.cornellmethod.notebook`
- executable: Mach-O 64-bit `arm64`
- main executable SHA-256: `e20cb89195e0794a9e2ff17386524524640744dfbe7d67343b6990fc13dbe38d`
- app mtime: 2026-08-28 11:40:07 +0900

## Classification

| hypothesis | classification | evidence |
|---|---|---|
| source/build output と bundle resource の不一致 | NOT SUPPORTED | values, bytes, lengths, and mtimes match |
| bundle 内 stale BUILD_ID | NOT SUPPORTED by inspected artifact | packaged resource is identical to current `.next/BUILD_ID` |
| packaging mapping 差分 | NOT SUPPORTED | config mapping directly corresponds to observed packaged path and value |
| build/QA summary の記録誤り | MOST SUPPORTED, not fully proven | both summaries contain the same extra suffix while both artifacts contain the 21-byte source value |
| exact工程での provenance / summary生成経路 | UNKNOWN | no authoritative manifest or raw log was read; no suffix provenance was found |

The safe final classification is: **artifact-side identity conflict is not reproduced; summary-record conflict is most supported; root provenance remains UNKNOWN**.

## Same-origin 403 boundary

This static evidence does not prove that the BUILD_ID conflict caused the same-origin HTTP 403. The prior runtime investigation remains blocked before request observation by host `127.0.0.1` bind `EPERM`; no WebView origin, request headers, response status/body, or Tauri invoke result was observed.

## Verification

- Before and after `git status --short` checked; pre-existing changes preserved.
- Source and packaged BUILD_ID raw bytes, byte lengths, paths, and mtimes compared.
- `tauri.conf.json` resource mapping checked.
- Exact app bundle ID, arm64 executable format, and main executable hash rechecked.
- No build, code change, app launch, network request, or artifact replacement performed.

## Next Read

- `summary/20260828/identity-conflict-static-provenance-20260828-summary.md`
- `HANDOFF_2026-08-28.md`
- `summary/20260828/fresh-packaged-runtime-qa-20260828-summary.md`

## Runtime QA resume conditions

Use the same exact app after moving to a permissive macOS host that allows disposable `127.0.0.1` bind. Record the running app's BUILD_ID, sidecar ready URL/port, WebView `location.origin`, Tauri internals/invoke outcome, request `Origin`/`Referer`, redacted 403 response, and note/backup read-back. Do not alter proxy guards or packaging identity to work around this unresolved conflict.
