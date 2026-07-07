# Architecture Decision Record Draft: Cornell Method Notebook Application Architecture

作成日: 2026-07-05
状態: Draft for user review

## Context

Cornell Method Notebook は、ローカル個人利用を前提に Next.js App Router、React、Prisma、SQLite で実装されている。MVP はノート一覧、ノート作成、詳細閲覧、編集、復習モード、タグ、Markdown preview、バックアップ API/CLI まで動作確認済みである。

一方で、最終仕様と Phase 2 では以下が追加される。

- 自動保存、ドラフト、楽観ロック、409 競合 UI
- Undo 付き soft delete、`SoftDeleteBuffer`
- `NoteCard`、`NoteCueLink`、カード単位 D&D、hidden flag
- `/tasks/review`、`NotebookReviewProgress`、未完タスクバッジ
- PDF export、Playwright による生成
- 将来の Vercel + Supabase/Postgres または別 DB への移行検討

現行 MVP は小さいため動作しているが、現構成のまま Phase 2 を継ぎ足すと、画面、API、DB、validation、DTO、transaction の責務がさらに混在し、変更時の影響範囲を追いにくくなる。

この ADR は、以後の Worker 実装 task が従う全体アーキテクチャ方針を定義する。

## Problem

現行構成の主な構造課題は次の通り。

1. UI Client Component が大きすぎる。
   - `src/app/notes/_components/note-editor.tsx` は 722 行で、フォーム state、初期値変換、DTO 生成、API fetch、エラー表示、タグ入力 UI、Cue 操作、Markdown 入力 UI を同じファイルに持っている。
   - `src/app/notes/_components/notes-list.tsx` は 507 行で、検索フォーム state、query string 生成、tag fetch、notes fetch、ページング、日付 validation、一覧カード表示を同じファイルに持っている。
   - `src/app/notes/_components/note-detail-modes.tsx` は 469 行で、閲覧表示、編集モード切替、復習 state、復習 API、削除 API、表示用 sub component を同じファイルに持っている。
   - このまま自動保存、競合バナー、Undo snackbar、D&D、review task badge を追加すると、UI の局所変更が保存仕様や API payload へ波及しやすい。

2. UI 型と API/validation 型の境界が曖昧である。
   - UI component が `@/lib/validation` の `NotebookInput` や API error 型を直接 import している。
   - MVP では便利だが、Phase 2 で draft payload、card payload、review task payload が増えると、UI 内部 form state と API request DTO の違いが見えにくくなる。

3. Route Handler に処理が集中している。
   - `src/app/api/notes/route.ts` は request parsing、query validation、Prisma where 組み立て、pagination、DTO mapping、tag upsert、transaction、error response を同じファイルに持つ。
   - `src/app/api/notes/[id]/route.ts` も detail mapping、tag upsert、Notebook 更新、Cue 全置換、NotebookTag 全置換、物理削除を同じファイルに持つ。
   - `formatDetail`、date helper、tag helper、`createTagsAndLinks`、`getNotebookDetail` が list/detail route 間で重複している。
   - Draft/Undo/NoteCard/ReviewProgress の transaction policy を route ごとに直書きすると、保存条件や削除条件の不整合が起きやすい。

4. Repository / Service 層がない。
   - `src/lib/prisma.ts` は Prisma singleton のみで、Notebook の query/command 境界がない。
   - DB モデルの変更、soft delete 化、カード分割、Postgres 移行時に、Route Handler と UI を広く修正する必要が出る。

5. Validation と API error factory が一箇所に集まっている。
   - `src/lib/validation.ts` は MVP 規模では妥当だが、note、tag、review task、draft、undo、export、backup が増えると責務が膨らむ。
   - endpoint ごとの schema、DTO 型、共通 error 生成の境界を決めないと、何を変更すべきか判断しにくい。

6. MVP data model と最終仕様 data model の差が大きい。
   - 現行 schema は `Notebook`, `Cue`, `Tag`, `NotebookTag` の 4 model に限定される。
   - 最終仕様では `NotebookDraftState`, `NotebookReviewProgress`, `NoteCard`, `NoteCueLink`, `SoftDeleteBuffer`, `BackupLog` が必要になる。
   - `Notebook.deletedAt` は存在するが、MVP API は物理削除である。Phase 2 で soft delete に変える前に、削除モデルの正式な意味を決める必要がある。

