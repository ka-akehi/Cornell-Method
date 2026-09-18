---
summary_type: task-summary
created_at: 2026-08-12 13:37 JST
task_kind: worker-task
task_status: done
---

## Objective

Electron と Tauri + Node.js sidecar の Desktop PoC 証跡を、共有 baseline、fixture、環境、測定軸にそろえて比較した。runtime / GUI / native build の未確認事項を静的証跡で PASS にせず、発注者が Desktop Alpha shell を選定するための条件、残る risk、追加確認の優先順位を整理した。

## Scope

| 項目 | 内容 |
|---|---|
| 対象領域 | Desktop PoC の baseline、10,000-note fixture、性能、SQLite / Prisma / migration、lifecycle、cleanup、stale lock、packaging、update、保守・コスト軸 |
| 対象ファイル / ディレクトリ | 指定された 9 summary、`tools/desktop-poc/electron/` と `tools/desktop-poc/tauri/` の README / evidence schema、共有 manifest / fixture、両候補の evidence |
| 対象外 | コード、設定、依存関係、lockfile、生成物、既存 summary、正式仕様の変更、runtime 再実行、shell 選定、Issue / PR / task 投入 |

## Inputs Read

| 種別 | パス | 確認内容 |
|---|---|---|
| 最新引き継ぎ | `HANDOFF_2026-08-12.md` | shell 未選定、同一条件比較後に発注者が選定する契約、次の確認範囲 |
| 正本文書 | `doc/requirements/PRODUCT_SPEC.md`、`doc/implementation/POST_MVP_IMPLEMENTATION_PLAN.md`、`doc/technical/TARGET_ARCHITECTURE.md`、`doc/implementation/IMPLEMENTATION_STATUS.md`、`doc/requirements/MVP_SYSTEM_SPEC.md`、`doc/implementation/MVP_CONTRACT.md` | Desktop PoC の比較契約、現行 MVP 境界、Desktop Alpha の lifecycle / DB / update 境界 |
| Electron task summaries | `summary/20260812/1058-implement-electron-desktop-poc-20260812-3d172ada-summary.md`、`1111-fix-electron-poc-app-artifact-evidence-20260812-bbc94bf9-summary.md`、`1137-fix-electron-poc-process-tree-cleanup-20260812-2a4474e2-summary.md`、`1153-tighten-electron-poc-process-group-scope-20260812-4cdc1870-summary.md` | Electron の実装、artifact evidence、process-tree cleanup / scope hardening、検証結果 |
| Tauri task summaries | `summary/20260812/1229-implement-tauri-desktop-poc-20260812-81f7a9f8-summary.md`、`1247-fix-tauri-poc-evidence-measurement-fallback-20260812-34de7bf6-summary.md`、`1250-fix-tauri-poc-webview-ready-evidence-20260812-76e8f16d-summary.md`、`1311-recover-tauri-stale-instance-lock-20260812-9b0f07bd-summary.md`、`1326-fix-tauri-stale-lock-recovery-race-20260812-d17b129d-summary.md` | Tauri の実装、provenance 分離、WebView usability、stale lock recovery / replacement race、検証結果 |
| 候補の契約・実装 | `tools/desktop-poc/electron/README.md`、`tools/desktop-poc/electron/evidence-schema.json`、`tools/desktop-poc/tauri/README.md`、`tools/desktop-poc/tauri/evidence-schema.json` | 測定条件、status semantics、process / window / update の記録境界 |
| 共通 evidence | `/private/tmp/cornell-method-desktop-poc/mvp-gate0-20260812-dcc057d8/shared/baseline-manifest.json`、`shared/fixture.sqlite` | baseline identifier、fixture hash / contentHash、環境、測定規則、read-back |
| 候補 evidence | `/private/tmp/cornell-method-desktop-poc/mvp-gate0-20260812-dcc057d8/electron/evidence/`、`.../tauri/evidence/` | 最終 manifest、各 report、superseding baseline retry、artifact directory の実在状態 |

## Changes Made

| パス | 変更内容 | 理由 |
|---|---|---|
| `summary/20260812/1337-compare-desktop-shell-poc-evidence-20260812-summary.md` | Electron / Tauri の比較結果、証跡 provenance、未確認事項、追加確認条件を新規記録 | 既存 evidence / summary / 正本文書を変更せず、発注者の shell 選定材料を残すため |

