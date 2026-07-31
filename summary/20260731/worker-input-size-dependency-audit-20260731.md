## Objective

未制限入力と依存パッケージの残余リスクを、現行 MVP 契約・実装・確認可能なローカル DB の範囲で棚卸しし、次の coding task で採用判断できる入力上限、DoS 境界、依存更新の検証条件を整理する。

## Scope

| 項目 | 内容 |
|---|---|
| 対象領域 | Notes contract / API route / remote query / Canvas JSON / Prisma schema / 依存 lockfile / MVP docs / ローカル DB の集計値 |
| 対象ファイル / ディレクトリ | `src/modules/notes/contracts/`、`src/app/api/`、`src/modules/notes/remote/`、`src/shared/canvas/`、`src/server/notes/infrastructure/`、`prisma/schema*.prisma`、`package.json`、`package-lock.json`、`README.md`、MVP 契約、テスト観点 |
| 対象外 | コード・設定・依存関係・DB・生成物の変更、実 Postgres target、未接続環境の本番データ、依存バージョンの推測更新 |

## Inputs Read

| 種別 | パス | 確認内容 |
|---|---|---|
| Repository | `HANDOFF_2026-07-31.md`、`AGENTS.md` | 現在地、未確認範囲、summary 運用、未コミット変更を確認 |
| Contract | `src/modules/notes/contracts/{notebook,cue,tag,query}.schema.ts` | 文字列、配列、タグ、query、page の現行 validation |
| API | `src/app/api/notes/route.ts`、`src/app/api/notes/[id]/route.ts`、`src/app/api/notes/[id]/review/route.ts` | JSON parse と query 取得の境界 |
| Canvas | `src/shared/canvas/canvas-document-{types,validation,serialization,size}.ts` | page、element、points、serialized JSON の境界 |
| Persistence | `src/server/notes/infrastructure/{read.query,read.repository,notebook.command.repository,relations.repository,canvas.persistence}.ts` | page size 50、DB 保存形式、検索、関連数の無制限箇所 |
| Contract docs | `doc/implementation/MVP_CONTRACT.md`、`README.md`、`doc/testing/TEST_SCENARIOS.md` | MVP の必須値、Canvas 2MiB、既存の長文 overflow 未確認範囲 |
| Schema | `prisma/schema.prisma`、`prisma/schema.postgres.prisma`、migration SQL | Notebook / Canvas / Cue / Tag が `TEXT` で DB 側上限を持たないこと |
| Dependency | `package.json`、`package-lock.json` | direct version、overrides、lockfile 状態 |

## Changes Made

| パス | 変更内容 | 理由 |
|---|---|---|
| `summary/20260731/worker-input-size-dependency-audit-20260731.md` | 調査結果のみを追加 | Worker 完了要約を fact / assumption / unknown と次 task の入力として保存するため |

コード、設定、依存関係、lockfile、DB、生成物は変更していない。

## Findings