7. ディレクトリ構成が feature 境界を示していない。
   - `src/app/notes/_components` に notes feature の主要 UI が集まっているが、feature 内の `components`, `hooks`, `api client`, `types`, `mappers` の分離がない。
   - `src/lib` 直下に `prisma.ts`, `validation.ts`, `backup/` だけがあり、domain/service/repository の意図が読み取れない。

発注者の指摘である「アーキテクチャの考察、ファイル分割のかけらも感じられず保守性が低い」は、現行コード上では、ファイルサイズだけでなく、責務の混在、依存方向の曖昧さ、Phase 2 変更点の受け皿不足として具体化できる。

## Decision

MVP 完了状態を壊さず、Phase 2 実装前に以下のアーキテクチャ方針を採用する。

1. Next.js App Router は routing / HTTP boundary として使う。
   - `src/app/**/page.tsx` は Server Component として初期表示に必要なデータ取得または Client Component の配置を担う。
   - `src/app/api/**/route.ts` は HTTP request/response の薄い adapter とする。

2. Feature 単位の UI 境界を作る。
   - notes、tags、review-tasks、backup、export を feature として扱う。
   - feature ごとに UI component、hook、client API、DTO mapper を分離する。

3. Server 側は service / repository / mapper を分ける。
   - service は use case と transaction policy を持つ。
   - repository は Prisma query/command を持つ。
   - mapper は Prisma shape と API DTO の変換を持つ。
   - Route Handler は validation 済み DTO を service に渡し、service result を HTTP response に変換する。

4. DTO と schema を Prisma model から独立させる。
   - UI と API は Prisma model を直接前提にしない。
   - API request/response DTO を明示し、Prisma include shape は repository/mapper 内に閉じ込める。

5. 依存方向を一方向に固定する。
   - UI は API client と feature DTO に依存する。
   - API route は schema と service に依存する。
   - service は repository、domain policy、mapper に依存する。
   - repository は Prisma に依存する。
   - repository から UI、Route Handler、React へ依存しない。

## Target Layers

採用する層は次の通り。

| Layer | 主な責務 | 置き場所の目安 |
|---|---|---|
| Route / Page | URL、RSC、Client Component 配置、HTTP method boundary | `src/app/**` |
| Feature UI | 表示部品、フォーム部品、画面固有 interaction | `src/features/<feature>/components/**` |
| UI State Hook | form state、autosave state、mode state、client-side validation 表示 | `src/features/<feature>/hooks/**` |
| API Client | `fetch`、query string 生成、HTTP error decoding | `src/features/<feature>/api/**` または `src/lib/api-client/**` |
| DTO / Schema | API request/response DTO、Zod schema、field error 型 | `src/features/<feature>/schemas/**`, `src/features/<feature>/types/**` |
| Server Service | use case、transaction policy、domain rule orchestration | `src/server/<feature>/*.service.ts` |
| Repository | Prisma query/command、DB include/select、DB 固有条件 | `src/server/<feature>/*.repository.ts` |
| Mapper | Prisma result と API DTO の相互変換 | `src/server/<feature>/*.mapper.ts` |
| Infrastructure | Prisma client、backup provider、filesystem、PDF provider | `src/server/infrastructure/**` or `src/lib/**` |
| Shared UI | feature 非依存の Button/Input/Modal など | `src/components/ui/**` |
| Shared Utilities | 日付、API error helper、共通 validation primitive | `src/lib/**` |

MVP 直後の移行では、過剰な抽象化を避けるため、notes feature から始める。すべてを一度に移す必要はない。

## Directory Policy

Phase 2 以降の推奨ディレクトリは次の通り。

```text
src/
  app/
    notes/
      page.tsx
      new/page.tsx
      [id]/page.tsx
    api/
      notes/route.ts
      notes/[id]/route.ts
      notes/[id]/review/route.ts
      tags/route.ts
      backups/route.ts
  components/
    ui/
      button.tsx
      field-error.tsx
      modal.tsx
      snackbar.tsx
  features/
    notes/
      api/
        notes-client.ts
      components/
        note-editor/
        note-detail/
        notes-list/
        markdown-field.tsx
      hooks/
        use-note-editor.ts
        use-notes-list.ts
        use-autosave.ts
      schemas/
        note.schema.ts
      types/
        note.dto.ts
        note-form.ts
      mappers/
        note-form.mapper.ts
    tags/
      components/
      schemas/
      types/
    review-tasks/
      api/
      components/
      hooks/
      schemas/
      types/
    backup/
      api/
      components/
  server/
    notes/
      notes.service.ts
      notes.repository.ts
      notes.mapper.ts
      notes.errors.ts
    tags/
      tags.service.ts
      tags.repository.ts
    review-tasks/
      review-tasks.service.ts
      review-tasks.repository.ts
    backup/
      backup.service.ts
      local-sqlite-backup-provider.ts
    infrastructure/
      prisma.ts
      pdf-export-provider.ts
  lib/
    api/
      errors.ts
      response.ts
    date/
      date-only.ts
    validation/
      primitives.ts
```