## 判定ルール

- `PASS` は candidate 全体の合格ではなく、baseline validation、準備、静的テストなど、根拠が実際に存在する個別軸だけに付ける。
- `BLOCKED` は実行を試みたが、依存取得、loopback bind、native CLI / Cargo 等の具体的阻害で後続確認に進めなかった状態とする。
- `UNVERIFIED` は観測・数値・runtime / GUI / native build の根拠がない状態とする。未測定の数値を推測しない。
- `未測定` は特に数値が存在しないことを示す。staging directory の容量は `.app` / DMG artifact サイズの代替にしない。

## 比較結果

### Candidate-level conclusion

両候補の最終 evidence manifest は `status: BLOCKED` であり、shell は未選定である。共通入力の一致は確認できるが、cold start、操作反応、関連 process 合計メモリ、`.app` / DMG 実測、native lifecycle、candidate runtime の persistence / reopen が両候補とも成立していないため、現時点では性能・軽量性・実装容易性の順位を付けられない。

### 共通 baseline / 条件

| 比較条件 | 共有値 | Electron evidence | Tauri evidence | 正規化判定 |
|---|---|---|---|---|
| baseline identifier | `mvp-gate0-20260812-dcc057d8` | 一致 | 一致 | `PASS`（入力一致） |
| baseline scope | `dcc057d81b612573a5360b6f0b5bd9faea96f6e7586f59c833fc98bed978b72c` | `scope_sha256` として一致 | `baselineScopeSha256` として一致 | `PASS`（入力一致） |
| fixture | 10,000 notes、seed `cornell-method-fixture-v1`、SHA-256 `bdb9d9996bf03c5c9885b9e1d13fdcce3cbf2925f559171bd9890fc4da6bc46e`、contentHash `f01c404495412554a404154c7888577f681e536f72a75fb97b35643c2f3a7de6` | 一致。preparation で copy / read-back も `PASS` | 一致。shared fixture の validation / read-back は `PASS` | `PASS`（fixture 一致。ただし Tauri candidate staging 未成立） |
| target | Apple Silicon arm64、macOS 26.0.1、Node v22.12.0、npm 10.9.0 | 一致 | 一致。Rust 1.97.1 / Cargo 1.97.1 も観測、Tauri CLI は null | `PASS`（測定対象の端末条件） |
| build mode | 同じ production Next.js webpack build、loopback runtime | `production-next-webpack` build `PASS`、36,166 ms | `UNVERIFIED`。preparation が `BLOCKED` のため build 未実行 | 比較条件は定義一致、実行状態は不一致 |
| cache / repetition | cache 条件をそろえ、各軸 1 trial、threshold なし | `cold candidate staging output; root .next untouched` | `UNVERIFIED` | 条件一致の意図は確認、実測条件の成立は未完 |
| runtime boundary | `127.0.0.1:37821`、live DB は app bundle 外 | 一致 | 一致 | `PASS`（静的条件。runtime listen は未成立） |

baseline と fixture の identity は同じだが、Tauri の cache state は未確認であり、Electron だけが production build と candidate preparation を完了している。このため、baseline の「入力比較」は可能でも、性能や artifact の「結果比較」はまだ可能ではない。

### 必須比較軸

