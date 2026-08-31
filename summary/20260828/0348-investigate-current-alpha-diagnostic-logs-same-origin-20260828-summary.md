---
summary_type: task-summary
created_at: 2026-08-28 03:48 JST
task_kind: worker-task
task_status: done
---

# Current packaged alpha の local diagnostic log 調査

## Objective

ユーザーが再現した current packaged alpha に対応する app 固有の sanitized diagnostic log を確認し、same-origin error と同時刻の startup / sidecar / runtime / command failure の証拠を分類する。ログが空の場合は、既存 investigation の unknown を解消できない範囲と、次に必要な最小証拠を固定する。

## Scope

| 項目 | 内容 |
|---|---|
| 対象領域 | app 固有の local diagnostic log の metadata と sanitized JSONL schema |
| 対象ファイル / ディレクトリ | 指定された app 固有 `logs` directory、`src-tauri/src/diagnostics.rs`、`src-tauri/src/runtime.rs`、`src/server/infrastructure/desktop-storage.js`、`HANDOFF_2026-08-22.md`、直近の same-origin / all-mutation / external-WebView summary |
| 対象外 | 他の home データ、SQLite、設定、backup、credentials、note data、app 起動、GUI、sidecar 起動、外部 network、ログの編集・削除・export、source/config/dependency/generated artifact の変更 |

## Inputs Read

| 種別 | パス | 確認内容 |
|---|---|---|
| app log metadata | `<Application Support>/com.cornellmethod.notebook/logs` | directory の存在、type、size、mtime、直下 entry の有無 |
| diagnostics schema | `src-tauri/src/diagnostics.rs:438-660,832-908` | JSONL の schema、validation、retention、allowlist、固定 message、redacted stack |
| storage path | `src/server/infrastructure/desktop-storage.js:58-66,203-248` | `logs` が app support root 直下の保存領域であること |
| runtime / command | `src-tauri/src/main.rs:182-196,338-358`、`src-tauri/src/runtime.rs:2428-2503` | native API command の経路と、diagnostic log への記録有無 |
| prior investigation | `HANDOFF_2026-08-22.md`、`summary/20260827/backup-same-origin-investigation-20260827-summary.md`、`summary/20260828/0114-*`、`0117-*`、`0135-*`、`0141-*`、`0230-*`、`0238-*` | current artifact identity、既存の runtime evidence 境界、未解消 unknown |

## Changes Made

| パス | 変更内容 | 理由 |
|---|---|---|
| `summary/20260828/0348-investigate-current-alpha-diagnostic-logs-same-origin-20260828-summary.md` | 本調査の要約を追加 | ログ不在と証拠境界を再開可能な形で残すため |

上記以外の source、設定、依存関係、lockfile、generated artifact、app、DMG、SQLite、ユーザーデータは変更していない。ログ directory も変更していない。

## Findings

### Log metadata と schema

| ID | fact / assumption / unknown | 内容 | 根拠 |
|---|---|---|---|
| L-001 | fact | 指定された app 固有 `logs` directory は存在し、directory type は `Directory`、size は 64 bytes、mtime は `2026-08-26 06:13:04 JST` だった。 | directory metadata の read-only 確認 |
| L-002 | fact | directory 直下の entry は 0 件だった。`event-*.jsonl` の filename、size、record は存在しない。symlink や別種 entry も検出されていない。 | `find -P` による直下 metadata 確認 |
| L-003 | fact | 今回安全に要約できる record 範囲は 0 件である。したがって timestamp の最小・最大、component、errorCode、message、stack の分布は得られない。 | JSONL file がないため schema parser の入力なし |
| L-004 | fact | source の local log record は `timestamp`、`component`、`errorCode`、`message`、`stack` の 5 項目だけで、unknown field を拒否する。valid record の stack は `redacted`、message は error code 由来の固定文である。 | `diagnostics.rs:26-38,631-660,832-908` |
| L-005 | fact | 記録対象 component は startup、sidecar、recovery、storage などの allowlist である。`record_failure_for_app` の call site は startup / storage / recovery / sidecar / restore 等で、native API command 自体の記録 call はない。 | `main.rs:374-450,536-541`、`lifecycle.rs`、`diagnostics.rs` |
| L-006 | fact | `request_desktop_state_changing_api` は native request の status/body を返すが、`main.rs:183-196` と `runtime.rs:2466-2503` に local diagnostic record を追加する処理はない。schema に HTTP status、endpoint、Host、Origin、Referer、invoke 結果の項目もない。 | 対象 source の read-only 確認 |
| L-007 | fact | storage path の定義は app support root の `logs` directory であり、今回確認した directory はその path boundary と一致する。 | `desktop-storage.js:58-66,203-248` |

### 同時刻の failure evidence

| 観点 | 判定 | 根拠と境界 |
|---|---|---|
| startup | 証拠なし | startup failure record が 0 件。directory mtime は record timestamp ではない。 |
| sidecar | 証拠なし | sidecar failure record が 0 件。既存 summary の過去の bind error は今回の log と時刻相関しない。 |
| runtime / native command | 証拠なし | invoke、command worker、native HTTP の record がなく、source schema もそれらを直接記録しない。 |
| HTTP / API | 証拠なし | status、body、endpoint、route/provider 到達の record がない。 |
| same-origin / origin | 証拠なし | same-origin error、Origin、Referer、Host、`request.nextUrl.origin` の記録がない。 |

### Fact / hypothesis / unknown の分類

