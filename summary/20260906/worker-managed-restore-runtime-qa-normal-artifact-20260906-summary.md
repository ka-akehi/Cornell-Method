---
summary_type: task-summary
created_at: 2026-09-06 JST
task_kind: worker-task
task_status: blocked
---

## Objective

指定された exact normal packaged `.app` を disposable 環境から起動し、Settings の managed restore と restore 後の GUI / DB read-back を確認する。

## Scope

exact normal packaged artifact、packaged sidecar / loopback、Computer Use primary WebView、Settings の managed backup catalog、restore lifecycle、disposable SQLite / backup metadata を対象とした runtime QA。source 修正、設定変更、artifact 再生成、実ユーザーデータへのアクセスは対象外。

## Inputs Read

- 指定された exact artifact と `Notebook.app` の bundle identity。
- disposable fixture 用の既存 desktop storage helper と managed catalog / restore contract。
- packaged runtime の sidecar launcher と runtime startup 境界。
- 作業前の `git status --short` と既存の 2026-09-06 runtime / rebuild summary。

## Changes Made

- source、設定、依存関係、lockfile、DB schema、`Notebook.app`、exact artifact は変更していない。
- 検証用 fixture は repo 外の `/private/tmp` 配下だけに作成し、検証後に削除した。
- 作業成果物としてこの summary のみを追加した。変更 provenance は Worker helper の対象である。
- restore 操作は GUI 到達前に停止したため、送信していない。同じ restore の自動再送もない。

## Findings

| ID | 判定 | 内容 | 根拠 |
|---|---|---|---|
| F-001 | PASS | exact artifact `/private/tmp/cornell-method-normal-runtime-qa-8Gdmh6/tauri-target/aarch64-apple-darwin/release/bundle/macos/Cornell Method Notebook.app` は `BUILD_ID=fIB1qs8IxwiH_P23PYXae`、main executable SHA-256=`f8d8403e4f8fbbcdc7c7224a49f48022ba845d18d104d2491f1f9b096e2cb366`、Mach-O arm64、bundle ID / version=`com.cornellmethod.notebook` / `0.1.0` で指定値と一致した。`Notebook.app` symlink も同一 artifact を指した。 | 起動前後の読み取り専用 identity check |
| F-002 | PASS | disposable fixture の live DB は A、managed user backup は A/B の2件で、B が deterministic order の先頭になった。B の Canvas、Cue、Tag、searchText の構造 read-back と source bytes の事前 digest 不変を確認した。 | repo の storage fixture と SQLite read-only query |
| F-003 | PASS | exact artifact 内の packaged Node / sidecar の read-only catalog command は `ready` を返し、B が先頭、recovery-only entry は通常 catalog に含まれなかった。 | packaged `launcher.cjs managed-backup-catalog` |
| F-004 | BLOCKED | exact executable の direct startup は `rc=134` / Abort trap で終了し、sidecar ready、primary window、WebView には到達しなかった。 | disposable env での exact executable 起動 |
| F-005 | BLOCKED | exact artifact の packaged sidecar `serve` は `127.0.0.1` bind の `EPERM` で停止した。dynamic loopback URL / health は取得できなかった。 | exact artifact 内 launcher の disposable 起動 |
| F-006 | BLOCKED | Computer Use は利用可能だったが、terminal app は安全制限で操作不可、exact packaged app の UI attach は timeout になった。LaunchServices 経由も executable missing で起動しなかった。 | CUA app attach、LaunchServices 起動結果 |
| F-007 | NOT RUN | Settings の General 初期表示、Updates、managed / external restore の見出し・ボタン、backup 選択・確認、restore、restart / navigation、note detail read-back は未実施。 | primary WebView 未到達 |
| F-008 | NOT RUN | restore 前 safety backup の生成、`recoveryOnly=true` の物理 metadata、restore 後の B の title/body、Cue、Tag、Canvas、searchText、DB/API read-back、B source bytes の restore 後不変は未確認。 | restore 操作未実施 |

## Verification

- 作業前後の `git status --short` を確認し、開始時から存在した source / docs / tests / `Notebook.app` / `summary/20260906/` の変更を保持した。
- `HOME`、`CORNELL_DESKTOP_HOME`、`TMPDIR` はすべて `/private/tmp` 配下の disposable path に設定し、実ユーザーの home、SQLite、backup、credential は読んでいない。
- 起動試行終了後に disposable app process が残っていないことを確認し、fixture root を削除した。
- `codex-queue/bin/worker-progress.sh` は 25% と 85% の節目で実行した。

## Remaining Unknowns

- permissive な runtime host で exact artifact の primary window、sidecar ready、dynamic loopback、WebView navigation を順に確認できるか。
- managed backup catalog の画面表示、B の選択、既存 confirmation、native bridge、restore restart handoff。
- restore 後の画面 / API / disposable SQLite read-back と safety backup retention。
- Settings の General / Updates と Data and Backup の文言・初期表示。
- direct startup の Abort trap と loopback `EPERM` がこの Worker 実行境界固有か、artifact 固有か。

## Next Read

- `summary/20260906/worker-managed-restore-runtime-qa-normal-artifact-20260906-summary.md`
- `summary/20260906/worker-rebuild-normal-artifact-current-source-20260906-fIB1qs8-summary.md`
- `summary/20260906/manager-runtime-boundary-check-20260906.md`
- `Notebook.app`