Directory policy:

- `src/app` に大きな business logic を置かない。
- `src/app/api/**/route.ts` に Prisma transaction を直書きしない。移行途中の MVP route は例外として許容するが、新規 Phase 2 route は service を経由する。
- `src/features/**` は client-safe なコードに限定する。Prisma、filesystem、Playwright、server-only dependency を import しない。
- `src/server/**` は server-only な use case と DB 処理を置く。React component を import しない。
- `src/components/ui/**` は domain を知らない汎用 UI に限定する。
- `src/lib/**` は feature 非依存の小さな primitive に限定し、巨大な `validation.ts` のような万能ファイルを増やさない。
- 1 ファイルが 300 行を超えたら分割候補として扱い、500 行を超える新規ファイルは原則作らない。例外は生成物または明確な理由がある場合のみ task summary に記録する。

## Dependency Rule

依存方向は以下を守る。

```text
app/page, app/route
  -> features/* or server/*

features/*
  -> components/ui
  -> lib/api, lib/date, lib/validation primitives
  -> feature DTO/schema

server/*
  -> server/infrastructure
  -> lib/date, lib/api errors
  -> feature DTO/schema
  -> Prisma Client through repository only

server/infrastructure
  -> external libraries, Prisma, filesystem, Playwright
```

禁止する依存:

- `features/**` から `server/**`、`@prisma/client`、`fs`、`child_process`、Playwright を import しない。
- `server/**` から `features/**/components` や React hooks を import しない。
- `app/api/**/route.ts` から Prisma model を直接操作する新規実装を増やさない。
- UI component から Prisma shape を前提にした型を import しない。
- repository から HTTP status、`NextResponse`、browser API を参照しない。

許容する依存:

- `app/api/**/route.ts` から service と schema を import する。
- Client Component から feature API client と DTO 型を import する。
- service から複数 repository を呼び、transaction を管理する。
- mapper から Prisma payload 型を参照する。ただし mapper の外へ Prisma payload 型を export しない。

## DTO / Schema Policy

DTO と schema は以下の方針で扱う。

1. API DTO は明示的に定義する。
   - `NoteListItemDto`
   - `NoteDetailDto`
   - `NoteCreateRequest`
   - `NoteUpdateRequest`
   - `NoteAutosaveRequest`
   - `NoteSaveRequest`
   - `ReviewTaskDto`
   - `ApiErrorDto`

2. Form state と API request DTO を分ける。
   - form state は UI 入力中の空文字、未選択、編集中 ID、dirty flag を持ってよい。
   - request DTO は API が受け取る正規化済みデータのみを持つ。
   - 変換は `features/<feature>/mappers/*` に置く。

3. Zod schema は endpoint / use case 単位で分ける。
   - MVP の `src/lib/validation.ts` は移行元として扱う。
   - Phase 2 では `note.schema.ts`, `review-task.schema.ts`, `tag.schema.ts`, `backup.schema.ts` に分割する。
   - 共通 primitive は `src/lib/validation/primitives.ts` に置く。

4. API error は共通形式を維持する。
   - `{ code, message, errors? }` を継続する。
   - field error の `field` は UI form path と対応させる。
   - server internal detail、filesystem path、stack trace は public response に出さない。

5. Prisma model と DTO を同一視しない。
   - `Date` は API DTO では原則 ISO string または `YYYY-MM-DD` string にする。
   - Prisma の include/select 結果は mapper 内で DTO に変換する。
   - Phase 2 の `NoteCard` / `CueCard` / `NoteCueLink` 追加時は、API DTO を先に固定してから repository を実装する。

## UI State / API Client Policy

UI state と API client は以下の方針で分ける。

1. Page component は orchestration を最小限にする。
   - 初期データ取得、404 判断、Client Component への props 渡しに寄せる。
   - Client Component 内に fetch を直書きする場合は MVP 既存コードの移行中のみ許容する。

