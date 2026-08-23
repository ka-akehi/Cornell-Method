---
summary_type: task-summary
created_at: 2026-08-24 03:16 JST
task_kind: worker-task
task_status: done
---

## Objective

PR #102 / Issue #123 の根本原因を、既存の `gzip` 圧縮 POSIX tar / `.app.tar.gz` 採用判断、manifest、署名 payload、download、archive extraction の境界から確認する。既存の public payload を壊さない最小の契約修正案と、追加質問なしで投入できる後続 coding task の対象・完了条件を固定する。

## Scope

| 項目 | 内容 |
|---|---|
| 対象領域 | Desktop Alpha の Apple Silicon app update artifact contract |
| 対象ファイル / ディレクトリ | `doc/requirements/PRODUCT_SPEC.md`、`doc/implementation/MVP_CONTRACT.md`、`doc/implementation/IMPLEMENTATION_STATUS.md`、`src-tauri/src/update_manifest.rs`、`src-tauri/src/update_download.rs`、`src-tauri/src/update_archive.rs`、`src-tauri/src/update_signature.rs`、`test/desktop/`、Rust unit tests |
| 対象外 | コード、設定、依存関係、lockfile、既存 docs、既存 tests、生成物、GitHub / network、commit / push |
| 成果物 | 本 Worker report のみ |

## Inputs Read

| 種別 | パス | 確認内容 |
|---|---|---|
| repository rules | `AGENTS.md`、`HANDOFF_2026-08-22.md` | MVP / Desktop Alpha の境界、status と summary の扱い、既存未コミット変更の保持 |
| canonical contract | `doc/requirements/PRODUCT_SPEC.md:102-113,245,268`、`doc/implementation/MVP_CONTRACT.md:293-334`、`doc/implementation/IMPLEMENTATION_STATUS.md:243-260` | 現在の抽象 `app-archive`、extension 未固定の文面、provider / state / 未実装境界 |
| prior decisions | `summary/20260823/0259-specify-desktop-app-archive-contract.md`、`0304-specify-desktop-update-archive-format-20260823-80bafde6-summary.md` | gzip POSIX tar、単一 `.app` root、canonical filename、compressed bytes の size / SHA-256、MIME allowlist |
| signature decision | `summary/20260823/0312-specify-desktop-update-signature-contract.md` | Ed25519 payload v1、`format` / `sizeBytes` / raw SHA-256 の署名、URL / filename 非署名 |
| manifest / signature | `src-tauri/src/update_manifest.rs:451-625`、`src-tauri/src/update_signature.rs:227-305`、`test/desktop/fixtures/update-signature/valid.json` | strict field allowlist、`app-archive` selection、canonical payload v1 |
| download / extraction | `src-tauri/src/update_download.rs:457-551,861-948`、`src-tauri/src/update_archive.rs:271-341,423-746` | response validation、compressed byte verification、`.app.tar.gz` staging、gzip/tar preflight と安全な展開 |
| tests / related docs | `test/desktop/desktop-update-{manifest,download,archive,signature}.test.js`、対象 Rust tests、`doc/technical/DESKTOP_ALPHA_TAURI_FOUNDATION.md:184,193,212-223`、`doc/implementation/POST_MVP_IMPLEMENTATION_PLAN.md:202,213`、`doc/testing/TEST_SCENARIOS.md:719,770,780` | 現在の回帰テストと、対象リスト外にも残る stale な extension 未固定文面 |

## Changes Made

| パス | 変更内容 | 理由 |
|---|---|---|
| 製品コード・設定・依存関係・既存 docs・既存 tests・生成物 | 変更なし | Worker task の制約。既存の未コミット変更も戻していない |
| `summary/20260824/0316-resolve-issue-123-app-archive-contract.md` | 調査結果、採用案、後続 task、回帰テスト、Next Read を記録 | 次の実装 / docs sync が同じ契約を使うため |

## Findings