| ID | fact / assumption / unknown | 内容 | 根拠 |
|---|---|---|---|
| F-01 | fact | `title` は trim 後 1〜120、`sourceTitle` は空文字を許容し最大 120。`sourceTitle` は現コードでは trim されない。 | `notebook.schema.ts`、MVP 契約 §5.2 |
| F-02 | fact | Cue の `text` は trim 後 1〜120。Cue 配列の件数、Cue `id`、`order` の上限はない（`order` は整数かつ 0 以上のみ）。 | `cue.schema.ts`、`relations.repository.ts`、MVP 契約の Cue 件数制限なし |
| F-03 | fact | ノートの tags は最大 12 件、同一ノート内重複不可。タグ名は trim 後 1〜30 で、現行 regex はひらがな・カタカナ・Han・ASCII 記号を許可する。タグ `color` と入力 `id` に長さ・形式上限はない。 | `tag.schema.ts`、`notebook.schema.ts`、MVP 契約 §5.2 |
| F-04 | fact | `body` と `summary` は `null` を空文字へ変換するだけで、文字数・byte 数の上限がない。`bodyMode=canvas` でも request の `body` は検証され、保存時だけ空文字に置換されるため、巨大な不要 body を parse できる。 | `notebook.schema.ts`、`notebook.command.repository.ts` |
| F-05 | fact | Canvas は schema version 1、page の width / height は整数 320〜4000、elements は最大 1,000、stroke/line/arrow の points 合計は最大 20,000、canonical JSON は UTF-8 で 2 MiB 以下。個々の text、element id、style string、searchText に独立上限はない。 | `canvas-document-types.ts`、`canvas-document-validation.ts`、`canvas-document-size.ts` |
| F-06 | fact | Canvas の 2 MiB 検査は validation / serialization の段階にあり、Notes API は `request.json()` で request 全体を先に parse してから schema validation する。POST/PATCH/review に Content-Length・streaming cap・JSON parse 前の byte 拒否はない。 | `src/app/api/notes/**/route.ts` |
| F-07 | fact | `query` は trim される任意 string だが上限なし。canonical `tags` は repeated value の配列、legacy `tag` は comma split で、value 長・件数・全体 query byte 上限なし。`page` は default 1、整数、1 以上のみで max / safe-integer 境界なし。 | `query.schema.ts`、`src/app/api/notes/route.ts`、`read.query.ts` |
| F-08 | fact | DB query は `PAGE_SIZE=50` で `skip=(page-1)*50`。`GET /api/tags` は全 Tag を名前順に返し、response pagination / result cap がない。 | `read.query.ts`、`read.repository.ts`、`tag.repository.ts`、MVP 契約 §5.3 |
| F-09 | fact | SQLite / PostgreSQL の Notebook body、summary、Canvas document/search、Cue text、Tag name/color は schema 上 `TEXT` で、DB column の size constraint はない。 | `prisma/schema.prisma`、`prisma/schema.postgres.prisma`、migration SQL |
| F-10 | fact | 参照可能な `dev.db` は 2 active notes、全て `bodyMode=canvas`。Canvas 2 行は JSON valid / schema 1、page は 1200〜1920 × 800〜1080、最大 11 elements、最大 `document_json` 6,773 bytes、最大 `search_text` 31 bytes。最大 title 33 chars、sourceTitle 32 chars / 96 UTF-8 bytes、summary 28 chars、Cue 7 chars / 21 bytes、Tag 8 chars / 12 bytes、1 note あたり最大 Cue 1 / Tag 3。 | 読み取り専用 `sqlite3 -readonly dev.db` 集計 |
| F-11 | fact | `prisma/dev.db` は 0 bytes。2026-07-15 backup は notes/cues 0 件で Canvas table がない旧 schema のため、現行 Canvas / legacy Markdown の代表データとは扱えない。 | read-only file stat / sqlite aggregate |
| F-12 | fact | `doc/testing/TEST_SCENARIOS.md` の `NTE020-OVERFLOW-375` は長い Markdown、長い tag、長い error の runtime 投入を未実施と記録している。MVP 契約・README に body/summary/query/request byte 上限は定義されていない。 | テスト観点、MVP 契約、README |
| F-13 | fact | ネットワーク付き `npm audit --json --package-lock-only --ignore-scripts` は `registry.npmjs.org` の `getaddrinfo ENOTFOUND` で exit 1。したがって最新 advisory DB による確定結果は得られていない。 | npm audit 実行結果の要約 |
| F-14 | fact | `npm audit --offline` は local cache の report 上 vulnerabilities 0、prod 334 / dev 603 / optional 138 / peer 1、total 1,005 と返った。ただし online advisory refresh なしのため clean の証明にはしない。`npm ls --depth=0` は local `node_modules` の extraneous `@emnapi/runtime@1.7.1` を報告したが、これは lockfile 内の optional transitive package と一致し、manifest / lockfile の差分ではない。 | offline audit、`npm ls`、package-lock |
| A-01 | assumption | user-facing field の上限は Unicode scalar count、request/query の DoS 境界は UTF-8 byte count として設計するのが、現在の「文字」契約と payload 実サイズの両方に説明しやすい。既存 Zod `.max()` は JS string length のため、単位変更は明記が必要。 | 次 task の設計前提。現行コードに byte helper はない |
| A-02 | assumption | 通常の個人学習ノートには body 512 KiB、summary 128 KiB、query 512 scalar、request 4 MiB は十分な保守候補。これは current `dev.db` の小さい値からの保証ではなく、Canvas 2 MiB と Markdown の余裕を合わせた設計候補。 | Canvas 2 MiB、現行 MVP のローカル個人利用前提 |
| U-01 | unknown | 実際に利用される別 SQLite DB、Postgres target、backup/import source に legacy Markdown body / 大きな Summary / 30 文字超の tag / 12 件超の関連があるかは未確認。現在の `dev.db` 集計だけで既存データ互換性を保証できない。 | 実 target 接続情報なし、参照可能 DB に Markdown 行なし |
| U-02 | unknown | package-lock の各 package に対する最新 online vulnerability / fixed version / exploitability は未確定。オフライン 0 件を更新不要の判断に使わない。 | npm registry への接続失敗 |
| U-03 | unknown | Next.js / hosting / reverse proxy が request body または URL に設定する upstream limit、Content-Length の有無、runtime stream 上限は未確認。route 内 cap と infrastructure cap の小さい方が実効値になる。 | local source の route 以外の実行基盤設定は対象外 |