| 比較軸 | Electron | Tauri + Node.js sidecar | 正規化した状態 / provenance |
|---|---|---|---|
| cold start、runtime readiness、primary-window usability | `measurements.coldStart` は `UNVERIFIED`。Electron package 未導入で smoke が開始されず、runtime readiness / primary window usability の数値なし | `UNVERIFIED`。preparation `BLOCKED` で shell smoke 未起動。`PageLoadEvent::Finished` 後だけ usable とする実装はあるが、timestamp なし | **未測定。両候補とも runtime / GUI PASS なし** |
| 一覧・検索・詳細・編集・保存・reopen の反応 | `operations` は `UNVERIFIED`。Electron renderer 未実行。runtime HTTP も `BLOCKED`（`listen EPERM`） | `operationResponse` は `UNVERIFIED`。runtime HTTP は preparation 未成立で `BLOCKED`。README の runtime HTTP fallback は選択できる状態に到達していない | **未測定。数値・UI provenance なし**。HTTP/API を UI smoke に読み替えていない |
| 関連 process 合計メモリ | `memory` は `UNVERIFIED`。process records / `totalRssKb` なし | `memory` は `UNVERIFIED`。native shell / sidecar 未起動で records / total なし | **未測定。推測値なし** |
| `.app` / DMG artifact サイズ、hash、architecture | `package.json` は `BLOCKED`（`electron-builder` がない）。artifact directory は 0B、`.app` / DMG 未生成 | `package.json` は `BLOCKED`（`cargo tauri` 未導入）。artifact directory は 0B、`.app` / DMG 未生成 | **実測なし**。arm64 target の config は証跡ではあるが artifact 実測ではない |
| SQLite / Prisma / migration / reopen | preparation `PASS`。clean DB に既存 4 migration を適用し、integrity / FK `pass`。populated fixture copy は件数・hash・integrity read-back `PASS`。candidate runtime save / reopen は `UNVERIFIED` | shared fixture の validation / read-back は `PASS`。candidate preparation は `BLOCKED`（staging `npm ci` の `ENOTFOUND`）で clean migration、runtime read/write、save / reopen は `UNVERIFIED` | Electron は **準備範囲のみ PASS**。Tauri は **shared fixture 範囲のみ PASS**。pending migration、failure injection、runtime read-back は未確認 |
| single application instance | 静的には Electron `requestSingleInstanceLock`、`second-instance`、既存 window の restore/show/focus、1 primary window の実装あり。lifecycle evidence は `BLOCKED` | 静的には owner marker + `create_new` lock + Unix socket focus handoff、1 `main` window の実装あり。lifecycle は preparation `BLOCKED` | **runtime UNVERIFIED**。静的コード / test は runtime PASS に昇格しない |
| duplicate-launch focus / primary window | 静的実装は `second-instance` event と `BrowserWindow` count。実際の二重起動・focus acknowledgement・window count は未観測 | 静的実装は verified owner marker、bounded retry、`focused` acknowledgement、`PageLoadEvent::Finished` による usability 分離。実際の二重起動は未観測 | **runtime UNVERIFIED**。内部 helper process の存在だけで不合格にはしない |
| 最後の primary window 終了 / process cleanup | process group と descendant closure の scope を両方向検証し、explicit PID tree fallback と bounded SIGTERM / SIGKILL を実装。smoke / lifecycle が package 不在で `BLOCKED`、残存 PID 0 の証跡なし | sidecar の group / descendant closure、SIGTERM、期限付き SIGKILL、PID tree fallback を実装。JS tests は `PASS`、native runtime / lifecycle は `BLOCKED`、残存 PID 0 の証跡なし | **runtime UNVERIFIED**。process-tree の静的テストは cleanup PASS の代替ではない |
| stale lock recovery / replacement race | Electron 独自の stale-lock / replacement-race evidence または test は対象証跡にない。Electron lock API へ委譲する設計かは runtime で未確認 | owner の PID / PGID / command identity を照合し、malformed / mismatch / unverifiable は fail closed。stale lock / socket の quarantine、recovery lock 予約、replacement race で新 owner の path を触らない実装と unit test を追加。ただし native `cargo test` は `index.crates.io` DNS で `BLOCKED`、runtime 未確認 | Electron **UNVERIFIED**、Tauri **静的設計・未実行 native test**。どちらも運用上の PASS ではない |
| DMG / app 内 update / sidecar bundling | update manifest 生成は `PASS`（static local manifest、explicit restart、failure 時 current version 維持の metadata）。background download / signature verification / apply は future boundary。Node と完全な native dependency tree の同梱は未確定 | update manifest は `BLOCKED`（packaging 未成立）。explicit restart 等は template にあるが product updater ではない。host Node を完全な distributable sidecar として bundle した証跡なし | **成立見通しのみ**。DMG、署名、完全性検証、download、rollback、sidecar bundle は未実測・未実装境界 |
| 実装・保守難度、依存、導入・運用コスト | JS shell。Electron `37.3.1` / electron-builder `26.0.12` を exact pin。npm install は `ENOTFOUND`、`package-lock.json` 未生成、runtime dependency 未導入 | Rust shell + Node sidecar。Tauri / tauri-build `2.5.1`、serde / serde_json exact pin。candidate JS package に runtime deps はないが `npm ci` と Cargo resolution が未成立、`Cargo.lock` 未生成 | **数値コスト未測定**。下記の比較は静的な cost driver / inference であり、採用順位ではない |