| ID | fact / assumption / unknown | 内容 | 根拠 |
|---|---|---|---|
| F-001 | fact | 根本原因は runtime と manifest wire value の不一致ではなく、`app-archive` が表す具体的な container / filename / byte semantics が canonical docs に書かれていないこと。`MVP_CONTRACT.md:298,311,332` と `IMPLEMENTATION_STATUS.md:245,251` は archive extension を未決定としている。 | 対象 docs と `summary/20260823/0259...` の照合 |
| F-002 | fact | manifest public shape は `artifactId`、`format`、`url`、`sizeBytes`、`sha256` のまま。parser は `deny_unknown_fields` を使い、対象判定は exact `format == "app-archive"`。unknown format はその release だけを対象外にする。 | `update_manifest.rs:12,451-480,545-550,597-625` |
| F-003 | fact | signature payload v1 は `format`、`sizeBytes`、manifest SHA-256 の raw 32 bytes と release metadata を固定順で署名する。既存 fixture の `format` は `app-archive` で、format / size / digest の変更は payload / proof を変える。 | `update_signature.rs:227-305,722-740`、`valid.json:13-20` |
| F-004 | fact | `url` は signature payload に含まれない。別 URL / basename へ変えても同じ proof を検証できるテストがあり、CDN redirect / mirror locator と artifact identity を分離している。 | `update_signature.rs:1067-1082` |
| F-005 | fact | download は response の status、HTTPS redirect、Content-Type、Content-Length、streaming actual byte count、compressed raw SHA-256、signature を順に検証し、`packages/<sha256>.app.tar.gz` へ publish する。URL basename / `Content-Disposition` は path に使わない。 | `update_download.rs:457-551,861-948`、`desktop-update-download.test.js:79-87` |
| F-006 | fact | Content-Type は `application/gzip` を canonical / preferred とし、現行実装は `application/octet-stream` も互換 allowlist として受理する。media type は case-insensitive、`;parameter` は無視し、missing / その他は `.part` 作成前に拒否する。 | `update_download.rs:24-25,870-948`、Rust tests `1463-1504,1634-1670` |
| F-007 | fact | download boundary は gzip/tar を parse しない。実 body の gzip validity、POSIX tar、single root `.app`、path / symlink / special file / permission / size limits は extraction boundary が fail closed で検証する。 | `update_download.rs:1614-1631`、`update_archive.rs:12-19,271-341,423-746` |
| F-008 | fact | archive decision の canonical filename は `cornell-method-notebook-<version>-aarch64-apple-darwin.app.tar.gz`。ただし reader は filename、`artifactId`、Content-Disposition を信頼根や local path にしない。 | `summary/20260823/0259...`、`update_download.rs:465-467,635-651` |
| F-009 | fact | `update_state.rs` も `packages/<sha256>.app.tar.gz` を canonical path として使う。`format` を変更する案は、対象リストにない state / selection / provider / fixture まで波及する。 | `update_state.rs:1519-1529`、`update_selection.rs:101-119` |
| F-010 | fact | 対象リスト外の `DESKTOP_ALPHA_TAURI_FOUNDATION.md`、`POST_MVP_IMPLEMENTATION_PLAN.md`、`TEST_SCENARIOS.md` にも「具体的な拡張子は未固定」が残る。対象 3 docs だけを直しても repository-wide の文面は完全には同期しない。 | 上記 path / line の照合、`summary/20260823/0518...` の docs-sync pending 記録 |
| A-001 | assumption / recommendation | `app-archive` は互換性を保つ logical format label とし、その wire representation を gzip-compressed POSIX tar containing one `Cornell Method Notebook.app` と定義する。 | 既存 archive decision、current Rust boundary、signature payload v1 |
| A-002 | assumption / recommendation | `.app.tar.gz` の canonical filename は release publishing / packaging の命名規則とし、manifest field や downloader の URL basename validation にはしない。 | URL 非署名、CDN redirect、sha-derived staging path の既存設計 |
| A-003 | assumption / recommendation | `application/gzip` を preferred にし、既存の `application/octet-stream` compatibility allowance を維持する。actual format は後段 extraction と digest / signature が確定するため、strict gzip-only への変更は不要。 | `ALLOWED_ARTIFACT_CONTENT_TYPES` と既存 tests |

