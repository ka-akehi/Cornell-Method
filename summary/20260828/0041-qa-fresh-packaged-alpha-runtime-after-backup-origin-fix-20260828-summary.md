# Fresh packaged alpha runtime QA summary

作成日: 2026-08-28（JST）  
対象: BUILD_ID `JrSkDiiD_Hp4755lZJsra` を含む Apple Silicon packaged alpha

## Objective

修正込みの fresh packaged alpha を、実ユーザーデータに触れない disposable 環境で runtime QA し、実行できた項目と環境制約で確認できなかった項目を PASS / FAIL / BLOCKED に分類する。

## Inputs Read

先行 build summary、`HANDOFF_2026-08-22.md`、packaged app / DMG、packaged runtime の sidecar launcher を確認した。

### Scope

- app: `/private/tmp/cornell-method-tauri-target-current-source-after-backup-origin-fix-20260828/release/aarch64-apple-darwin/release/bundle/macos/Cornell Method Notebook.app`
- DMG: `/private/tmp/cornell-method-tauri-target-current-source-after-backup-origin-fix-20260828/release/aarch64-apple-darwin/release/bundle/dmg/Cornell Method Notebook_0.1.0_aarch64.dmg`
- disposable root: `/private/tmp/cornell-method-packaged-runtime-qa-20260828.BvG9lY`
- disposable user data: `CORNELL_DESKTOP_HOME=$QA_ROOT/home`。bootstrap が作成した SQLite、settings、logs、backups、pending-restore だけを使用した。
- app の install / replace、実ユーザー home / SQLite、外部サービス、restore / delete、source/config/dependency/lockfile/generated artifact の変更は行っていない。

## Changes Made

source/config/dependency/lockfile/generated artifact は変更していない。今回意図して追加したリポジトリ内ファイルはこの QA summary のみである。disposable root と短いログは `/private/tmp` に作成した。

## Findings

### Artifact provenance

| 確認 | 結果 |
|---|---|
| app bundle / DMG existence | PASS |
| main executable | PASS: Mach-O 64-bit arm64 |
| bundle identifier / version | PASS: `com.cornellmethod.notebook` / `0.1.0` |
| BUILD_ID | PASS: packaged `.next/BUILD_ID` = `JrSkDiiD_Hp4755lZJsra` |
| main executable SHA-256 | PASS: `7210a160a24b729ac6e2986bbd72793f841106154a3b131a1afad1a97a1518bb` |
| DMG SHA-256 | PASS: `9a2181e73cbd8b3db9265ca762c5a8e4462482cb8afa58b4ce29d7f0e0e3e058` |
| ad-hoc codesign verify | PASS: `codesign --verify --deep --strict` |
| DMG image verify | PASS: `hdiutil verify` = `VALID`。これは fallback UDZO DMG の image integrity 確認である。 |

### Operations and evidence

1. 作業前に `git status --short` を実行し、既存の `HANDOFF_2026-08-22.md`、`src-tauri` / `src/modules` の未コミット変更、既存 summary 群を確認した。これらは保持した。
2. packaged `runtime/sidecar/launcher.cjs paths`、`bootstrap`、`validate-database` を、専用 `CORNELL_DESKTOP_HOME` と packaged runtime root で実行した。storage path は disposable root 配下に解決され、bootstrap / validation は rc=0、`status=ready` だった。
3. `DATABASE_URL=file:<disposable>/.../live/notebook.sqlite` を注入して packaged `launcher.cjs serve` を実行した。sidecar PID `67705` は ready line 前に終了し、stderr は `listen EPERM: operation not permitted 127.0.0.1`。runtime child PID、port、health response は生成されなかった。なお事前の env 未設定 probe PID `63142` は fail-closed の `DATABASE_URL must be an absolute file: URL` で終了した。
4. app bundle の main executable を、`HOME`、`TMPDIR`、XDG paths、`CORNELL_DESKTOP_HOME` の全てを専用 root に向けて foreground 直接起動した。rc=134（SIGABRT）、stdout/stderr は空、window / sidecar ready は得られなかった。
5. packaged `better-sqlite3` で disposable DB に Markdown（body / summary）、Cue、Tag relation と Canvas（`body_mode=canvas`、empty legacy body、CanvasDocumentV1、text/searchText）を書き、close → reopen → read-back した。read-back は一致し、`validate-database` も `status=ready` だった。初回 SQL probe の `order` 列未引用による syntax error は transaction rollback 後、テストコマンドを修正して再実行したものであり、製品の runtime failure とは扱わない。
6. Browser runtime は `No browser is available`。Computer Use の app-state 取得は `Computer Use was not approved to use Cornell Method Notebook` で拒否された。いずれも endpoint / GUI の実証には使用できなかった。
7. fallback DMG に対し `hdiutil attach -readonly -nobrowse -mountpoint <disposable mount> <DMG>` を一度だけ実行した。rc=1、exact error は `hdiutil: attach failed - 装置が構成されていません`。mount point は空で、DMG 内 app / Applications link の read-back はできなかった。
8. 既知 sidecar PID `63142` / `67705` は終了済み。target listener は確認されず、`.sqlite-wal` / `.sqlite-shm` / `.sqlite-journal` も残らなかった。failed app start 後の disposable settings には `.instance.lock` と `.instance.owner` が残ったため、正常終了時 cleanup の証明には使わない。`ps` は runner の `operation not permitted` で利用できなかった。

