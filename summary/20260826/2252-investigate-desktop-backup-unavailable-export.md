# Desktop backup unavailable export investigation

## Objective

`desktop-data-backup-boundary.test.js` の live DB unavailable ケースが、環境依存で成功しているのか、sidecar / desktop storage の本番欠陥なのかを切り分ける。コード・設定・依存関係・lockfile・テストは変更しない。

## Scope

| 項目 | 内容 |
|---|---|
| 対象領域 | Desktop manual SQLite export の storage path、sidecar one-shot operation、関連 disposable test |
| 対象ファイル / ディレクトリ | `test/desktop/desktop-data-backup-boundary.test.js`、`src-tauri/sidecar/launcher.cjs`、`src/server/infrastructure/desktop-storage.js`、DAB summary、`src-tauri/src/runtime.rs` |
| 対象外 | 実装、設定、依存関係、lockfile、生成物、Git/外部サービス操作 |

## Inputs Read

| 種別 | パス | 確認内容 |
|---|---|---|
| handoff | `HANDOFF_2026-08-22.md` | Desktop storage / packaged runtime の現状と未検証範囲 |
| design summary | `summary/20260825/0830-desktop-data-backup-design-audit.md` | DAB-01 の export 契約と disposable 検証方針 |
| implementation summary | `summary/20260825/0943-implement-desktop-manual-sqlite-export-20260825-2359b993-summary.md` | export 実装・検証結果 |
| QA summary | `summary/20260825/1248-verify-desktop-data-backup-dab06-20260825-summary.md` | desktop backup test の既存検証境界 |
| source/test | 対象 source と `test/desktop/desktop-data-backup-*.test.js` | env、path、sidecar 起動条件、fixture isolation |

## Changes Made

| パス | 変更内容 | 理由 |
|---|---|---|
| `summary/20260826/2252-investigate-desktop-backup-unavailable-export.md` | この調査結果だけを追加 | Worker task の再開用要約を残すため |
| code/config/dependency/lockfile/generated artifact/test | 変更なし | 調査 task の制約を維持 |

## Findings

| ID | fact / assumption / unknown | 内容 | 根拠 |
|---|---|---|---|
| F-001 | fact | 対象テストは line 232 で一時 directory を destination 用に作るだけで、sidecar child に `CORNELL_DESKTOP_HOME` / `CORNELL_DESKTOP_PROJECT_ROOT` を渡していない。 | `test/desktop/desktop-data-backup-boundary.test.js:231-250` |
| F-002 | fact | launcher の one-shot `data-backup-operation` は `DATABASE_URL` ではなく `storageOptions()` の `storagePaths.databasePath` を export source に渡す。`CORNELL_DESKTOP_HOME` がなければ `os.homedir()`、application ID がなければ `com.cornellmethod.notebook` を使う。 | `src-tauri/sidecar/launcher.cjs:43-65, 781-855` |
| F-003 | fact | 現在の既定解決先は `/Users/kazuya/Library/Application Support/com.cornellmethod.notebook/live/notebook.sqlite`。root、`live`、`backups`、`settings`、`logs`、`pending-restore` と DB は実在し、DB size は 73,728 bytes。関連 `CORNELL_DESKTOP_*` / `DATABASE_URL` env は未設定だった。 | `node src-tauri/sidecar/launcher.cjs paths`、read-only `lstat` / `env` |
| F-004 | fact | 現在の既定環境で対象テスト単独は 8 件中 7 PASS / 1 FAIL。失敗ケースの実応答は `success`、`fileName=export.sqlite`、`size=73728` であり、destination は finally で削除される。 | `node --test test/desktop/desktop-data-backup-boundary.test.js` |
| F-005 | fact | 一時 home を `CORNELL_DESKTOP_HOME` に設定して同じ対象テストを実行すると 8/8 PASS。fresh home では canonical storage root が未作成のため `backup-failed`、destination なしになる。 | disposable env override reproduction |
| F-006 | fact | canonical storage directory だけを作り DB だけ欠落させると、sidecar は `invalid-live-database`、destination なしを返す。これは storage 実装が欠落 source を fail closed に扱っている証拠である。 | disposable missing-DB reproduction |
| F-007 | fact | `node --test test/desktop/*.test.js` は 208 件中 200 PASS / 1 FAIL / 7 SKIP。FAIL は対象 boundary test の同じ 1 件だけで、SKIP は loopback listener 制限。 | full desktop suite |
| F-008 | fact | 実際の packaged macOS GUI / sidecar runtime はこの調査では検証していない。既存 QA summary と同様、source/disposable test の結果を packaged PASS へ繰り上げない。 | `summary/20260825/1248-verify-desktop-data-backup-dab06-20260825-summary.md` |

### Conclusion

原因は本番コードの export 成功判定ではなく、対象テストが実ユーザーの既定 Application Support を使っている環境依存である。現在のローカルには既定 live DB が存在するため、指定された destination へ正常 export するのが正しい挙動である。fresh home および missing-DB の disposable 再現では、いずれも destination を残さず fail closed したため、今回の事象から `launcher.cjs` / `desktop-storage.js` の本番修正 task は不要。

最小の後続 coding task を切り出すなら、対象は `test/desktop/desktop-data-backup-boundary.test.js` だけとする。目的は failing spawn に disposable `CORNELL_DESKTOP_HOME`（必要に応じて project root / application ID）を明示し、既定ユーザー data に依存しない negative test にすること。完了条件は対象 test 8/8 PASS、`node --test test/desktop/*.test.js` の FAIL 0、production source を変更しないこと。なお「DB file だけがない状態」を厳密に検証する場合は、canonical directory を作成した fixture にして期待値を `invalid-live-database` とする別の test-contract 判断が必要である。

## Verification

| 確認項目 | 結果 | 備考 |
|---|---|---|
| 作業前 `git status --short --untracked-files=all` | 完了 | 既存の未コミット変更を確認・保持 |
| 対象テスト単独（既定環境） | 7 PASS / 1 FAIL | 失敗理由は実 DB が存在し `success` になったこと |
| 対象テスト単独（disposable home） | 8 PASS | env override で再現確認 |
| desktop suite | 200 PASS / 1 FAIL / 7 SKIP | FAIL は同じ test、SKIP は loopback 制限 |
| code/config/test change | なし | 一時 fixture は `/private/tmp` 系で作成・cleanup |

## Remaining Unknowns

| ID | 未確認事項 | 次に必要な根拠 |
|---|---|---|
| U-001 | packaged `.app` で Rust が渡す storage layout と sidecar export の実機結合 | packaged runtime artifact と disposable Application Support を使う別 QA |

## Next Read

- `test/desktop/desktop-data-backup-boundary.test.js`
- `src-tauri/sidecar/launcher.cjs`
- `src/server/infrastructure/desktop-storage.js`
- `src-tauri/src/runtime.rs`

