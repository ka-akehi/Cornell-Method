---
summary_type: evidence-summary
created_at: 2026-07-31 JST
task_kind: worker-task
task_status: done
judgement: PASS
---

# Postgres source reader native failure fallback evidence

## Objective

現行 MVP schema の frozen SQLite fixture に対して、`better-sqlite3` の native failure を一時 harness で注入し、`sqlite3` CLI fallback と read-only snapshot が実際に成立することを確認した。通常の native 経路との結果差分、および source の読み取り前後の不変性を記録する。

## Scope

| 項目 | 内容 |
|---|---|
| 基準 | `develop` / `4333011` (`docs: update project handoff`) |
| 対象実装 | `scripts/postgres-migration-common.js` の `readSourceSnapshot` / reader 経路 |
| 参照 | `test/postgres/data-migration-contract.test.js`、`scripts/postgres-reconcile.js`、`README.md` |
| target | Postgres target、Vercel、Supabase、Production、`DIRECT_URL`、個人 DB には接続していない |
| 実装変更 | 製品コード、テスト、設定、依存関係、README、migration は変更していない |

## Inputs Read

| 種別 | パス | 確認内容 |
|---|---|---|
| handoff | `HANDOFF_2026-07-31.md` | native load failure smoke が未確認であること、継続時の最小 read |
| implementation | `scripts/postgres-migration-common.js` | native reader、CLI fallback、schema/migration/integrity/FK/Canvas validation、source hash guard |
| contract test | `test/postgres/data-migration-contract.test.js` | fixture と require / constructor hook の契約参照 |
| reconcile | `scripts/postgres-reconcile.js` | source snapshot 後に target configuration / connection へ進む構成 |
| operator docs | `README.md` | source 明示、operator-only、target allowlist / direct URL の手順 |
| prior summary | `summary/20260731/1751-smoke-postgres-native-reader-fallback-20260731-811f3fc3-summary.md` | 自動 summary だけでは native failure / fallback の実測根拠が不足していること |

## Changes Made

| パス | 変更内容 | 理由 |
|---|---|---|
| `summary/20260731/worker-postgres-native-reader-fallback-20260731.md` | native / fallback evidence、前後 probe、cleanup、判定を記録 | 指定された専用 evidence summary |

製品コード、テストコード、設定、依存関係、README、migration は変更していない。fixture、temporary harness、raw log は repository 外で作成し、削除済み。

## Evidence method

- 作業開始時に `git status --short` と `sqlite3 -version` を実行した。作業前の status には既存の未追跡 summary 5 件があり、変更せず保持した。
- `/private/tmp` 配下に現行 MVP の `_prisma_migrations`、`notebooks`、`notebook_canvases`、`tags`、`notebook_tags`、`cues` を持つ isolated fixture を作成した。各対象 table は最小 1 行、migration state は完了済み 3 行とした。Phase 2 table は含めていない。
- fixture は作成後に mode `0444` へ変更し、WAL / SHM sidecar がないことを確認した。temporary Node harness は repository 外に置き、`Module._load` require hook で `ERR_DLOPEN_FAILED` を注入した。製品 script / test は編集していない。
- harness は `node:child_process` の `execFileSync` を一時的に計数し、forced failure 後に `/usr/bin/sqlite3` の `-version` probe と query が実際に呼ばれたことを確認した。結果の row 内容は plaintext で出力せず、ordered selected-row JSON の SHA-256 digest で比較した。
- native snapshot と各 fallback snapshot は `reconcileRows` で比較した。Canvas は `parseCanvasDocument` で validation し、page geometry、element 数、document / searchText digest を記録した。

## Environment

| 項目 | 実測値 |
|---|---|
| OS / arch | Darwin arm64 |
| Node / npm | `v22.12.0` / `10.9.0` |
| sqlite CLI | `/usr/bin/sqlite3`, `3.51.0` |
| source mode | `0444` |
| fixture location | repository 外の `/private/tmp`（cleanup 済み） |

## Fixture and before/after probe

対象 table は `_prisma_migrations`, `cues`, `notebook_canvases`, `notebook_tags`, `notebooks`, `tags` の 6 table。対象 MVP columns は before / after で一致した。

Migration state は次の 3 件がすべて `finished=true`, `rolledBack=false`, `appliedStepsCount=1` だった。

- `20260621073258_init`
- `20260718011243_remove_notebook_overview`
- `20260718140000_add_notebook_canvas`

| probe | schema / migration | integrity | FK violations | Canvas validation | row digest |
|---|---|---|---:|---|---|
| 読み取り前 | 一致 | `ok` | 0 | valid 1 / page `1200x800` / 1 element | 下表 |
| 読み取り後 | 前と完全一致 | `ok` | 0 | valid 1 / page `1200x800` / 1 element | 下表と完全一致 |

ordered selected-row JSON の digest（plaintext なし）は次のとおり。各 table の count は before / after、native、require fallback、constructor fallback で同一だった。

| table | count | SHA-256 |
|---|---:|---|
| `notebooks` | 1 | `6f6feb35eb5a484ac90905d8cbf6c268458dcf115a18c46800f3bbf2f6e107cb` |
| `notebook_canvases` | 1 | `9eda54ee971a1d4ff77f6ec0bec19a8a9def4175d97304f50a286064f0e12813` |
| `tags` | 1 | `a7278711c4dbf1d46455e5723a522be84ef60acde95b0e1629b26675cb455cfd` |
| `notebook_tags` | 1 | `56b9f95e47c62a803c88b470dc6fd203a345864543265aa61e115612ecc44eea` |
| `cues` | 1 | `a4ba151aa27409515e4992211d329352cedf11398c5ee90fef876a28add883fa` |

