# File-dialog failure investigation (2026-08-30)

## 結論

保存先選択、外部復元元選択、復元エラー後の再選択は、同じ Tauri command → `spawn_blocking` → `choose_data_backup_file` → `run_native_file_dialog` 境界を共有する。今回得られた証拠だけでは、dialog 前、AppleScript/process、response parse、path validation のいずれかを確定できない。安全な次 task は、ユーザーデータを記録せず、この境界の typed phase/code を診断 metadata に出す observability task である。

## Fact

- UI は `destination-exists`、`path-not-found` / `path-not-file` / `path-unavailable`、`unsupported-platform` だけ専用文言にし、それ以外の `command-worker-failed`、`command-unavailable`、`dialog-unavailable`、`dialog-error`、`dialog-invalid-response`、`dialog-response-too-large`、`storage-unavailable`、`selection-store-failed`、`invalid-path`、`relative-path`、`unsafe-path`、`managed-path`、`symlink-path` を generic 文言へ畳む。
- bridge の両 chooser は invoke rejection と response shape/protocol/identity 不正を `command-unavailable` に正規化する。native typed error response は valid shape なら保持される。
- Rust は両 command を登録し、`spawn_blocking` panic/join failure のみ `command-worker-failed` を返す。command registration、local allowlist、remote data-backup allowlist は一致する。
- remote capability は `http://127.0.0.1::port/*` の dynamic loopback scope。packaged artifact の binary に command、allowlist、loopback、dialog error marker が存在する。
- `run_native_file_dialog` は `/usr/bin/osascript -e <script>` を spawn し、stdout の size/UTF-8/`selected\n<path>`/`cancel`/`error` だけを判定する。process exit status と stderr は読んでおらず、`output()` failure と stdout parsing error 以外の process-level detail は失われる。
- path validation は native dialog 後、selection store insert 前に absolute/安全性/managed root/symlink/existence/file type を検査する。
- 最新 artifact の `.next/BUILD_ID` は `v9LFDRSVlwotptAzPZcVB` で source `.next/BUILD_ID` と一致。stale artifact は静的には支持されない。
- focused tests は 22 中 21 PASS、1 FAIL。失敗は既存の Settings モバイル入口の文字列契約であり、file-dialog boundary test ではない。static PASS は packaged runtime success を証明しない。
- 利用可能な sanitized metadata / summaries には、今回の file-dialog failure code や native stderr/exit status は存在しなかった。

## Inference / unknown

- 3 操作が同じ generic error になることから共通 chooser boundary の failure は整合的だが、実際の失敗点は未観測。
- dialog 前の storage/selection-store 欠落、command rejection、dialog process failure、stdout response parse failure、dialog 後の path validation の全てが現実的な候補。
- `run_native_file_dialog` は process exit status を無視するため、osascript が非 zero exit でも stdout が `cancel` / selected なら成功扱いになり得る。stderr は証拠として保存されない。
- chooser は operation/DB mutation より前なので、今回の失敗は取得できた経路上では DB mutation 前であり、ユーザー SQLite/backup の変更証拠はない。

## Proposed next task (one cohesive responsibility)

`run_native_file_dialog` から chooser command return までの failure observability を追加する。対象は `src-tauri/src/runtime.rs`、必要最小限の typed diagnostic bridge/metadata test。保存するのは dialog kind、phase（command/dialog-process/response-parse/path-validation/selection-store）、typed error code、process exit-status presence のみとし、stdout/stderr、raw path、filename、DB/backup 内容は保存しない。既存 DTO と generic UI copy、cancel semantics、path safety、DB mutation ordering は維持する。

完了条件:

- spawn failure、non-zero process、stdout-too-large、UTF-8/shape error、AppleScript `error`、path validation、selection-store failure を phase/code として区別できる。
- process exit status と stderr は安全な boolean/typed category のみ扱い、raw output/path を漏らさない。
- source static tests と disposable typed-response tests が追加され、既存 focused tests が通る。
- packaged runtime で実際の failure metadata を確認できるまで、根本原因を確定済みと記録しない。

## Next Read

- `src-tauri/src/runtime.rs` の diagnostics publish/retention boundary
- `src-tauri/src/diagnostics.rs`
- `src/shared/desktop/desktop-settings-bridge.ts` の diagnostics normalization
- `test/desktop/desktop-data-backup-boundary.test.js`
- `test/desktop/desktop-settings-ui.test.js` の既存失敗契約
