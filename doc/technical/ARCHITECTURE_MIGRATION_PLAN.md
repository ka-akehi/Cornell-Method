# Architecture Migration Plan

作成日: 2026-07-06

## 目的

`doc/technical/TARGET_ARCHITECTURE.md` を正として、現行 MVP の動作を維持しながらアーキテクチャを段階移行する実行計画を定める。

この移行は Phase 2 機能追加前の土台作りに限る。移行順序、依存関係、タスク粒度、完了条件、検証方針を定めることで、後続の Worker coding task を小さく分けられるようにする。

既存 MVP の UI / API / backup / Markdown の主要フローを維持し、変更理由ごとの責務を追いやすくできたかで移行の成果を判断する。

## 前提となる設計方針

- 主軸は Modular Architecture とする。`notes`, `backup`, `review-tasks`, `export` などの業務機能単位で責務を分ける。
- Clean Architecture、Hexagonal Architecture、Layered Architecture、BFF、Feature-Sliced 的な考え方は補助原則に留める。
- React UI に Clean Architecture を厳密適用しない。UI は component / hook / remote / model を実用上のまとまりで分け、use case 層や presenter 層を機械的に作らない。
- Contract-first は DTO、error response、validation error、date-only / datetime、null の扱いを安定させる範囲に限定する。
- OpenAPI、schema 生成、client 生成は当面導入しない。Rust API 移行や contract drift が現実的なリスクになった時点で再検討する。
- `src/app/**` は routing、page、layout、Route Handler の entry に薄く保つ。
- UI は `modules/<domain>/remote` 経由で HTTP API を呼び、Prisma、filesystem、server-only 実装を知らない。
- server 側は必要に応じて application / infrastructure / presenters に分ける。ただし、小さい endpoint に全層を機械的に作らない。
- Prisma shape と API / UI DTO を同一視しない。

## 移行時にやらないこと

- Phase 2 機能追加とアーキテクチャ移行を同じ task に混ぜない。
- NoteCard、D&D、autosave、Undo、review task、PDF export、Phase 2 DB model 追加をこの移行 task 群へ混ぜない。
- 空ディレクトリや薄い wrapper を先に量産しない。
- UI と server の大規模移動を同時にしない。
- 全 domain を同時に移行しない。まず notes で移行パターンを確定し、その後 backup / review / export に展開する。
- 既存 MVP の API response shape や UI 挙動を、移行のついでに変更しない。
- OpenAPI、生成 client、Rust API、外部 DB 移行を先行導入しない。
- `shared` を catch-all にしない。domain 固有のものは `modules/<domain>` または `server/<domain>` に残す。

## 過剰な抽象化を避ける判断基準

次のいずれかがある場合だけ、新しい層、ファイル、helper、adapter を追加する。

- 複数 endpoint または複数 component で同じ責務が重複している。
- Prisma include shape、HTTP DTO、UI form state が混ざり、変更影響を追いにくくなっている。
- date、null、validation error、HTTP error の扱いが呼び出し元ごとに揺れている。
- Route Handler に transaction、mapping、validation response、business rule が混在している。
- UI component に fetch、payload 変換、複雑な form state、表示 component が集中している。
- 将来差し替えの可能性が高い副作用境界がある。例: Prisma、filesystem backup、PDF provider。

次の場合は移動しない。

- 既存ファイルが十分小さく、次の変更理由がまだ見えていない。
- wrapper が同名関数を呼ぶだけで、責務を隠せていない。
- 抽象化のために import 経路だけが増え、検証可能な安定化がない。

## 推奨移行順序

### 1. `shared/http` と error response の整理

目的: API error response と client-side fetch error handling の最小共通境界を作る。

- 対象は `{ code, message, errors? }` の DTO、Route Handler response helper、remote 側の decode helper に限定する。
- 既存 API の response shape は変えない。
- まず notes API で使える形にし、backup への展開は後続に回す。

### 2. Prisma singleton / server infrastructure 境界整理

目的: Prisma の生成と共有の場所を `server/infrastructure` に寄せ、Route Handler の DB client 配置への依存を減らす。

- 既存 singleton がある場合は、それを移動または re-export する最小変更に留める。
- DB schema や migration は変更しない。

### 3. notes contracts / DTO / schema 整理

目的: notes の list/detail/create/update/tag/review に関する HTTP contract を明示する。

- DTO 型、request schema、query schema、error field 名、date-only の扱いを `modules/notes/contracts` に集める。
- 現行 API と UI の shape を維持する。
- OpenAPI は作らない。

### 4. notes mapper 整理

目的: Prisma record / include shape から API DTO への変換を `server/notes/presenters` に閉じ込める。

- list item、detail、tag、cue order の mapping を対象にする。
- mapping 移動だけを行い、query 条件や保存挙動は変えない。

### 5. notes route handler の薄型化

目的: `app/api/notes/**/route.ts` の責務を request parse、service call、response に絞る。