## Candidate limits and DoS boundaries

### 候補値

数値は「切り捨て」ではなく超過時に field error / 413 相当で拒否する前提。Canvas の canonical JSON 2 MiB を維持し、既存 read は壊さない。

| 候補 | markdown `body` | `summary` | `query` | query tags | `page` max | note JSON request max | 評価 |
|---|---:|---:|---:|---|---:|---:|---|
| Strict | 256 KiB | 64 KiB | 256 scalar / raw query 8 KiB | 12 values、各 tag は既存どおり 1〜30 | 1,000 | 4 MiB | DoS 余地を最小化。ただし長文 Markdown の既存利用を壊しやすい |
| Recommended | 512 KiB | 128 KiB | 512 scalar / raw query 8 KiB | 12 values、各 1〜30、canonical repeated を優先 | 1,000 | 4 MiB | Canvas 2 MiB + outer JSON に余裕があり、通常利用にも十分とする暫定推奨 |
| Compatibility-first | 1 MiB | 256 KiB | 1,024 scalar / raw query 16 KiB | 12 values、各 1〜30 | 10,000 | 6 MiB | 既存長文を救いやすいが parse / DB scan の上限は緩い |

- 4 MiB は Canvas 2 MiB document と request metadata / JSON wrapper の余裕を確保するための候補。3 MiB を下限にする場合は、2 MiB 近傍 Canvas fixture を含む実測が必要。
- Cue 件数は現行 MVP が「制限なし」のため、Recommended では同時に変更しない。DoS をさらに抑える別判断として Strict 200 / Compatibility-first 500 件を候補にできるが、既存 note scan と API 契約更新を先に行う。
- tag `color` は現行無制限。別途、hex 7 文字へ限定するか、許容する色形式を決めた上で 32 bytes 程度へ制限する必要がある。既存 color 値を先に集計する。

### 境界の分類