2. 画面 state は hook へ分離する。
   - `useNoteEditor`: form state、field update、cue/card/tag 操作、dirty state
   - `useAutosave`: debounce、最短送信間隔、paused state、409/failed state
   - `useNotesList`: filter state、pagination、query validation
   - `useReviewMode`: body visibility、review completion state

3. API call は feature API client に閉じ込める。
   - query string 生成、HTTP method、JSON parse、error decode は component に置かない。
   - component は `saveNote(input)`、`fetchNotes(query)`、`completeReviewTask(id)` のような関数を呼ぶ。

4. UI component は表示責務で分ける。
   - `NoteEditorShell`
   - `NoteBasicInfoFields`
   - `TagInput`
   - `CueCardList`
   - `NoteCardList`
   - `SummaryField`
   - `AutosaveBanner`
   - `ConflictDialog`
   - `UndoSnackbar`

5. 自動保存と手動保存を同じ component に直書きしない。
   - 保存種別は hook/service DTO で区別する。
   - 409 競合時の UI state は `useAutosave` などに閉じ込め、入力 component は編集継続できるようにする。

## Server Service / Repository Policy

Server 側は以下の方針で実装する。

1. Route Handler は薄く保つ。
   - request body/query を schema で parse する。
   - service を呼ぶ。
   - service error を API error response へ変換する。
   - `NextResponse` と HTTP status は route または response helper に閉じ込める。

2. Service は use case を表す。
   - `listNotes`
   - `getNoteDetail`
   - `createNote`
   - `updateNote`
   - `autosaveNoteDraft`
   - `confirmNoteSave`
   - `softDeleteNote`
   - `undoDelete`
   - `listReviewTasks`
   - `completeReviewTask`
   - `exportNotesPdf`

3. Transaction は service が所有する。
   - Notebook + Cue/NoteCard + Tag + DraftState + ReviewProgress の整合性は service の責務にする。
   - repository は transaction client を受け取れる形にする。

4. Repository は Prisma 操作に限定する。
   - where/orderBy/include/select は repository に置く。
   - domain rule、HTTP error、UI field path は repository に置かない。
   - soft delete 対象の絞り込みは repository helper として共通化する。

5. Mapper は DTO 変換に限定する。
   - `Date` 変換、tag sort、card order sort、count 整形を mapper に置く。
   - list/detail/export で同じ DTO 変換を重複させない。

6. Backup / PDF は provider boundary を持つ。
   - `local-sqlite-backup-provider` は SQLite ファイルコピー前提を閉じ込める。
   - Supabase/Postgres 移行時は provider を差し替える。
   - PDF export route に Playwright と notes query を直結させない。service が export data を取得し、provider が PDF を生成する。

## Migration Strategy From Current MVP

MVP を壊さず段階移行する。順序は以下を推奨する。

### Step 1: DTO / mapper を切り出す

- `NoteDetailDto`, `NoteListItemDto`, `NoteInputDto`, `ApiErrorDto` を作る。
- `dateOnlyString`, `dateTimeString`, `formatTags`, `formatDetail`, `formatListItem` を mapper に移す。
- Route Handler の response shape は変えない。

### Step 2: notes repository / service を作る

- `src/server/notes/notes.repository.ts` に Prisma query/command を移す。
- `src/server/notes/notes.service.ts` に create/update/list/detail/delete/review の use case を移す。
- 現行 API の挙動を維持したまま Route Handler を薄くする。
- 検証: `npm run lint`, `npm run build`, API CRUD / validation / backup の既存検証再実行。

### Step 3: UI API client と hooks を分離する

- `NoteEditor` から `toPayload`, fetch, save state を分離する。
- `NotesList` から query string 生成、fetch、filter state を分離する。
- `NoteDetailModes` から review/delete API を分離する。
- UI 表示は変えない。

### Step 4: UI component を分割する

- `NoteEditor` を basic info、tag input、cue list、body field、summary field、actions に分ける。
- `NotesList` を filter panel、tag filter、result list、pagination に分ける。
- `NoteDetailModes` を view、edit wrapper、review mode、delete action に分ける。

### Step 5: Phase 2 DB migration 前に削除・ドラフト・カード設計を確定する

- `deletedAt` の正式意味を決める。
- `NotebookDraftState`、`NoteCard`、`CueCard`、`NoteCueLink`、`SoftDeleteBuffer` の migration を一括設計する。
- MVP の `body` と `Cue` から Phase 2 の card model へどう移行するかを決める。

