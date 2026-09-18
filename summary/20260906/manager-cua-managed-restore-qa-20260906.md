# Manager Summary: packaged managed-restore QA via Computer Use (2026-09-06)

## Scope

Current normal packaged artifact を disposable macOS 環境で起動し、managed backup restore の表示・選択・復元・再起動後 read-back を確認した。実ユーザーデータ、source、設定、依存関係、`Notebook.app` の参照先は変更していない。

## Artifact

- path: `/private/tmp/cornell-method-normal-runtime-qa-8Gdmh6/tauri-target/aarch64-apple-darwin/release/bundle/macos/Cornell Method Notebook.app`
- `BUILD_ID`: `fIB1qs8IxwiH_P23PYXae`
- main executable SHA-256: `f8d8403e4f8fbbcdc7c7224a49f48022ba845d18d104d2491f1f9b096e2cb366`
- target / architecture: `aarch64-apple-darwin` / Mach-O `arm64`
- bundle ID / version: `com.cornellmethod.notebook` / `0.1.0`

## Findings

| 項目 | 結果 | 根拠 |
|---|---|---|
| normal packaged app 起動 | PASS | disposable `HOME`、`CORNELL_DESKTOP_HOME`、`TMPDIR` で window と loopback WebView を確認 |
| Settings 初期表示 | PASS | 初期カテゴリが「一般」、同画面内に「更新」を確認 |
| managed catalog の user-facing 表示 | PASS | user backup A/B と restore safety backup を用意し、設定画面には最新 user backup 1件だけ表示 |
| safety backup 分離 | PASS | restore 後に safety backup が内部ファイルとして残り、catalog metadata は `recoveryOnly=true`、通常一覧には非表示 |
| managed restore confirmation | PASS | 表示された最新 user backup に対し確認ダイアログと「復元を実行」を操作 |
| restore 後の lifecycle / navigation | PASS | restore 後に loopback port が切り替わり、一覧へ戻って新しい状態を表示 |
| Markdown note read-back | PASS | title、body、summary が選択した最新 backup の sentinel と一致 |
| Cue / Tag read-back | PASS | Cue と Tag が選択した最新 backup の sentinel と一致 |
| Canvas read-back | PASS | Canvas note の saved document、用紙サイズ、Canvas 表示が選択した最新 backup と一致 |
| SQLite integrity | PASS | disposable live DB の `PRAGMA integrity_check` が `ok`、foreign-key check に異常なし |
| source backup 不変 | PASS | 選択した user backup の SHA-256 が restore 前後で不変、live DB は復元内容と一致 |
| same-origin error | NOT REPRODUCED | loopback URL で画面と API-backed read が成立し、同一オリジンエラーは表示されなかった。WebView 内部 API / Network panel は未取得 |
| runtime cleanup | PASS | native close 操作後、disposable app の runtime を停止。実ユーザーデータは使用していない |

## Conclusion

`このバックアップを復元` は、最新 user backup を選択し、restore 前 safety backup を内部保持したうえで live DB を切り替え、再起動後の画面にも復元内容を反映できた。今回の permissive macOS 環境では、従来の「正しく復元できない」症状は再現しなかった。

これは disposable data と今回の exact artifact に対する packaged GUI evidence であり、任意の実ユーザー環境での same-origin 問題が全面解消したことを意味しない。`window.__TAURI_INTERNALS__`、Network panel、実ユーザー data、外部 backup の native file dialog は別途未確認である。

## Changes and cleanup

- source、設定、依存関係、lockfile、DB schema、`Notebook.app`、実ユーザーデータは変更していない。
- disposable fixture と managed backups は専用の `/private/tmp` 配下だけで扱った。
- app は native close 操作後に停止し、残留した disposable runtime process も終了した。

## Next Read

- `summary/20260906/1655-qa-packaged-managed-restore-recovery-catalog-20260906-6e75e370-summary.md`
- `summary/20260906/1644-rebuild-normal-app-after-recovery-catalog-20260906-3b6e0056-summary.md`
- `src/app/_components/settings/settings-modal.tsx`
- `src/server/infrastructure/desktop-storage.js`