| 境界 | 効果 | 実装時の注意 |
|---|---|---|
| request body bytes（最優先） | JSON parse 前の CPU / memory amplification を抑える | Content-Length 事前拒否だけでは不十分。header がない / 嘘の request を考慮し、Web stream を上限 byte まで読み、超過時点で中断してから `JSON.parse` する。Note 4 MiB、review 64〜128 KiB を候補にする |
| raw URL / query bytes | 巨大 URL と巨大 `URLSearchParams` の処理、DB `LIKE` / IN 負荷を抑える | `request.url` の UTF-8 byte guard と、decoded field の scalar/byte validation を分ける。raw URL guard は routing / proxy の先にも別上限がある |
| field bytes | Markdown parser、Canvas text、response / DB payload の増幅を抑える | body/summary は byte-based reject。既存値を silently truncate しない。Canvas document 2 MiB と body/summary は別フィールドとして扱う |
| array / term count | Zod traversal、Prisma `createMany`、IN 条件、response list を抑える | note tags は既存 12 を維持。query tags は 12 に揃える候補。Cue count は現行契約を変えるため別判断 |
| page / DB work | 巨大 offset と count/findMany の無駄を抑える | `page.max=1,000` と safe integer を追加候補。`PAGE_SIZE=50` は MVP 契約として維持 |
| `/api/tags` result | tag master 増加による全件 response / client memory を抑える | 単純 cap は候補を隠すため、5,000 件 cap + 明示的な truncation/error か pagination を別設計する。現 MVP の autocomplete 互換性を確認する |

## Dependency update candidates and verification

オンライン audit が失敗したため、具体的な「脆弱 package → fixed version」は今回特定できない。依存更新は行わず、次に online audit が成功した task で advisory の package/version が確定してから対象を選ぶ。

| 連動対象 | lockfile 現在値 | breaking / 影響リスク | 更新前に必要な検証 |
|---|---|---|---|
| `next` + `eslint-config-next` | 16.2.9 | 高。App Router、auth、webpack build、route runtime に影響 | `npm ci`、lint、typecheck、build、API smoke、auth contract、主要 E2E |
| `prisma` + `@prisma/client` + `@prisma/adapter-better-sqlite3` + `@prisma/adapter-pg` | 7.8.0 | 高。生成 client / adapter / migration / SQLite・Postgres 境界を同時に壊し得る | generate、schema/migration validate、SQLite CRUD、Canvas roundtrip、Postgres baseline/import/reconcile の isolated tests |
| `react` + `react-dom` + React types | 19.2.0（types は lockfile 19.2.x） | 中〜高。controlled input、Markdown、Canvas、hydration | lint、typecheck、build、主要 editor/list/detail E2E、console error |
| `playwright` + `@playwright/test` | 1.61.0 | 高。Issue #58 で揃えた version。browser binary / fixture cleanup に影響 | pair を同時更新し、browser install、`npm run test:e2e`、server/DB cleanup、CI sandbox |
| `react-markdown` + `remark-gfm` + `rehype-raw` + `rehype-sanitize` | 9.1.0 / 4.0.1 / 7.0.0 / 6.0.0 | 高。XSS boundary、checkbox、Markdown AST の security-sensitive behavior | dangerous Markdown sanitize、display-only checkbox、body/summary size boundary、build |
| `zod` | 4.4.3 | 中。trim、coerce、error path、Unicode/byte validation に影響 | current schema cases、new boundary cases、API 400/413 mapping、Japanese/multibyte values |
| `better-sqlite3` / `pg` / `fabric` | 12.11.1 / 8.16.3 / 7.4.0 | native / Canvas runtime risk。既存の source-reader fallback、保存形式、pointer lifecycle に影響 | clean `npm ci`、native load、Canvas serialization/validation、runtime Canvas QA |

上表は「更新候補の version」ではなく、advisory が該当した場合の impact grouping である。現在の lockfile を推測で更新しない。

## Verification