### Runtime QA result

| 項目 | 判定 | 根拠 / 境界 |
|---|---|---|
| app direct startup | FAIL | disposable env で rc=134 / SIGABRT。window と sidecar ready へ進まなかった。 |
| packaged storage bootstrap / SQLite validation | PASS | packaged launcher の実行で disposable path、初回 DB、`status=ready` を確認。 |
| sidecar Node health / ready handshake | BLOCKED | sidecar が `listen EPERM: operation not permitted 127.0.0.1` で bind 前に終了。 |
| dynamic loopback reachability | BLOCKED | dynamic port / ready URL が得られず、host の loopback bind 制約を確認。 |
| GUI main screen | BLOCKED | app が SIGABRT。Computer Use も app-state を承認されず、表示証拠なし。 |
| Settings bridge | BLOCKED | GUI window がないため bridge 操作証拠なし。 |
| Data and Backup display | BLOCKED | GUI window がないため表示証拠なし。 |
| current MVP note display | BLOCKED | packaged HTTP server が起動せず、Browser runtime も unavailable。 |
| browser/API explicit save and read-back | BLOCKED | endpoint と browser が利用できず、static route / direct SQLite smoke は代替にしない。 |
| backup same-origin state-changing request | BLOCKED | `/api/backups` に到達できず、403 でないことの実 response 証拠なし。 |
| disposable Markdown/Cue/Summary/Canvas direct DB read-back | PASS | packaged runtime の write → close → reopen → read-back。一方、GUI/API PASS ではない。 |
| normal exit / restart / owner/socket/sidecar cleanup | BLOCKED | successful app start がなく、Cmd-Q / window close / restart を実行できない。failed-start 後の既知 PID は終了済みだが、`.instance.owner` が残った。 |
| DMG mount / app read-back | BLOCKED | fallback DMG の `hdiutil attach` が device configuration error。`hdiutil verify` PASS とは分離。 |

## Verification

上表の PASS は実行時証拠がある項目だけに限定し、static inspection や直接 SQLite smoke を GUI / API runtime PASS の代替にしていない。作業前後の `git status --short` と scoped status を確認し、既存の未コミット変更を保持した。

## Remaining Unknowns

### Failures and next task

現時点で packaged app direct startup は FAIL、sidecar/loopback、GUI、API、lifecycle、DMG mount は host / runner 制約により BLOCKED と記録する。FAIL と BLOCKED を Alpha acceptance の同一根拠として混同しない。

最小の次 task は、GUI 起動、`127.0.0.1` bind、DMG device attach が許可された macOS host で、この artifact と同じ disposable env を再実行すること。そこで app rc=134 が再現した場合だけ crash report を採取し、候補箇所を `src-tauri/src/main.rs`、`src-tauri/src/instance.rs`、`src-tauri/src/runtime.rs` に絞って別修正 task を切り出す。今回の QA では修正を行わない。

### Repository provenance

- 作業後の scoped `git status --short` / `git diff --name-only` で、`src-tauri`、`src/modules`、`package.json`、`package-lock.json`、`prisma`、`config`、`next.config.ts`、`prisma.config.ts`、`src/generated` に今回の追加変更がないことを確認した。
- 作業前から存在した未コミット変更は保持した。今回意図して追加したリポジトリ内ファイルはこの QA summary のみで、source/config/dependency/lockfile/generated artifact は変更していない。
- 作業後も `git status --short` を実行して最終状態を確認する。disposable root と短いログは `/private/tmp` に保持し、実ユーザーデータには到達していない。

## Next Read

- `summary/20260828/0041-qa-fresh-packaged-alpha-runtime-after-backup-origin-fix-20260828-summary.md`
- `summary/20260828/0034-build-fresh-packaged-current-source-after-backup-origin-fix-20260828-22f829b2-summary.md`
- `HANDOFF_2026-08-22.md`
- disposable evidence root: `/private/tmp/cornell-method-packaged-runtime-qa-20260828.BvG9lY`