### Step 6: Phase 2 feature を service 境界へ追加する

- 自動保存/409 は `notes.service.ts` の保存 command として追加する。
- Undo は soft delete service と repository helper として追加する。
- Review task は `review-tasks.service.ts` と repository を作る。
- PDF export は notes service の read model と export provider を使う。

## Consequences

良い影響:

- Worker task が「どの層を変更するか」を判断しやすくなる。
- UI の変更が DB transaction へ直接波及しにくくなる。
- Prisma schema の Phase 2 拡張前に DTO 境界を固定できる。
- 自動保存、Undo、review task、PDF export のような横断機能を route/component 直書きで増やさずに済む。
- 将来 Postgres/Supabase へ移る場合も、repository/provider 境界で影響を局所化しやすい。

悪い影響 / コスト:

- MVP 規模だけを見るとファイル数が増える。
- 小さな修正でも DTO/schema/service/repository の位置を考える必要がある。
- 移行途中は旧構成と新構成が一時的に併存する。
- Worker が境界を守らないと、分割しただけで重複が増える。

採用上の注意:

- いきなり全ファイルを大規模移動しない。
- 既存挙動を変えない「境界抽出 task」と、Phase 2 機能追加 task を混ぜない。
- 各移行 task は `npm run lint`, `npm run build`, 関連 API/UI 手動確認をセットにする。
- 例外的に route/component へ直書きした場合は、task summary に理由と後続整理候補を残す。

## Open Decisions For User

### OD-001: Phase 2 の最初の実装対象

何を決める必要があるか:

Phase 2 の最初に、自動保存、Undo、NoteCard/D&D、Review Task のどれを入れるか。

選択肢:

| 選択肢 | 内容 | 影響 |
|---|---|---|
| A | 自動保存 / draft / 409 から着手 | 保存 service、DTO versioning、UI autosave hook が先に固まる。NoteCard 前提が未確定だと後で draft payload を再調整する可能性がある。 |
| B | NoteCard / NoteCueLink / D&D から着手 | データモデルの大きな変更を先に処理できる。自動保存は card model 前提で作れる。UI 分割と DB migration の負荷が高い。 |
| C | Undo / soft delete から着手 | `deletedAt` と `SoftDeleteBuffer` の意味を先に統一できる。保存/カードより利用体験の変化は小さい。 |
| D | Review Task から着手 | 専用画面と進捗モデルを先に作れる。Notebook 保存 model との結合は比較的弱いが、後で autosave/card と統合確認が必要。 |

Manager 推奨:

B の NoteCard / NoteCueLink / D&D を先に設計・migration し、その後 A の自動保存を入れる。理由は、draft/autosave の payload は最終的なカード構造に依存するため、MVP の単一 `body` 前提で autosave を先に作ると作り直しが発生しやすいからである。

### OD-002: `deletedAt` の扱い

何を決める必要があるか:

現行 `Notebook.deletedAt` を Phase 2 soft delete の正式カラムとして使うか、MVP 互換カラムとして再設計するか。

選択肢:

| 選択肢 | 内容 | 影響 |
|---|---|---|
| A | 現行 `deletedAt` を正式採用 | migration が少ない。Notebook/Cue/NoteCard に同じ考え方を広げやすい。MVP の物理削除 API から挙動変更する task が必要。 |
| B | soft delete 用 metadata を `SoftDeleteBuffer` に寄せ、各 table の `deletedAt` は最小限にする | Undo buffer 中心に考えやすい。実データの除外条件が複雑になる可能性がある。 |
| C | Phase 2 migration で削除関連カラムを再命名/再定義 | 意味は明確になるが、MVP データ migration の負荷が増える。 |

Manager 推奨:

A。各実データ table に `deletedAt` を持たせ、`SoftDeleteBuffer` は Undo 期限と entity type/id を管理する方針にする。AGENTS.md の最終仕様とも整合しやすい。

### OD-003: MVP `body` から Phase 2 `NoteCard` への移行

何を決める必要があるか:

既存 Notebook の `body` を Phase 2 のカード構造へどう変換するか。

選択肢:

| 選択肢 | 内容 | 影響 |
|---|---|---|
| A | 既存 `body` を 1 枚の `NoteCard` に移す | migration が単純。既存ノートの表示が壊れにくい。細かいカード分割はユーザーが後で行う。 |
| B | Markdown 見出しなどで自動分割する | 初期カード化は便利だが、誤分割のリスクがある。ローカル個人データでも復旧 UI が必要になる。 |
| C | `body` を残しつつ新規ノートだけ `NoteCard` にする | migration は楽だが、表示・保存・検索が二系統になり保守性が落ちる。 |

Manager 推奨:

A。既存 `body` を order 0 の `NoteCard` 1 枚に移し、以後は card model に統一する。二系統運用は避ける。

### OD-004: API query name の統一

何を決める必要があるか:

現行 MVP の `GET /api/notes` は `tag=...` を使うが、最終仕様は `tags=tag1,tag2` である。Phase 2 でどちらへ寄せるか。

選択肢:

| 選択肢 | 内容 | 影響 |
|---|---|---|
| A | `tags` に統一し、`tag` は廃止 | 最終仕様に合う。UI/API client の修正が必要。 |
| B | `tag` を維持 | 既存実装への影響は少ないが、仕様とのズレが残る。 |
| C | 一時的に `tag` と `tags` の両方を受ける | 移行が安全。一定期間後に片方を削る判断が必要。 |

Manager 推奨:

C から始め、API client は `tags` を送るように変更する。Route Handler/schema は互換のため一時的に `tag` も受ける。個人アプリなので長期互換は不要だが、移行 task 中の破損を避けられる。

### OD-005: Postgres/Supabase 移行を Phase 2 の現実目標にするか

何を決める必要があるか:

Phase 2 の設計で、ローカル SQLite 固定を優先するか、Vercel + Supabase/Postgres 移行余地を強く確保するか。

選択肢:

| 選択肢 | 内容 | 影響 |
|---|---|---|
| A | 当面 SQLite 固定 | 実装が単純。backup はファイルコピーでよい。将来移行時の修正は大きくなる。 |
| B | Postgres 移行を見据えた repository/provider 境界だけ確保 | MVP/Phase 2 の負荷を抑えつつ移行余地を残せる。DB 固有最適化は避ける必要がある。 |
| C | Phase 2 で実際に Supabase/Postgres へ移行 | 将来運用に近づくが、認証、backup、migration、環境変数、Vercel 保護まで判断が増える。 |

Manager 推奨:

B。今は SQLite ローカルを継続し、repository/provider 境界だけ確保する。実際の Supabase/Postgres 移行は、Phase 2 機能が安定してから別 spike として行う。

### OD-006: UI component library の採用

何を決める必要があるか:

Modal、Snackbar、Tabs、Popover、D&D 周辺の UI primitives を自前 Tailwind で続けるか、Headless/Radix 系を導入するか。

選択肢:

| 選択肢 | 内容 | 影響 |
|---|---|---|
| A | 自前 Tailwind component を継続 | 依存は少ない。accessibility と focus management を自分で実装する必要がある。 |
| B | Radix UI など headless component を部分導入 | Modal/Popover/Tabs の a11y を担保しやすい。依存が増える。 |
| C | 大きな UI component library を採用 | 部品は揃うが、デザイン調整と依存の重さが増える。 |

Manager 推奨:

B。Phase 2 の確認モーダル、競合モーダル、Undo snackbar、tag menu では focus management が必要になる。大きな UI library ではなく、必要な headless primitives を部分導入する。

## Verification

この ADR 作成 task では、コード・設定・依存関係・画像を変更しない。検証は文書作成と対象ファイル確認に限定する。

実行済み:

- `git status --short` before
- `rg --files AGENTS.md doc summary src/app src/lib prisma`
- `sed` による対象設計書、gap inventory、architecture inventory、代表 UI/API/lib/schema の確認
- `wc -l` による代表ファイルのサイズ確認

## Next Read

次回この ADR を起点に実装 task を切る場合は、まず以下を読む。

- `summary/20260705/architecture-decision-record-draft.md`
- `summary/20260705/api-data-lib-architecture-inventory-report.md`
- `doc/technical/MVP_TECHNICAL_DESIGN.md`
- `doc/review/MVP_DETAIL_GAP_INVENTORY.md`
- `src/app/notes/_components/note-editor.tsx`
- `src/app/notes/_components/notes-list.tsx`
- `src/app/notes/_components/note-detail-modes.tsx`
- `src/app/api/notes/route.ts`
- `src/app/api/notes/[id]/route.ts`
- `src/lib/validation.ts`
- `prisma/schema.prisma`