- list/get/create/update/delete/review のうち、まず read 系から service / repository へ移す。
- 次に command 系を移す。
- 各 task では挙動変更なしを条件にする。

### 6. UI remote 境界導入

目的: UI component 内の `fetch` 直書きを `modules/notes/remote` に移す。

- query string 生成、request DTO、response DTO、HTTP error decode を remote に集める。
- UI は remote 関数を呼ぶだけにする。
- Server Component の初期取得と Client Component の fetch の扱いは task ごとに明示する。

### 7. UI component / hook 分割

目的: NotesList、NoteEditor、NoteDetailModes から UI state と表示 component の責務を分ける。

- まず remote 導入後に、fetch / payload 変換を component から除く。
- 次に form state、tag input、cue editor、markdown field など、既に責務が見えている単位で分ける。
- デザインや機能追加は混ぜない。

### 8. shared markdown / date / UI primitive の整理

目的: domain 非依存の Markdown preview、date-only helper、最小 UI primitive を共有化する。

- 既に複数画面で使われているものだけを対象にする。
- UI 見た目の全面整理は行わない。

### 9. backup / review / export への展開

目的: notes で確定した移行パターンを他 domain に展開する。

- backup は filesystem provider と API / UI を分ける。
- review と export は Phase 2 機能追加前に contract と server 境界だけを設計する。
- 実装は notes の移行パターンが検証済みになってから扱う。

## 後続 Worker task 候補

| task id 案 | queue | kind | 目的 | 対象領域 | 完了条件 | 依存関係 | 検証方法 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `arch-api-shared-http-errors` | `tasks-api` | coding | API error DTO / response helper / fetch error decode の最小境界を作る | `src/shared/http`, notes Route Handler の error response 周辺 | 既存 error shape `{ code, message, errors? }` が維持され、notes API の代表 validation / not_found が同じ shape を返す | なし | `npm run lint`, `npm run build`, 可能なら代表 API 手動確認 |
| `arch-server-prisma-infrastructure` | `tasks-api` | coding | Prisma singleton を server infrastructure 境界へ寄せる | `src/server/infrastructure/prisma.ts`, 既存 Prisma import | Prisma import 先が整理され、DB schema / migration / API 挙動が変わらない | `arch-api-shared-http-errors` は必須ではない | `npm run lint`, `npm run build`, `npx prisma validate` |
| `arch-notes-contracts-dto-schema` | `tasks-api` | coding | notes の request / response DTO と schema を contract として集約する | `src/modules/notes/contracts`, notes query/input schema | 現行 API shape を変えず、notes DTO / schema の正本が明示される | `arch-api-shared-http-errors` 推奨 | `npm run lint`, `npm run build`, 代表 API validation 確認 |
| `arch-notes-presenters-mappers` | `tasks-api` | coding | Prisma shape から notes DTO への mapper を分離する | `src/server/notes/presenters`, notes list/detail mapping | list/detail response が移行前と同等で、Prisma include shape が Route Handler から漏れにくくなる | `arch-notes-contracts-dto-schema`, `arch-server-prisma-infrastructure` 推奨 | `npm run lint`, `npm run build`, `GET /api/notes`, `GET /api/notes/:id` 手動確認 |
| `arch-notes-read-service-repository` | `tasks-api` | coding | notes read 系 Route Handler を薄くする | `src/server/notes/application`, `src/server/notes/infrastructure`, `app/api/notes` GET 系 | list/detail の query と response が維持され、Route Handler が request parse / service call / response に寄る | `arch-notes-presenters-mappers` | `npm run lint`, `npm run build`, notes list/detail API 手動確認 |
| `arch-notes-command-service-repository` | `tasks-api` | coding | notes create/update/delete/review の transaction と DB 操作を server 層へ移す | notes POST/PATCH/DELETE/review route, server notes application/infrastructure | CRUD / review の既存挙動が維持され、Route Handler に Prisma transaction が残らない | `arch-notes-read-service-repository` | `npm run lint`, `npm run build`, 可能なら API CRUD 手動確認 |
| `arch-notes-ui-remote` | `tasks-ui` | coding | Notes UI の fetch 直書きを remote 境界へ移す | `src/modules/notes/remote`, NotesList, NoteEditor, NoteDetailModes | notes UI が remote 関数経由で API を呼び、主要作成/編集/削除/復習フローが維持される | `arch-notes-contracts-dto-schema`, `arch-notes-command-service-repository` 推奨 | `npm run lint`, `npm run build`, 可能なら主要 UI フロー手動確認 |
| `arch-notes-ui-editor-split` | `tasks-ui` | coding | NoteEditor の form state / tag input / cue editor / payload 変換を段階分割する | `src/modules/notes/ui`, 既存 notes components | 保存挙動と validation 表示を変えず、責務単位で component / hook が分かれる | `arch-notes-ui-remote` | `npm run lint`, `npm run build`, 新規作成・編集保存 UI 確認 |
| `arch-notes-ui-list-detail-split` | `tasks-ui` | coding | NotesList / NoteDetailModes を表示 component と状態管理に分ける | `src/modules/notes/ui`, list/detail components | 一覧 filter / paging / detail view-edit-review が維持される | `arch-notes-ui-remote` | `npm run lint`, `npm run build`, 一覧検索・詳細編集・復習確認 |
| `arch-shared-markdown-date` | `tasks-ui` | coding | Markdown preview と date-only helper の shared 化を行う | `src/shared/markdown`, `src/shared/date`, 既存 Markdown/date 利用箇所 | Markdown sanitize / checkbox 表示専用、date validation の既存挙動が維持される | notes UI split の前後どちらでも可。ただし対象を小さくする | `npm run lint`, `npm run build`, Markdown sanitize / checkbox 手動確認 |
| `arch-backup-pattern-review` | `tasks` | docs/review | notes 移行後の pattern を backup に適用する範囲を棚卸しする | backup API/UI/lib, notes 移行後の構成 | backup の移行 task 候補が queue / 完了条件 / 検証方法付きで整理される | notes 移行 pattern 確定後 | 内容レビュー、必要に応じて `sed -n` 確認 |
| `arch-review-export-prephase2-review` | `tasks` | docs/review | review-tasks / export の Phase 2 前 contract 境界を整理する | review/export 設計、TARGET_ARCHITECTURE, gap inventory | Phase 2 機能追加と移行の境界が明確になり、DB 追加前の判断点が整理される | notes 移行 pattern 確定後 | 内容レビュー、必要に応じて `sed -n` 確認 |

