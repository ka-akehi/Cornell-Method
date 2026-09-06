# Manager Summary: packaged export Replace QA via Computer Use (2026-09-06)

## Scope

Current normal packaged artifact を disposable macOS 環境で起動し、Settings の「バックアップを保存」から同名既存外部ファイルを Replace する native dialog 操作を確認した。実ユーザーデータ、source、設定、依存関係、`Notebook.app` は変更していない。

## Artifact

- `BUILD_ID`: `fIB1qs8IxwiH_P23PYXae`
- main executable SHA-256: `f8d8403e4f8fbbcdc7c7224a49f48022ba845d18d104d2491f1f9b096e2cb366`
- target / architecture: `aarch64-apple-darwin` / Mach-O `arm64`
- bundle ID / version: `com.cornellmethod.notebook` / `0.1.0`

## Findings

| 項目 | 結果 | 根拠 |
|---|---|---|
| exact packaged app 起動 | PASS | disposable 環境で window と `127.0.0.1:<ephemeral-port>` の WebView を確認 |
| Settings / Data and Backup 到達 | PASS | Settings を開き、Data and Backup を表示 |
| 「バックアップを保存」開始 | PASS | native save 操作の開始後、UI が保存中状態になった |
| native SaveDestination dialog | BLOCKED | Computer Use の window / screenshot / accessibility tree に dialog が表示されず、5秒待機後も Replace 操作へ進めなかった |
| Replace 操作 | NOT REACHED | dialog が取得できなかったため未実施 |
| export output | NOT RUN | 既存外部 sentinel file は起動試行前後で同じ SHA-256 / inode / size |
| live DB | PASS | 起動試行前後で SHA-256 / inode / size が不変、`PRAGMA integrity_check` は `ok` |
| managed backup | PASS | export 未実施のため空のまま |
| runtime cleanup | PASS | Settings の保存操作を Escape でキャンセルし、disposable app / runtime process を終了 |

## Conclusion

Replace 実装の source / static / disposable test は既に PASS している。今回の permissive macOS 環境では packaged app の Settings までは到達したが、native SaveDestination dialog が Computer Use 画面に現れず、同名 file の選択と Replace の実操作は未確認である。既存ファイルと live DB に変化はなく、Replace failure と断定できる証拠もない。

## Changes and cleanup

- source、設定、依存関係、lockfile、DB schema、`Notebook.app`、実ユーザーデータは変更していない。
- disposable live DB と既存外部 sentinel のみを `/private/tmp` 配下で扱った。
- native dialog に到達しなかったため、出力ファイルの置換は発生していない。

## Next Read

- `summary/20260906/1814-qa-packaged-backup-export-replace-20260906-05401d98-summary.md`
- `summary/20260906/1513-implement-backup-export-replace-20260906-fd512c83-summary.md`
- `src-tauri/src/runtime.rs`
- `src/server/infrastructure/desktop-storage.js`