### 安全性・境界の確認

| 観点 | Electron | Tauri + Node.js sidecar | 判定 |
|---|---|---|---|
| loopback / user data | 固定 `127.0.0.1:37821`、absolute file URL、live DB は bundle 外 | 同じ固定 host / port、candidate user-data の live DB は bundle 外 | 静的条件 `PASS`。listen / runtime は未確認 |
| shell-to-renderer boundary | preload は shell API を公開せず、context isolation / sandbox を設定 | Tauri plugin なし、`withGlobalTauri: false`、shell API を evidence に公開しない | 静的設計の強み。native / packaged 実行は未確認 |
| update / migration failure boundary | static metadata のみ。署名、migration staging、rollback は Desktop Alpha で別途確認が必要 | static metadata のみ。署名、migration staging、rollback は Desktop Alpha で別途確認が必要 | **未確認**。PoC metadata を製品安全性の証拠にしない |

## Candidate ごとの整理

### Electron

#### 確認済みの強み（準備・静的証跡に限定）

- shared baseline / fixture を検証し、candidate staging、clean SQLite migration、10,000-note fixture の byte copy / read-back、production Next webpack build を完了した。build の実測は 36,166 ms だが、desktop cold start ではない。
- `requestSingleInstanceLock`、`second-instance`、既存 primary window の focus、固定 loopback、live DB の bundle 外配置が実装されている。
- process-tree cleanup は、descendant closure、process group の外部 member、group 外 descendant の両方向を検証し、検証不能時は explicit PID tree へ fallback する設計になっている。candidate `npm test` は最終 summary で 19 tests `PASS`。
- artifact collector の app directory / DMG の重複収集防止、hash / architecture の未確認時 `UNVERIFIED` 記録を静的 test で確認している。

#### 未解決 risk

- Electron / electron-builder の install が npm registry `ENOTFOUND` で止まり、lockfile、Electron binary、builder、runtime、GUI、lifecycle、memory、`.app` / DMG が未成立である。
- `baseline-validation.json` は初回に `_prisma_migrations` 不在で `BLOCKED` だが、後続 retry files が `supersedes` を明記して shared manifest / toolchain validation を `PASS` としている。最終比較では retry を採用するが、raw report の履歴差は provenance として残る。
- packaged artifact に Node runtime と完全な native dependency tree を同梱する実証がない。PoC の update manifest は製品 updater ではない。
- stale lock recovery / replacement race を候補固有に検証した evidence がなく、forced termination 後の再起動挙動は未確認である。

#### Desktop Alpha 前の追加確認（優先度）

1. **P0**: 実際の Electron / electron-builder install（registry または承認済み offline cache）と lockfile を成立させ、同じ baseline / cache ルールで build を再実行する。
2. **P0**: Electron binary で cold start、`/notes` usable、list / search / detail / edit / explicit save / reopen、関連 process RSS 合計を取得する。runtime HTTP を UI 結果と混同しない。
3. **P0**: 二重起動、existing primary window focus、last-window close、runtime listener、descendant closure、orphan PID なしを native lifecycle で観測する。
4. **P0**: arm64 `.app` / DMG の実ファイル、size、hash、main binary architecture、同梱 Node / Prisma / native resources を確認する。
5. **P1**: forced termination / stale state 後の次回起動、migration / reopen 失敗時の live DB 非破壊性、Desktop Alpha の update / migration pipeline への接続条件を確認する。

### Tauri + Node.js sidecar

#### 確認済みの強み（準備・静的証跡に限定）