Canvas `document_json` は schema version 1、page `1200x800`、1 element として valid。document digest は `09571d954df617ce4cb5d438ebeb59446c3d559c8cc0065d1fc26ced629c0c79`、`search_text` digest は `419eed0561fb25bafa084fb612bf771984752f273bb3e48f17e7c12b4d9667a5` で、before / after と全 snapshot 経路で一致した。

## Native / fallback results

| 経路 | native failure 注入 | CLI 呼出し | snapshot | native との比較 | 判定 |
|---|---|---:|---|---|---|
| normal native | なし。`better-sqlite3` の read-only open と `query_only=1` を確認 | 0 | 成功 | 基準 | PASS |
| require fallback | `Module._load` が `better-sqlite3` require 1 回に `ERR_DLOPEN_FAILED` を送出 | 15（version 1 + query 14） | 成功 | `reconcileRows`: pass、mismatch 0、各 table count 1、orphan 0 | PASS |
| constructor fallback | fake constructor 1 回に `ERR_DLOPEN_FAILED` を送出 | 15（version 1 + query 14） | 成功 | `reconcileRows`: pass、mismatch 0、各 table count 1、orphan 0 | PASS |

forced failure の `error.code`、hook call 数、CLI 呼出し計数、snapshot 成功を同一 run で取得したため、synthetic contract test の結果だけでなく、temporary harness が実際に fallback reader へ到達した証跡になっている。

## Source read-only invariants

全経路で読み取り前後が次の値で一致した。

| 経路 | bytes before / after | SHA-256 before / after | WAL | SHM | 判定 |
|---|---:|---|---|---|---|
| normal native | `69632 / 69632` | `c9da60d23d05725cb0d422117b862b9769b3ed206437dd98d9fb333333679a88` / 同一 | absent / absent | absent / absent | PASS |
| require fallback | `69632 / 69632` | 同一 hash / 同一 hash | absent / absent | absent / absent | PASS |
| constructor fallback | `69632 / 69632` | 同一 hash / 同一 hash | absent / absent | absent / absent | PASS |

## Reconcile script no-target check

`node scripts/postgres-reconcile.js --source <temporary fixture> --target-project ...` を target configuration 不足の状態で実行した。exit `1`、stdout 0 bytes、stderr は target project / environment / allowlist の明示要求で終了し、Postgres 接続へ進まなかった。実 target reconcile の結果は今回の scope 外であり、接続していないことを PASS 根拠とする。

## Verification

| 確認項目 | 結果 | 備考 |
|---|---|---|
| 作業前 `git status --short` | PASS | 既存 summary 5 件を確認・保持 |
| 作業前 `sqlite3 -version` | PASS | `/usr/bin/sqlite3` 3.51.0 |
| fixture schema / migration / integrity / FK probe | PASS | before / after 完全一致 |
| normal native `readSourceSnapshot` | PASS | native read-only / query-only、CLI 0 回 |
| require failure → CLI fallback | PASS | forced `ERR_DLOPEN_FAILED`、CLI 15 回、mismatch 0 |
| constructor failure → CLI fallback | PASS | forced `ERR_DLOPEN_FAILED`、CLI 15 回、mismatch 0 |
| source hash / size / sidecar | PASS | 全経路で不変、WAL / SHM なし |
| reconcile target 接続 | 未実施 | 実 target / `DIRECT_URL` へ接続しない制約による意図的未実施 |
| `git diff --check` | PASS | summary 作成前の tracked diff に whitespace error なし |
| temporary cleanup | PASS | fixture、harness、logs の directory を削除し存在しないことを確認 |
| `npm run lint` / `npm run build` | 未実施 | 製品コードを変更しない evidence-only task のため |

## Findings

| ID | fact / assumption / unknown | 内容 | 根拠 |
|---|---|---|---|
| F-1 | fact | native dependency の通常経路と forced failure 経路を区別できた | native direct open、CLI 計数、hook call 数 |
| F-2 | fact | require failure と constructor native failure の双方が CLI fallback で同一 snapshot を返した | `reconcileRows` pass / mismatch 0、row digest 一致 |
| F-3 | fact | source の schema、migration state、integrity、FK、row digest、Canvas validation、hash / size / sidecar が読み取り前後で不変だった | before / after probe と per-case file state |
| F-4 | fact | this evidence は isolated synthetic fixture の operator smoke 根拠であり、先行自動 summary だけには依存していない | 本 summary の temporary harness 実測 |
| U-1 | unknown | 実際の壊れた native binary / operator machine packaging が同じ failure code になるか | 今回は要求された require hook / constructor hook による注入のみ |
| U-2 | unknown | 実 Postgres target との baseline / row reconcile | target 接続を禁止した scope のため未確認 |

## Judgement

**PASS（isolated frozen fixture に対する native failure → `/usr/bin/sqlite3` CLI fallback → read-only snapshot の evidence task として）**。これは Production、Vercel、Supabase、実 Postgres target の readiness を示す判定ではない。

## Remaining Unknowns

| ID | 未確認事項 | 次に必要な根拠 |
|---|---|---|
| U-1 | 実際の壊れた native binary / operator machine packaging の failure 再現 | 対象 operator 環境での同等 smoke（今回の synthetic hook とは別） |
| U-2 | 実 Postgres target との baseline / row reconcile | 明示許可された isolated target と `DIRECT_URL` を使う別 task |

## Cleanup

`/private/tmp/cornell-postgres-native-reader-fallback-HoUoB0` は harness result、reconcile check output、fixture DB を含めて削除済み。repository 内の変更は本 summary のみで、既存の未追跡 summary は変更・削除していない。

## Next Read

- `scripts/postgres-migration-common.js`
- `test/postgres/data-migration-contract.test.js`
- `scripts/postgres-reconcile.js`
- `README.md` の Postgres baseline / import / reconcile operator 手順