## Worker Report

### 結論：採用する一つの最小修正案

manifest schema、public field、`artifact.format`、signature payload v1 は変更しない。`app-archive` の意味を、次のように契約本文へ具体化する。

```text
artifact.format: "app-archive"                 # 既存 wire value
container: gzip-compressed POSIX tar
archive root: exactly one "Cornell Method Notebook.app" directory
canonical release filename:
  cornell-method-notebook-<version>-aarch64-apple-darwin.app.tar.gz
sizeBytes: compressed archive wire bytes の実 byte count
sha256: compressed archive wire bytes 全体の SHA-256
Content-Type: application/gzip
compatibility: application/octet-stream を受理。media type は case-insensitive、parameter は無視
```

`Content-Type` は manifest field ではなく package HTTP response の validation boundary とする。missing / unsupported type、status 不正、declared size 不一致は download 前半で拒否する。body の gzip magic / tar 構造は download で sniff せず、signature / compressed size / SHA-256 を通過した後の archive extraction で検証する。

canonical filename は release asset の公開命名規則として要求するが、reader は URL path、redirect の final basename、`Content-Disposition`、filename から version / architecture / artifact identity を推測しない。local staging は既存どおり `packages/<sha256>.app.tar.gz` とする。

### 選択肢比較

| 案 | 影響 | 判定 |
|---|---|---|
| `archiveFormat`、`compression`、`filename`、`contentType` を manifest に追加 | `deny_unknown_fields` と schema v1 の境界を変える。署名 payload に含めるなら payload version / release tooling / fixture も変更し、含めないなら未署名の曖昧な metadata を増やす | 不採用。不要な public contract 拡張 |
| `format` を `gzip-posix-tar` 等へ変更 | selection / download / state の exact match が変わり、既存 manifest と署名 payload v1（`format` が signed）を壊す。旧 release 互換のため schema / payload version 分岐が必要 | 不採用。Issue #123 の最小修正ではない |
| URL または URL basename を `.app.tar.gz` に限定 | URL は locator であり signature payload 外。GitHub CDN / HTTPS redirect / mirror の basename を固定し、既存の URL 非署名テストと衝突する | 不採用。security benefit がなく availability を狭める |
| response Content-Type を `application/gzip` のみにする | 現行の `application/octet-stream` compatibility と既存 test を壊す。bytes / digest / signature / extraction があるため、strict-only にしても必要な authenticity は増えない | 不採用。`application/gzip` preferred + octet-stream compatibility を採用 |
| `app-archive` の concrete representation を docs に定義し、既存 download / extraction tests を regression guard にする | wire payload、trust boundary、state path、provider locator を変更せずに契約と実装を同期できる | **採用** |

### Public payload と後段 boundary への影響

| 境界 | 推奨変更 | 互換性 / 完了条件 |
|---|---|---|
| manifest validation | field 追加なし、schemaVersion は 1 のまま、`TARGET_ARTIFACT_FORMAT` は `app-archive` のまま | valid manifest は同じ typed fields を得る。unknown format は従来どおり非対象 release。filename / MIME は parser で検証しない |
| signature | production verifier / payload schema の意味変更なし | `format` は `app-archive` のまま、`sizeBytes` と SHA-256 は compressed bytes。既存 `canonicalPayloadHex` / proof fixture が byte-for-byte 維持される。URL / filename / Content-Type は署名対象外 |
| download | semantic behavior は現行を維持。Content-Type allowlist、declared / actual compressed size、raw SHA-256、signature、sha-derived `.app.tar.gz` publish を契約に明記 | invalid metadata は `.part` 作成前、size / digest / signature failure は publish 前に fail closed。URL basename に依存しない |
| archive extraction | gzip-compressed POSIX tar、single `.app` root、no-follow safe extraction、atomic temp rename を現行どおり維持 | invalid gzip / CRC / concatenated member / tar trailing data / wrapper root / traversal / unsafe symlink / special file / limit は partial tree を残さない |
| status | 「format 未決定」を除去し、manifest / signature / download / archive の source / focused-test 実装と、real packaged GUI / production key / apply / migration / rollback の未検証・未実装を分ける | static / Rust PASS を packaged runtime PASS と誤記しない |