- shared baseline / fixture の identity、read-back 件数、FK / SQLite integrity を `PASS` で記録している。候補固有の staging は未成立なので、これは candidate runtime の DB PASS ではない。
- `PageLoadEvent::Finished` かつ固定 `/notes` URL の後だけ primary-window usability timestamp を記録し、window created / count と page usability を分離している。未観測時の timestamp fallback は削除済み。
- process group の scope、descendant cleanup、native shell cleanup と sidecar-only cleanup、runtime HTTP と WebView UI smoke の provenance を別々に記録する設計である。candidate JS tests は最終 summary で 22 tests `PASS`。
- owner marker の process identity 検証、active owner への bounded focus handshake、malformed / mismatch / unverifiable の fail closed、stale lock / socket の atomic quarantine と replacement-lock race hardening が実装されている。これは静的コード / 追加 test の確認であり、native runtime の PASS ではない。

#### 未解決 risk

- candidate staging の `npm ci` が `registry.npmjs.org` の `postcss` 解決で `ENOTFOUND`。production Next build、sidecar runtime、candidate clean migration、UI / lifecycle が未実行である。
- Cargo dependency resolution が `index.crates.io` の DNS で止まり、`cargo tauri` も未導入。`Cargo.lock`、native build、`.app` / DMG、native `cargo test` が未成立である。
- PoC は host Node binary を起動する設計で、完全な distributable Node / native dependency tree の sidecar bundling は未確認である。
- stale recovery / replacement race の Rust unit test は追加されたが、`cargo test` 自体が network blocker で未実行。実機の stale lock recovery も未確認である。

#### Desktop Alpha 前の追加確認（優先度）

1. **P0**: candidate staging の `npm ci`、Cargo dependency resolution、`cargo tauri` を同一の baseline / cache 条件で成立させ、実在する `Cargo.lock` を得る。fake lockfile は採用しない。
2. **P0**: native Tauri shell + sidecar で runtime readiness、`PageLoadEvent::Finished` usability、list / search / detail / edit / explicit save / reopen、RSS 合計を取得する。GUI automation がない場合は UI 軸を `BLOCKED` / `UNVERIFIED` のまま残す。
3. **P0**: duplicate launch の verified focus acknowledgement、primary window count、last-window close、sidecar / shell process-tree cleanup、loopback listener 消滅を観測する。
4. **P0**: arm64 `.app` / DMG の実ファイル、size、hash、architecture、sidecar Node / native resource の bundle 状態を確認する。
5. **P0**: stale owner の通常 recovery、active owner の focus failure、malformed marker、replacement-lock race、強制終了後の再起動を native test / disposable user-data で確認する。
6. **P1**: migration / reopen failure 時の live DB 非破壊性と、Desktop Alpha の update / migration pipeline に sidecar の version / integrity を結び付ける方法を確認する。

## 追加確認の共通優先順位と依存関係

| 優先度 | 追加確認 | 対象 | 依存関係 | 完了の判断 |
|---|---|---|---|---|
| P0 | registry / Cargo / native CLI の実行環境を復旧し、candidate preparation / build を再実行 | 両候補（Electron は npm、Tauri は npm + Cargo） | 同じ baseline、同じ cache policy、候補別 isolated directory | preparation、build、lockfile / dependency provenance が実在する |
| P0 | native runtime / GUI smoke | 両候補 | preparation + build、loopback bind、GUI automation または実機操作 | runtime readiness、primary-window usability、操作反応に数値と provenance がある |
| P0 | DB / migration / read-write / reopen | 両候補 | candidate runtime、disposable clean / populated user-data | clean migration、fixture read-back、save / reopen、failure 時 live DB 非破壊を別々に記録 |
| P0 | single instance / focus / cleanup | 両候補 | native runtime、二重起動可能な shell binary | 1 instance / 1 primary window、focus、last-window close、listener / process tree cleanup が観測できる |
| P0 | `.app` / DMG / sidecar artifact | 両候補 | native build、packaging tool、実ファイル | size / hash / architecture / bundle 内 runtime の実測がある。directory 0B は未生成として扱う |
| P0 | stale lock / replacement race | Electron は delegated behavior を含む、Tauri は owner marker path | native lifecycle、強制終了、disposable user-data | stale、active、malformed、race の結果が `PASS` / `BLOCKED` / `UNVERIFIED` で分離される |
| P1 | update / migration safety | 選定前は両候補の成立見通し、選定後は採用候補 | artifact、manifest、署名・完全性検証方式の決定 | explicit restart、failure 時 current version / live DB 維持、package integrity の根拠がある |
| P1 | 保守・総コストの棚卸し | 両候補 | 実 artifact、build / CI 実行、依存 version | dependency 更新、toolchain、CI、配布 storage / bandwidth、Apple 関連費用、debug / 保守工数の前提を明記。推測値は作らない |

