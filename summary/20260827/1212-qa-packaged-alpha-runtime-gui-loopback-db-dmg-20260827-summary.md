---
summary_type: task-summary
created_at: 2026-08-27 12:12 JST
task_kind: worker-task
task_status: done
---

## Objective

生成済みの Apple Silicon packaged alpha を、実ユーザーデータを使わない disposable 環境で起動・sidecar・loopback・GUI・DB read-back・終了経路・DMG mount の順に確認した。実行時に確認できた項目と、runner の環境制約で確認できなかった項目を分離した。

## Scope

| 項目 | 内容 |
|---|---|
| 対象 artifact | `/private/tmp/cornell-method-tauri-target-current-source-prior-settings-escalated-20260827/release/aarch64-apple-darwin/release/bundle/macos/Cornell Method Notebook.app`、同 `bundle/dmg/Cornell Method Notebook_0.1.0_aarch64.dmg` |
| disposable user data | `/private/tmp/cornell-method-packaged-runtime-qa-20260827.les9Lo`、`/private/tmp/cornell-method-packaged-gui-qa-20260827.uuSmZH`。`HOME`、`CORNELL_DESKTOP_HOME`、`TMPDIR`、XDG paths を専用配下へ設定 |
| 対象外 | app のインストール・置換、実ユーザー home / SQLite、外部サービス、source/config/dependency/lockfile/generated artifact の変更、destructive な note 操作 |

## Inputs Read

| 種別 | パス | 確認内容 |
|---|---|---|
| handoff | `HANDOFF_2026-08-22.md` | packaged runtime / GUI / loopback / DB read-back が未検証であること、現行 MVP / Desktop Alpha 境界 |
| prior summary | `summary/20260827/1158-build-fresh-packaged-current-source-prior-settings-escalated-20260827-summary.md` | 対象 artifact、arm64 runtime、fallback DMG、既知の mount / loopback 制約 |
| prior summary | `summary/20260827/1200-rebuild-current-packaged-alpha-after-lifecycle-fix-escalated-20260827-70d789fe-summary.md` | 直前 build の provenance と未確認項目 |
| runtime/config | `package.json`、`src-tauri/tauri.conf.json`、`src-tauri/src/runtime.rs`、`src-tauri/sidecar/launcher.cjs`、`src/app/api/desktop/health/route.ts` | packaged resource root、Node launcher、health handshake、storage env、health route |

## Changes Made

| パス | 変更内容 | 理由 |
|---|---|---|
| `summary/20260827/1212-qa-packaged-alpha-runtime-gui-loopback-db-dmg-20260827-summary.md` | この QA の結果だけを追加 | 実行時証跡、BLOCKED 理由、次 task を記録 |
| source/config/dependency/lockfile/generated artifact | 変更なし | QA task の制約を維持 |
| disposable roots | QA 中に作成。プロセス終了後も `/private/tmp` に証跡として保持し、今回作成した root 以外は削除していない | 実ユーザーデータを汚さず、raw log を repository summary に転記しないため |

## Findings

| ID | fact / assumption / unknown | 内容 | 根拠 |
|---|---|---|---|
| F-001 | fact | 対象 app bundle は存在し、`Contents/MacOS/cornell-method-notebook` は Mach-O arm64。Info.plist の bundle ID は `com.cornellmethod.notebook`。ad-hoc codesign verify は PASS。 | `file`、`plutil`、`codesign --verify --deep --strict` |
| F-002 | fact | fallback DMG は `hdiutil verify` が VALID。read-only attach は `hdiutil: attach failed - 装置が構成されていません` で終了した。 | `hdiutil verify`、`hdiutil attach -readonly -nobrowse -mountpoint ...` |
| F-003 | fact | packaged runtime の `launcher.cjs bootstrap` は rc=0、`status=ready`、初回 disposable SQLite を作成。`validate-database` も rc=0 / `status=ready`。 | 同梱 `runtime/node` と `runtime/sidecar/launcher.cjs` の実行結果 |
| F-004 | fact | `launcher.cjs serve` は ready line を出さず、`listen EPERM: operation not permitted 127.0.0.1` で rc=1。port、runtime child PID は生成されなかった。 | disposable sidecar の stdout/stderr、既知 PID の終了状態 |
| F-005 | fact | packaged `better-sqlite3`（Node v24.14.0 / arm64）で disposable DB に Markdown note（body/summary/Cue）と Canvas note（`body=""`、CanvasDocumentV1、text/searchText）を書き、close → reopen → read-back を一致確認。再検証後の `validate-database` も PASS。 | packaged Node の transaction smoke script と DB validation |
| F-006 | fact | direct packaged app foreground launch は rc=134（SIGABRT）、stdout/stderr は空で window を表示しなかった。専用 `HOME` / `CORNELL_DESKTOP_HOME` を使用したため実ユーザー data には到達していない。 | app binary の実行結果、disposable settings 配下の生成物 |
| F-007 | fact | Browser runtime は setup 後も候補なし（`agent.browsers.list()` は空）。Computer Use の app 一覧にも Cornell app はなく、real home での自動 launch を避けるため `get_app_state` は実行しなかった。 | Browser bootstrap/list、`sky.list_apps()` |
| F-008 | fact | 既知 PID の direct app / sidecar は終了済み。loopback listener と lock holder は確認されなかった。一方、SIGABRT の failed start では disposable settings に `.instance.owner` が残ったため、正常終了時の owner/socket cleanup は証明できない。安全機構が削除コマンドを拒否したため、disposable root/log は保持している。 | `kill -0`、`lsof`、disposable settings tree、cleanup command rejection |
| F-009 | fact | 作業前 status と作業後 status を比較し、既存の `HANDOFF_2026-08-22.md`、`src-tauri/src/lifecycle.rs` の変更と既存 summary 群以外に source/config/dependency/lockfile/generated artifact の変更はない。追加はこの summary のみ。 | 作業前後 `git status --short`、scoped status、Worker provenance |