### 後続 coding task

#### Task title

`sync-desktop-update-app-archive-contract-issue-123`

#### 必須対象

- `doc/requirements/PRODUCT_SPEC.md`
  - high-level に DMG（初期配布）と `.app.tar.gz`（アプリ内更新）を分離して記載する。
  - `app-archive` の detailed field semantics は MVP contract 参照とし、provider / placement / production key operation など本当に未決の事項だけを U-002 に残す。
- `doc/implementation/MVP_CONTRACT.md` §9.4〜§9.4.1
  - archive extension 未決定の記述を concrete mapping へ置換する。
  - artifact table の `sizeBytes` / `sha256` を compressed wire bytes と明記する。
  - canonical filename、Content-Type allowlist、URL / filename を trust root にしないこと、single `.app` root を記載する。
  - schemaVersion、field allowlist、`format: app-archive`、signature object (`keyId` / `proof`) は変更しない。
- `doc/implementation/IMPLEMENTATION_STATUS.md` §5.4〜§5.4.1
  - source / Rust unit / static test で確認できる manifest、signature payload / verifier、download integrity、archive extraction の範囲と、packaged Apple Silicon GUI、実 provider / release、production key、apply / migration / rollback の未検証・未実装を分けて記載する。
  - `.app.tar.gz` と compressed bytes semantics を status に反映する。
- `src-tauri/src/update_manifest.rs`
  - **public wire change はしない**。`TARGET_ARTIFACT_FORMAT == "app-archive"` と strict field behavior を regression test で固定する。URL basename / MIME field を追加しない。
- `src-tauri/src/update_download.rs`
  - **semantic change は原則しない**。`application/gzip` + `application/octet-stream`、case-insensitive / parameter-ignore、compressed size / digest / signature、`packages/<sha>.app.tar.gz` を regression test で固定する。
- `src-tauri/src/update_archive.rs`
  - **semantic change は原則しない**。gzip + POSIX tar、single `Cornell Method Notebook.app` root、no-follow / cleanup / atomic rename の既存境界を regression test で固定する。
- `src-tauri/src/update_signature.rs`
  - **payload v1 は変更しない**。既存 interoperability fixture と URL 非署名、format / size / digest mutation failure を維持・明示する。
- 対応する `test/desktop/` と Rust tests
  - 既存 `desktop-update-manifest.test.js`、`desktop-update-download.test.js`、`desktop-update-archive.test.js`、`desktop-update-signature.test.js` の assertions を契約表現に合わせる。
  - valid manifest に `.app.tar.gz` でない locator basename を使っても parse / signature が通ることを確認する。
  - `application/gzip` の大文字・parameter、`application/octet-stream` の互換受理、missing / unsupported MIME の拒否を確認する。
  - `sizeBytes` / SHA-256 が compressed bytes に対する値であり、short / extra / mutated body、signature mismatch、invalid gzip/tar がそれぞれ正しい boundary で拒否されることを確認する。
  - final path が URL / `artifactId` ではなく `packages/<sha256>.app.tar.gz` であること、archive extraction が wrapper / traversal / symlink / special file / trailing data を拒否することを確認する。

`update_state.rs` は対象リスト外だが、既に `packages/<sha256>.app.tar.gz` を canonical path にしている。今回の推奨案では変更不要。拡張子の共通定数化を行う場合だけ、`update_state.rs` とその tests を task scope に追加し、別の refactor として扱う。

#### 完了条件