| 確認項目 | 結果 | 備考 |
|---|---|---|
| 作業前 `git status --short` | PASS | 既存の modified / untracked files を確認し、戻していない |
| 作業後 `git status --short` | PASS | worktree は dirty のまま保持。作業中に別 task とみられる変更も表示されたが、Worker は対象コードを編集していない |
| contract / route / persistence / Canvas source read | PASS | 対象範囲の上限と parse order を確認 |
| read-only SQLite inventory | PASS | `dev.db` 集計。本文内容やタグ名などの raw value は出力していない |
| `npm audit --json --package-lock-only --ignore-scripts` | BLOCKED | registry DNS `ENOTFOUND`、exit 1。最新 online advisory は未取得 |
| `npm audit --offline --json --package-lock-only --ignore-scripts` | LIMITED PASS | local cache report は vulnerabilities 0。ただし最新状態の証明ではない |
| `npm ls --depth=0` | LIMITED | local node_modules に optional transitive `@emnapi/runtime@1.7.1` が extraneous と表示。依存更新の根拠にはしない |
| code/config/dependency/lockfile/generated artifact diff | PASS | 調査中は変更なし。summary のみ追加 |

## Remaining Unknowns

| ID | 未確認事項 | 次に必要な根拠 |
|---|---|---|
| U-01 | 実利用 DB の body/summary/query/tag/Cue の最大値、legacy Markdown 行、Canvas 2MiB 近傍データ | 対象 DB を read-only で明示し、内容を出さず aggregate size/hash を取得 |
| U-02 | 最新 vulnerability と fixed version | ネットワーク許可環境で同じ package-lock に対して `npm audit --json --package-lock-only` を再実行。結果を advisory / severity / dependency path 単位で要約 |
| U-03 | runtime / proxy の body・URL上限と request stream 可否 | 実行環境の設定確認と、oversize request が JSON parse 前に拒否される integration test |
| U-04 | 既存の 30 文字超 tag / 任意 color / 12 件超 Cue が存在する場合の grandfather 方針 | read-only inventory と発注者判断。保存時 reject、既存 read-only、unchanged PATCH のいずれかを決める |
| U-05 | `/api/tags` 全件 response の許容件数 | 現行 UI の候補表示要件と tag master 件数を確認し、pagination / cap を別 task 化するか判断 |

## Next Read

次の coding task では、まず次の最小ファイルを読む。

- `src/modules/notes/contracts/notebook.schema.ts`
- `src/modules/notes/contracts/cue.schema.ts`
- `src/modules/notes/contracts/tag.schema.ts`
- `src/modules/notes/contracts/query.schema.ts`
- `src/app/api/notes/route.ts`
- `src/app/api/notes/[id]/route.ts`
- `src/app/api/notes/[id]/review/route.ts`
- `src/shared/canvas/canvas-document-types.ts`
- `src/shared/canvas/canvas-document-validation.ts`
- `src/shared/canvas/canvas-document-serialization.ts`
- `src/shared/canvas/canvas-document-size.ts`
- `src/server/notes/infrastructure/read.query.ts`
- `src/server/notes/infrastructure/read.repository.ts`
- `src/server/notes/infrastructure/relations.repository.ts`
- `src/server/notes/infrastructure/canvas.persistence.ts`
- `src/shared/http/api-error.ts`
- `prisma/schema.prisma`、`prisma/schema.postgres.prisma`
- `doc/implementation/MVP_CONTRACT.md` §5〜§6、`doc/testing/TEST_SCENARIOS.md` の `NTE020-OVERFLOW-375` / Canvas persistence 観点
- 互換性テスト追加前に `e2e/mvp-note-flow.spec.js`、`test/postgres/data-migration-contract.test.js`

### Recommended next task boundary

1. 実利用 DB の aggregate inventory と発注者判断を先に行う。
2. Recommended 候補（body 512 KiB、summary 128 KiB、query 512 scalar / raw query 8 KiB、query tags 12、page 1,000、note request 4 MiB）を採用するか決める。
3. shared byte helper と route の streaming cap を追加し、parse 前 oversize、UTF-8 境界、Canvas 2 MiB、通常 payload をテストする。
4. 超過値は切り捨てず拒否し、既存 record の GET と legacy Markdown read を壊さない。full-replacement PATCH が oversized existing value を再送する場合の方針を明示する。
5. 依存更新は online audit の advisory と fixed version が得られた別 task で、連動グループ単位に変更し、lint / typecheck / build / contract / E2E / migration verification を行う。