## 発注者の shell 選定条件

### 採用候補として残す条件

- 両候補とも同じ baseline / fixture / Apple Silicon 条件で、cache 状態を `UNVERIFIED` なしにそろえる。
- cold start（runtime ready と primary-window usable を分離）、一覧・検索・詳細・編集・保存・reopen、関連 process 合計メモリ、`.app` / DMG サイズを実測し、各数値に source / provenance がある。
- SQLite / Prisma / migration / reopen、single application instance / 1 primary window、duplicate-launch focus、last-window cleanup、stale lock / replacement race の required behavior に `BLOCKED` / `UNVERIFIED` が残らない。必要なら追加 disposable test の結果を記録する。
- package と sidecar の実体、loopback / user-data 境界、更新 package の integrity、migration / update failure 時の current version と live DB の維持方法が説明できる。
- 数値差が再現可能ならその差を考慮し、差が小さい・指標が分かれる場合は保守性と安全性を優先する。差の判定 threshold は新設しない。
- license、Apple、配布、CI、依存更新、障害切り分け、保守工数の不確実性を明示した比較を発注者が承認する。

### 却下条件

- required な native runtime / lifecycle / DB / packaging 軸が `BLOCKED` または `UNVERIFIED` のまま、あるいは候補の成立を静的コードだけで主張する。
- 1 application instance / 1 primary window、duplicate focus、process cleanup、stale lock のいずれかで、新しい window / instance、orphan process、誤った lock / socket 削除などの安全性問題が実測で確認される。
- live DB を app bundle に置く、migration / update failure で現行版または live DB を非破壊に維持できない、sidecar / native dependency が配布 artifact に含まれない、または artifact の architecture / integrity が確認できない。
- `BLOCKED` / `UNVERIFIED` を runtime HTTP、静的 test、作成予定の metadata、process 数だけで覆い隠す。

### 追加実測が必要な条件

現在はこちらに該当する。両候補の performance、memory、artifact、native lifecycle、candidate persistence は未測定または BLOCKED であり、発注者はこれらの P0 確認後に shell を選定する。Electron / Tauri のどちらも採用済みとは扱わない。

## Findings

| ID | fact / assumption / unknown | 内容 | 根拠 |
|---|---|---|---|
| F-001 | fact | 両候補は同じ baseline identifier、baseline scope、10,000-note fixture、seed / hash、Apple Silicon arm64、macOS 26.0.1 を記録している | shared `baseline-manifest.json` と両 final manifest |
| F-002 | fact | Electron は preparation、clean migration / fixture copy read-back、production Next webpack build まで `PASS`。Tauri は shared baseline / fixture validation まで `PASS` | 各 `preparation.json`、`build.json`、`baseline-validation.json`、final manifest |
| F-003 | fact | Electron は npm install / Electron package / builder / loopback runtime が阻害され、Tauri は staging `npm ci` / Cargo / Tauri CLI が阻害されている | 各 `runtime-http-smoke.json`、`preparation.json`、`package.json`、task summary |
| F-004 | fact | cold start、操作反応、関連 process RSS 合計、`.app` / DMG 実測、native lifecycle の数値は両候補にない | 各 final manifest の `measurements`、`lifecycle`、`artifacts` |
| F-005 | fact | Tauri evidence は runtime HTTP fallback、WebView UI smoke、native cleanup、primary-window usability、runtime readiness を別 provenance として保持している | `tauri/README.md`、`tauri/evidence-schema.json`、`1247` / `1250` summary |
| F-006 | fact | Tauri の stale recovery / replacement race は static Rust code と追加 unit test で扱うが、native `cargo test` と runtime lifecycle は未実行 | `1311` / `1326` summary、`src-tauri/src/main.rs` |
| F-007 | fact | Electron の baseline 初回 report は `_prisma_migrations` 不在で `BLOCKED`。後続 retry report は `supersedes` を記録して baseline / toolchain validation を `PASS` | `electron/evidence/baseline-validation.json` と `baseline-validation-retry-*.json` |
| U-001 | unknown | 現時点で性能、メモリ、artifact サイズ、native lifecycle、候補 runtime persistence の優劣は判定不能 | 両候補の required axis が未測定 / BLOCKED |
| U-002 | unknown | Electron の stale lock delegated behavior と Tauri の実機 stale recovery / race の安全性は未確認 | lifecycle evidence が両候補とも `BLOCKED` |
| U-003 | unknown | `.app` / DMG に Node runtime、Prisma、native dependency tree、sidecar がどう同梱されるか未確認 | artifact directory 0B、packaging report `BLOCKED` |
| U-004 | unknown | 更新 provider、署名・完全性検証、migration / update rollback の実装方式と総コストは未決定・未測定 | update manifest は PoC metadata のみ、正本文書の未決事項 |
| A-001 | assumption | JS-only の Electron shell は shell code の言語境界が少なく、Rust shell + Node sidecar の Tauri は toolchain / process boundary が増える、という保守性差は設計からの inference にすぎない | package / Cargo 構成。実工数・障害率・コストの evidence ではない |
| A-002 | assumption | Electron の built-in instance lock と Tauri の custom owner marker の運用差は、実機の強制終了・再起動証跡がそろうまで比較優劣にしない | 静的実装と未実行 lifecycle |