| ID | 分類 | 内容 |
|---|---|---|
| F-001 | fact | 指定 log directory は存在するが空で、今回の reproduction に結び付く sanitized diagnostic record は確認できない。 |
| F-002 | fact | local diagnostic log だけでは、native bridge が選択されたか、invoke が成功したか、native HTTP が送信されたか、proxy が 403 を返したかを判定できない。現在の record schema / call site がその証拠を保持していない。 |
| F-003 | fact | handoff は current packaged alpha の BUILD_ID を `JrSkDiiD_Hp4755lZJsra` と記録しているが、local log file は空で BUILD_ID も含まない。log とその artifact の同一性は未照合である。 |
| H-001 | hypothesis | ユーザーの same-origin error が実際に発生していても、HTTP response は現在の Rust diagnostic call site の対象外であるため、空の local log と矛盾しない。 |
| H-002 | hypothesis | directory が空である理由は、(a) reproduction 中に Rust 側の failure recorder が呼ばれなかった、(b) recorder 初期化前に process が停止した、(c) 起動した artifact が別の保存境界を使った、のいずれかを含む。今回の情報だけでは区別できない。 |
| U-001 | unknown | ユーザーが見た forbidden response の実 endpoint、status、body、request header、proxy が計算した origin。 |
| U-002 | unknown | WebView の `window.__TAURI_INTERNALS__` の実在、native invoke の実行・結果、browser fallback の発生有無。 |
| U-003 | unknown | ユーザーが実際に起動した app の path、BUILD_ID、main executable identity が handoff の current artifact と一致するか。 |
| U-004 | unknown | 同じ reproduction 時刻の startup / sidecar / runtime failure が別の診断出力に存在するか。指定範囲外の home や別 artifact は調査していないため、判定しない。 |

### 既存 investigation の unknown への影響

- 解消されたのは「指定された app 固有 log directory に、今回確認時点で安全に読める record があるか」という問いだけで、答えは **ない** である。
- 既存の U-001〜U-004 / R-01〜R-04（実 endpoint/header、WebView marker、invoke、proxy origin、実 artifact identity）は解消されない。
- 既存 QA の app `SIGABRT`、sidecar loopback bind `EPERM`、GUI/API 未到達という証拠は、今回の log directory の空状態やユーザー再現時刻と同一視しない。

## Verification

| 確認項目 | 結果 | 備考 |
|---|---|---|
| app log directory metadata | PASS | 指定 directory の存在、type、size、mtime、直下 entry 0 件を確認。内容の変更なし。 |
| sanitized log schema / path boundary | PASS（静的） | `diagnostics.rs` の schema / validation / allowlist と `desktop-storage.js` の path 定義を照合。record 0 件のため JSONL parser の実データ検証は該当なし。 |
| `node --check src/server/infrastructure/desktop-storage.js` | PASS | 構文確認のみ。 |
| `node --test test/desktop/desktop-api-bridge-contract.test.js` | PASS | 3/3。現行 native-first / validated-origin contract の確認。 |
| `cargo fmt --manifest-path src-tauri/Cargo.toml -- --check` | PASS | format check のみ。 |
| `git diff --check` | PASS | summary 作成前の確認。 |
| app / GUI / sidecar / network | 未実施 | task 制約により起動・接続していない。 |
| 作業前後の差分 | 作業前の dirty state を保持 | 意図した repository 変更は本 summary のみ。最終 `git status --short` と diff を別途確認する。 |

## Remaining Unknowns

| ID | 未確認事項 | 次に必要な根拠 |
|---|---|---|
| R-01 | WebView で native bridge が有効か | permissive macOS host の disposable current artifact で `location.origin` と `__TAURI_INTERNALS__` の有無を観測 |
| R-02 | native command が送信され、どの response を得たか | invoke command の実行結果、native request の status を同一 mutation で観測 |
| R-03 | same-origin 判定に使われた実値 | sanitized な request correlation で destination origin、Host / Origin / Referer の一致・不一致、proxy の `request.nextUrl.origin`、route/provider hit を記録 |
| R-04 | 実行 artifact が current packaged alpha か | 起動 path と packaged BUILD_ID / executable hash を同一 QA 記録で照合 |

## Next task candidate

現時点で coding task は切り出さない。最小の後続 QA task は、GUI 起動・`127.0.0.1` bind が許可された macOS host の disposable 環境で、current artifact の 1 mutation を追跡することである。記録は raw body / note data / secret を含めず、marker の有無、invoke の成否、validated runtime origin、status、same-origin 判定の一致結果、route/provider 到達有無、artifact identity の allowlist 済み情報に限定する。

その QA で app-persisted evidence が必要と判明した場合だけ、次の最小 coding task を別途検討する。

- `src-tauri/src/diagnostics.rs`: HTTP body や header 値を保存せず、bridge / native request の結果を列挙値で表す sanitized event schema を追加。
- `src-tauri/src/main.rs` / `src-tauri/src/runtime.rs`: invoke worker failure、native request status、validated-origin mismatch の allowlisted event を記録。
- 検証: hosted/browser の same-origin fail-closed、Tauri native-first、redirect 不追従、秘密値非露出を focused test と disposable runtime で確認。

実測前に bridge fallback や same-origin check を緩和する変更は行わない。

## Next Read

- `summary/20260828/0348-investigate-current-alpha-diagnostic-logs-same-origin-20260828-summary.md`
- `summary/20260828/0230-investigate-tauri-external-loopback-ipc-20260828-summary.md`
- `summary/20260828/0135-audit-all-state-changing-same-origin-requests-20260828-summary.md`
- `src/shared/desktop/desktop-api-bridge.ts`
- `src-tauri/src/main.rs`
- `src-tauri/src/runtime.rs`