1. 3 つの対象 docs から「package archive の具体的な拡張子は未決定」という、採用済み方針と衝突する記述がなくなる。
2. `artifact.format`、manifest schemaVersion、field allowlist、signature payload v1、既存 fixture の wire value は変更されない。
3. `application/gzip` preferred、`application/octet-stream` compatibility、compressed size / SHA-256、canonical publish filename、sha-derived local path、single `.app` root が docs と focused tests で一致する。
4. invalid response / body / signature / archive の fail-closed behavior と current app / live DB preservation boundary が保たれる。
5. Rust focused tests、`test/desktop` focused tests、`git diff --check` を実行し、packaged Apple Silicon / real GitHub CDN / production key / apply / migration / rollback は未検証として明記する。
6. Issue を repository-wide に close する場合は、対象リスト外で同じ stale wording を持つ `DESKTOP_ALPHA_TAURI_FOUNDATION.md`、`POST_MVP_IMPLEMENTATION_PLAN.md`、`TEST_SCENARIOS.md` も同じ patch で同期する。対象外に留めるなら Issue 完了条件に「3 docs のみ」と明記する。

## Verification

| 確認項目 | 結果 | 備考 |
|---|---|---|
| 作業前 `git status --short` | PASS | update 系 Rust / desktop tests を含む既存 modified files と大量の untracked summary を確認。戻していない |
| canonical docs / prior summaries / source / tests の read-only 照合 | PASS | `rg`、`sed`、`nl`、`git log`、`git blame`、`git show` のみ使用 |
| manifest / signature / download / extraction boundary | PASS | 抽象 `app-archive` と concrete `.app.tar.gz` 実装、署名 payload v1、MIME / URL / filename 境界を照合 |
| コード・設定・依存関係・lockfile・既存 docs・既存 tests・生成物 | 変更なし | 本 summary のみ新規作成 |
| Rust / Node tests、lint、build、network / GitHub | NOT RUN | read-only specification task のため。既存の過去 summary にある検証結果は今回の実行結果へ繰り上げない |

## Remaining Unknowns

| ID | 未確認事項 | 次に必要な根拠 |
|---|---|---|
| R-001 | 実 Tauri `.app` を canonical filename `.app.tar.gz` にして clean build / round-trip した size、mode、symlink、bundle metadata が hard caps に収まるか | disposable Apple Silicon packaged QA |
| R-002 | GitHub Release CDN の final Content-Type / redirect / asset basename が current allowlist と canonical publish convention に合うか | network を許可した別の online / packaged QA。今回の worker は接続しない |
| R-003 | production trusted key の承認・rotation・release signing operation | signature trust-store approval task。private key は repository に置かない |
| R-004 | `DESKTOP_ALPHA_TAURI_FOUNDATION.md`、`POST_MVP_IMPLEMENTATION_PLAN.md`、`TEST_SCENARIOS.md` を Issue #123 の必須同期対象に含めるか | Manager の scope 判定。repository-wide close なら同一 docs sync patch に含める |

## Next Read

次の docs / regression sync task は、以下だけを最小入力として読む。

- `summary/20260824/0316-resolve-issue-123-app-archive-contract.md`
- `doc/requirements/PRODUCT_SPEC.md` §更新、配布・保存方針、U-002
- `doc/implementation/MVP_CONTRACT.md` §9.4〜§9.4.1
- `doc/implementation/IMPLEMENTATION_STATUS.md` §5.4〜§5.4.1
- `src-tauri/src/update_manifest.rs`、`src-tauri/src/update_download.rs`、`src-tauri/src/update_archive.rs`、`src-tauri/src/update_signature.rs`
- `test/desktop/desktop-update-manifest.test.js`、`desktop-update-download.test.js`、`desktop-update-archive.test.js`、`desktop-update-signature.test.js`
- repository-wide sync が承認された場合のみ `doc/technical/DESKTOP_ALPHA_TAURI_FOUNDATION.md`、`doc/implementation/POST_MVP_IMPLEMENTATION_PLAN.md`、`doc/testing/TEST_SCENARIOS.md`