## Verification

| 確認項目 | 結果 | 備考 |
|---|---|---|
| app path / arm64 / bundle identifier | PASS | 実 artifact の `file` / `plutil` で確認 |
| app direct startup | FAIL | isolated env の foreground 実行が rc=134 / SIGABRT。window / sidecar ready には進まない |
| packaged bootstrap / storage initialization | PASS | disposable Application Support と SQLite のみを作成 |
| sidecar Node health / ready | BLOCKED | `127.0.0.1` bind が runner の EPERM。ready/health response は取得不可 |
| dynamic loopback reachability | BLOCKED | sidecar が bind 前に終了 |
| GUI main screen | BLOCKED | app が SIGABRT、Computer Use の app 登録なし |
| Settings bridge / Data and Backup display | BLOCKED | GUI window がないため操作証拠なし |
| current MVP note display / explicit API save / API read-back | BLOCKED | HTTP server が起動せず、Browser も利用不可。static route check は runtime PASS として扱わない |
| disposable DB write/read-back | PASS | packaged better-sqlite3 の直接 transaction smoke。API/UI read-back とは分離して記録 |
| normal exit / restart / sidecar cleanup / orphan process | BLOCKED | successful app start がなく Cmd-Q / window close / restart を実行できない。failed-start 後の既知 PID は終了、listener なし |
| DMG mount/read-back | BLOCKED | `hdiutil attach` が device 制約で失敗。`hdiutil verify` のみ PASS |
| repository change / provenance | PASS | source/config/dependency/lockfile/generated artifact 変更なし。summary は Worker provenance から除外される運用対象 |
| disposable process/file cleanup | PASS (processes) / BLOCKED (files) | 既知 PID は終了済み。作成 root/log/pointer は `/private/tmp` に保持（安全機構が `rm -rf` を拒否）し、target app/DMG は変更なし |

## Remaining Unknowns

| ID | 未確認事項 | 次に必要な根拠 |
|---|---|---|
| U-001 | packaged sidecar の実 ready health、child PID/親子 lifecycle、動的 loopback、API save/read-back | `127.0.0.1` bind が許可された macOS host で同じ disposable env を再実行 |
| U-002 | GUI main screen、Settings bridge、Data and Backup、current MVP の UI 明示保存 / read-back | GUI session と isolated home が両立する host で direct app を再実行。Browser extension が必要な場合はローカル URL だけを対象にする |
| U-003 | 正常 Cmd-Q / window close / restart 後の owner/socket/sidecar cleanup | successful app start 後に PID tree、socket、DB `-wal/-shm/-journal` を before/after 比較 |
| U-004 | DMG 内の app / Applications link の read-back | device/mount が使用可能な host で `hdiutil attach -readonly` を一度実行 |
| U-005 | rc=134 が runner/AppKit 環境だけか、packaged app の再現性があるか | permissive host で再現確認。再現時だけ macOS crash report を根拠に `src-tauri/src/main.rs` / `src-tauri/src/instance.rs` / `src-tauri/src/runtime.rs` の最小修正 task を切り出す |

## Next Read

次に読むべき最小ファイルだけを記載する。

- `summary/20260827/1212-qa-packaged-alpha-runtime-gui-loopback-db-dmg-20260827-summary.md`
- `HANDOFF_2026-08-22.md`
- `src-tauri/src/main.rs`
- `src-tauri/src/runtime.rs`
- `src-tauri/sidecar/launcher.cjs`