## 最初に着手すべき coding task

最初の task は `arch-api-shared-http-errors` とする。

理由:

- 変更範囲が比較的小さい。
- DTO / mapper / service 分離の前提になる error response の形を固定できる。
- UI remote 導入時にも HTTP error decode を再利用できる。
- DB schema や UI layout に触れず、既存 MVP の動作リスクが低い。

この task では `shared/http` に必要最小限の helper を作るに留め、すべての Route Handler を一括移行しない。notes API の代表箇所で導入して、既存 shape が維持されることを確認する。

## 移行中の受け入れ条件

各 coding task は、対象領域に応じて次を満たす。

- `npm run lint` が成功する。
- `npm run build` が成功する。
- Prisma schema や Prisma client import 境界に触れた場合は `npx prisma validate` を実行する。
- Prisma client 生成に影響する変更をした場合のみ `npm run prisma:generate` または既存 package script に従う。
- notes API に触れた場合は、代表的な list/detail/create/update/delete/review または task 対象 endpoint の手動確認を行う。
- notes UI に触れた場合は、一覧検索、新規作成、詳細編集保存、復習、削除のうち対象変更に関係する主要フローを確認する。
- Markdown に触れた場合は sanitize と GFM checkbox 表示専用の挙動を確認する。
- backup に触れた場合は `/backup` 表示、`POST /api/backups`、必要なら `npm run backup:copy` を確認する。
- 検証できない場合は、実行したコマンド、失敗理由、未確認リスクを task summary に残す。

docs/review task では、対象ファイルの作成または更新後に `git diff -- <file>` で内容を確認する。未追跡ファイルは `sed -n` などで確認する。

## 判断保留事項

| 保留事項 | 現時点の扱い | 再判断タイミング |
| --- | --- | --- |
| OpenAPI 導入タイミング | 当面導入しない。TypeScript DTO / schema / error response の安定化を優先する | Rust API 移行が具体化した時、複数 backend 実装を並行運用する時、または手書き DTO drift が問題になった時 |
| Rust API 移行タイミング | 今回の移行では実装しない。UI が remote / contract のみを知る形へ寄せる | Phase 2 の主要 data model が固まり、Next.js Route Handler の限界や外部 API 化の必要が明確になった時 |
| Phase 2 DB model 追加タイミング | architecture migration とは混ぜない。NoteCard / NoteCueLink / draft / soft delete / review progress は別 task 群で扱う | notes DTO / mapper / service / remote の移行 pattern が確認できた後 |
| backup / review / export の移行開始 | notes の移行 pattern 確定後に扱う | notes read/command service と UI remote 導入が完了し、検証が通った後 |
| Server Actions 採用 | 主 contract にはしない。使う場合も薄い adapter に限定する | form submit の局所最適として必要になった時 |

## 参考資料

- `doc/technical/TARGET_ARCHITECTURE.md`
- `HANDOFF_2026-07-06.md`
- `doc/review/MVP_DETAIL_GAP_INVENTORY.md`
- `summary/20260706/2315-arch-doc-lightweight-target-architecture-e7271516-summary.md`
- `summary/20260705/target-ui-feature-architecture.md`
- `summary/20260705/target-api-data-architecture.md`
- `summary/20260705/architecture-decision-record-draft.md`