## Verification

| 確認項目 | 結果 | 備考 |
|---|---|---|
| 作業前 `git status --short` | 完了 | 既存の modified / untracked file を確認し、今回の比較対象外として保持した |
| evidence JSON の parse | 完了 | shared manifest、両 final manifest、各 report を `jq -e empty` / `jq` で読み取り |
| baseline / fixture / target の正規化 | 完了 | shared / Electron / Tauri の identifier、scope、fixture hash、target を read-only query で突合 |
| evidence / artifact state の確認 | 完了 | final manifest、retry report、`find`、artifact directory の `du` を確認。両 artifact directory は 0B、`.app` / DMG は未生成 |
| runtime / GUI / native Cargo build | 未実行 | 既存 evidence と summaries を評価する task のため再実行せず、既存の BLOCKED / UNVERIFIED を維持 |
| 作業後 `git status --short` | 完了 | 下記の新規 summary 以外に変更を加えていないことを確認 |

## Remaining Unknowns

| ID | 未確認事項 | 次に必要な根拠 |
|---|---|---|
| U-001 | 両候補の cold start、runtime ready、primary-window usable、UI operation response | 同一 cache / fixture での native runtime / GUI evidence |
| U-002 | process 合計 RSS、`.app` / DMG size・hash・architecture | 実行中 process tree と実在 artifact |
| U-003 | candidate runtime の Prisma / SQLite migration、save / read-back、reopen、failure non-destructiveness | clean / populated disposable user-data の native runtime test |
| U-004 | single instance、duplicate focus、primary window、last-window cleanup、orphan process | 両候補の lifecycle runner と process table before / after |
| U-005 | Electron stale lock delegated behavior、Tauri stale recovery / replacement race の実機結果 | 強制終了・malformed marker・replacement race の native test |
| U-006 | sidecar / Node / native dependency の配布同梱、DMG、update package integrity、rollback | native packaging、実 artifact inspection、update / migration failure injection |
| U-007 | implementation / maintenance / license / Apple / CI / distribution / operational cost | 実 artifact と build / CI 条件をもとにした発注者向け前提表。現時点で金額推測をしない |

## Next Read

次の作業では raw log ではなく、この比較 summary と final evidence の最小集合を起点にする。

- `summary/20260812/1337-compare-desktop-shell-poc-evidence-20260812-summary.md`
- `HANDOFF_2026-08-12.md`
- `/private/tmp/cornell-method-desktop-poc/mvp-gate0-20260812-dcc057d8/shared/baseline-manifest.json`
- `/private/tmp/cornell-method-desktop-poc/mvp-gate0-20260812-dcc057d8/electron/evidence/electron-evidence-manifest.json`
- `/private/tmp/cornell-method-desktop-poc/mvp-gate0-20260812-dcc057d8/tauri/evidence/tauri-evidence-manifest.json`
- `tools/desktop-poc/electron/README.md`
- `tools/desktop-poc/tauri/README.md`
