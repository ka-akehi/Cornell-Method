# Target UI Feature Architecture

作成日: 2026-07-05

## 目的

Cornell Method Notebook の UI / frontend 側を、機能単位・責務単位で保守しやすい構成へ移行するためのターゲット設計を整理する。

この文書は現状追認ではなく、今後 Worker が 1 task ずつ移行できる粒度で UI 側の分割方針を定める。

## 参照

- `doc/technical/MVP_TECHNICAL_DESIGN.md`
- `doc/screens/MVP_SCREEN_DESIGN.md`
- `doc/review/MVP_DETAIL_GAP_INVENTORY.md`
- `summary/20260705/mvp-ui-flow-reverification-report.md`
- `src/app/**/page.tsx`
- `src/app/**/_components/*.tsx`
- `src/app/notes/types.ts`
- `src/app/globals.css`

## 現行 UI ファイル棚卸し

| ファイル | 現在の主責務 | 問題 |
| --- | --- | --- |
| `src/app/page.tsx` | `/notes` への redirect | 問題は小さい。App Router の route entry として維持でよい |
| `src/app/notes/page.tsx` | `NotesList` を描画 | entry としては薄いが、機能実体が route 配下 `_components` に閉じている |
| `src/app/notes/new/page.tsx` | 新規画面見出しと `NoteEditor` 描画 | create 画面固有の composition と form 実体が近すぎる |
| `src/app/notes/[id]/page.tsx` | Server Component で API fetch、404 表示、`NoteDetailModes` へ受け渡し | route entry に API URL 組み立てと fetch が直書き。feature api / server query に分離したい |
| `src/app/backup/page.tsx` | backup UI、fetch、loading/error/success state、表示整形 | backup feature として独立可能。現タスク対象の notes UI とは別 feature 候補 |
| `src/app/notes/_components/notes-list.tsx` | 一覧検索フォーム、タグ取得、ノート取得、URL query 組み立て、ページング、カード表示、日付 validation | 507 行。データ取得、検索 state、表示部品、表示整形が 1 ファイルに集中 |
| `src/app/notes/_components/note-editor.tsx` | create/edit 共通 form、payload 変換、保存 fetch、タグ候補 fetch、Cue 操作、field error 表示、入力部品定義 | 722 行。今後の自動保存、NoteCard、D&D、ショートカットを入れる余地がない |
| `src/app/notes/_components/note-detail-modes.tsx` | 詳細 view/edit/review mode、削除 fetch、復習 fetch、詳細表示部品、日付/タグ表示整形 | 469 行。モード状態・API mutation・閲覧 UI・復習 UI が密結合 |
| `src/app/notes/_components/markdown-field.tsx` | Markdown textarea + preview、sanitize、GFM checkbox 表示専用化、Markdown 表示 styling | 226 行。notes 固有ではなく shared component / markdown lib に寄せられる |
| `src/app/notes/types.ts` | Phase 2 寄りの `Tag`, `CueCard`, `NoteCard` 型 | 現行 MVP 実装の `Notebook`, `Cue` 型と一致しておらず、使われていない可能性が高い。将来型を route 配下へ置いている |
| `src/app/globals.css` | Tailwind import、design token、body baseline | 小さいが、component 側は `stone/amber` 直指定が多く token 利用が一貫していない |

## 現行の主要問題

### 保守性

- 画面単位の巨大 Client Component に、状態管理、fetch、payload 変換、validation 表示、レイアウト、表示整形が混在している。
- 変更箇所の影響範囲をファイル名から推測しにくい。例: タグ候補取得の変更が `NoteEditor` 内部の `TagInput` に埋まっている。
- `src/app/notes/_components` に実体が集まり、App Router の route colocation と feature architecture が混ざっている。

### 責務

- route entry は画面合成と Server Component 境界に絞るべきだが、`notes/[id]/page.tsx` は fetch 実装を直接持っている。
- `NoteEditor` は form state と API mutation の両方を持つため、自動保存や 409 競合を追加するとさらに肥大化する。
- `NoteDetailModes` は mode state と review/delete mutation を持つため、Undo や review task 仕様変更時に詳細表示 UI まで巻き込む。
- `MarkdownField` は shared 可能な UI だが notes route 配下にあり、backup や将来 task 画面から再利用しにくい。

### 変更容易性

- API response / form state / payload の型が component 内に散在し、API 変更時に grep 前提になる。
- fetch が UI component に直書きされているため、エラー形式、cache 方針、認証 header、タイムアウト方針を横断適用しにくい。
- MVP は body 1 つの Markdown だが、将来の NoteCard / D&D へ移る際に `NoteEditor` 全体を書き換える可能性が高い。
- `src/app/notes/types.ts` が現行 MVP と Phase 2 の境界を曖昧にしており、どの型が本番利用中か判断しにくい。

## 採用するターゲット方針

### 採用

| 方針 | 判断 | 理由 |
| --- | --- | --- |
| `src/features/notes/components/*` | 採用 | notes domain の画面部品を route から外し、一覧・編集・詳細・復習で分ける |
| `src/features/notes/hooks/*` | 採用 | form state、list query state、detail mode state、mutation state を UI から分離する |
| `src/features/notes/api/*` | 採用 | fetch、URLSearchParams、error parsing、response 型を集約する。認証追加にも効く |
| `src/features/notes/types/*` | 採用 | API DTO、domain view model、form state、Phase 2 型を分ける |
| `src/features/notes/utils/*` | 採用 | date format、source type label、tag style、payload 変換、field error lookup を集約する |
| `src/shared/components/*` | 採用 | Button/Input/Alert/Section/TagPill/MarkdownField など domain 非依存の UI を置く |
| `src/shared/lib/*` | 採用 | fetch wrapper、date helpers、api error helpers、markdown config などを置く |

### 不採用または保留

| 方針 | 判断 | 理由 |
| --- | --- | --- |
| すべてを `src/components` に集約 | 不採用 | domain component と shared component が混ざり、今回の「機能単位」の目的に合わない |
| route 配下 `_components` 継続 | 不採用 | 小規模 MVP では動くが、Phase 2 の自動保存・D&D・復習タスクで責務肥大が続く |
| Server Actions へ全面移行 | 保留 | MVP 技術設計は Route Handler API。まず api client 化し、その後必要なら比較する |
| 状態管理ライブラリ導入 | 保留 | 現段階では hooks 分割で足りる。自動保存・Undo が複雑化した時点で再評価する |
| feature ごとに barrel export を多用 | 保留 | import は短くなるが依存方向が見えにくくなる。最初は明示 import を推奨 |

## ターゲット directory / file 構成

```text
src/
  app/
    page.tsx
    notes/
      page.tsx
      new/
        page.tsx
      [id]/
        page.tsx
        loading.tsx
        not-found.tsx
    backup/
      page.tsx
    globals.css

  features/
    notes/
      api/
        notes-client.ts
        notes-server.ts
        tags-client.ts
        review-client.ts
        errors.ts
      components/
        list/
          NotesListPage.tsx
          NotesSearchForm.tsx
          NotesTagFilter.tsx
          NotesResultList.tsx
          NoteListCard.tsx
          NotesPagination.tsx
        editor/
          NoteEditor.tsx
          NoteEditorActions.tsx
          NoteBasicFields.tsx
          NoteSourceFields.tsx
          NoteTagInput.tsx
          CueEditorList.tsx
          CueEditorItem.tsx
          NoteBodyField.tsx
          NoteSummaryFields.tsx
        detail/
          NoteDetailShell.tsx
          NoteDetailHeader.tsx
          NoteMetaGrid.tsx
          NoteViewMode.tsx
          NoteReviewMode.tsx
          NoteDetailActions.tsx
          CueList.tsx
        shared/
          NoteTags.tsx
          NoteSection.tsx
      hooks/
        useNotesList.ts
        useNoteEditor.ts
        useNoteTags.ts
        useNoteDetailModes.ts
        useReviewNote.ts
        useDeleteNote.ts
      types/
        api.ts
        domain.ts
        form.ts
        query.ts
        phase2.ts
      utils/
        date.ts
        source-type.ts
        tags.ts
        field-errors.ts
        note-payload.ts
        review-status.ts

    backup/
      api/
        backups-client.ts
      components/
        BackupPageClient.tsx
        BackupHeader.tsx
        BackupList.tsx
      hooks/
        useBackups.ts
      types.ts

  shared/
    components/
      ui/
        Alert.tsx
        Button.tsx
        FieldError.tsx
        FormField.tsx
        Input.tsx
        Select.tsx
        Textarea.tsx
        PageHeader.tsx
        Section.tsx
        TagPill.tsx
      markdown/
        MarkdownField.tsx
        MarkdownPreview.tsx
    lib/
      api/
        fetch-json.ts
        api-error.ts
      date/
        today.ts
        format.ts
      markdown/
        markdown-components.tsx
        sanitize.ts
```

## Client Component / Server Component 境界

### Server Component に残すもの

- `src/app/**/page.tsx` は route entry として維持する。
- `src/app/notes/[id]/page.tsx` は Server Component のまま、初期詳細取得を `features/notes/api/notes-server.ts` に委譲する。
- 404 表示は `not-found.tsx` へ移し、page は `notFound()` を呼ぶ形に寄せる。
- `src/app/notes/page.tsx` と `src/app/notes/new/page.tsx` は Server Component の薄い composition に留める。

### Client Component にするもの

- 検索条件 state、フォーム state、モード切替、保存・削除・復習 mutation を持つ component / hooks。
- `NotesListPage`, `NoteEditor`, `NoteDetailShell`, `NoteReviewMode`, `BackupPageClient`。
- `MarkdownField` は textarea を含むため Client Component。
- `MarkdownPreview` は現行では Client Component に含めてよい。将来 Server Component で Markdown 表示だけ使いたくなったら preview と field を完全分離する。

### 境界ルール

- Server Component は初期データ取得と画面合成だけを行う。
- Client Component は browser interaction と mutation だけを行う。
- Prisma や DB helper は UI feature から直接 import しない。
- API route path と response parsing は `features/*/api` または `shared/lib/api` に閉じ込める。

## API fetch 方針

UI component 直書きはやめ、feature api client へ切り出す。

理由:

- `/api/notes`, `/api/tags`, `/api/notes/:id/review`, `/api/backups` の error parsing が重複している。
- Phase 2 で Basic 認証相当を追加する場合、fetch wrapper に credential / header / 401 handling を集約できる。
- 自動保存や Undo は 409 / 410 など状態別エラー処理が増えるため、component 内 fetch のままだと分岐が散らばる。
- Server Component 用 fetch は `cache: "no-store"` や base URL 解決が必要で、client fetch と分けた方がよい。

推奨構成:

- `shared/lib/api/fetch-json.ts`: JSON parse、non-2xx の `ApiError` 化、共通 options。
- `features/notes/api/notes-client.ts`: `listNotes`, `createNote`, `updateNote`, `deleteNote`。
- `features/notes/api/notes-server.ts`: `getNoteDetailOnServer`。base URL 解決を隠す。
- `features/notes/api/tags-client.ts`: `listTags`。
- `features/notes/api/review-client.ts`: `markNoteReviewed`。

## 主要 component 分割

### `NoteEditor`

現状の `NoteEditor` は、form 初期化、Cue 操作、タグ候補 fetch、保存 fetch、payload 変換、field error 表示、UI 部品定義を全部持っている。

ターゲット:

```text
features/notes/components/editor/
  NoteEditor.tsx              form 全体の composition
  NoteBasicFields.tsx         title / noteDate / overview
  NoteSourceFields.tsx        sourceType / sourceTitle
  NoteTagInput.tsx            selected tags UI。候補取得は hook へ委譲
  CueEditorList.tsx           Cue 配列操作 UI
  CueEditorItem.tsx           Cue 1 件
  NoteBodyField.tsx           Cornell 右欄 body
  NoteSummaryFields.tsx       summary / nextReviewDate
  NoteEditorActions.tsx       cancel / save buttons
hooks/
  useNoteEditor.ts            form state、field errors、save 状態
  useNoteTags.ts              tag candidates、追加/削除、12件制限、重複防止
utils/
  note-payload.ts             FormState -> NotebookInput
  field-errors.ts             fieldError / indexedFieldError
```

移行時の注意:

- まず挙動を変えずに `TextInput`, `TextArea`, `TagInput` を外へ出す。
- 次に `useNoteEditor` へ state と save を移す。
- 自動保存 Phase 2 では `useNoteAutosave` を追加し、`NoteEditor` 本体ではなく hook を差し替える。

### `NoteDetailModes`

現状の `NoteDetailModes` は閲覧、編集、復習、削除、復習済み更新、表示整形をすべて持つ。

ターゲット:

```text
features/notes/components/detail/
  NoteDetailShell.tsx         mode state を持つ親
  NoteDetailHeader.tsx        title / tags / action buttons
  NoteMetaGrid.tsx            noteDate / source / nextReviewDate / reviewedAt
  NoteViewMode.tsx            overview / Cornell view / summary
  NoteReviewMode.tsx          Cue + summary、body hide/show、review form
  NoteDetailActions.tsx       view/edit/review/delete action group
  CueList.tsx                 Cue 表示専用
hooks/
  useNoteDetailModes.ts       view/edit/review と showBody の状態
  useReviewNote.ts            review mutation
  useDeleteNote.ts            delete mutation
```

移行時の注意:

- `NoteDetailShell` は `initialNote` を受け取り、現行と同じ local note state を維持する。
- delete は Phase 2 Undo で大きく変わるため、先に `useDeleteNote` へ隔離する。
- review task 専用画面が追加されても、review mutation は `useReviewNote` を共有できる。

### `NotesList`

現状の `NotesList` は検索 form、タグ取得、一覧取得、日付 validation、ページング、カード表示を持つ。

ターゲット:

```text
features/notes/components/list/
  NotesListPage.tsx           list page composition
  NotesSearchForm.tsx         query/from/to/reviewDue/search/reset
  NotesTagFilter.tsx          tag select / selected chips
  NotesResultList.tsx         loading/error/empty/result switch
  NoteListCard.tsx            1 note 表示
  NotesPagination.tsx         page navigation
hooks/
  useNotesList.ts             query state、loadNotes、date validation
  useNoteTags.ts              tag candidates
utils/
  review-status.ts            復習状態 label/class
  source-type.ts              学習元 label
```

移行時の注意:

- URL query 同期は現状未実装。最初の移行では挙動を変えず local state のままにする。
- Phase 2 で日付 range picker や export が入る場合、`NotesSearchForm` の右側に `NotesExportControls` を追加できる構成にする。

### `MarkdownField`

現状は notes route 配下にあるが、domain 非依存の shared UI として扱う。

ターゲット:

```text
shared/components/markdown/
  MarkdownField.tsx           label + textarea + preview
  MarkdownPreview.tsx         sanitized preview
shared/lib/markdown/
  markdown-components.tsx     react-markdown components
  sanitize.ts                 rehype/remark plugin policy
```

移行時の注意:

- `MarkdownPreview` は閲覧/復習でも使うため、`MarkdownField` から独立 export する。
- checkbox の readOnly / preventDefault は regression しやすいので、移行後に既存 Markdown 検証観点を再実行する。

## 型の分割方針

`src/app/notes/types.ts` は廃止し、以下へ移す。

| 移行先 | 内容 |
| --- | --- |
| `features/notes/types/api.ts` | API request / response DTO。`NotebookInput` と API response の境界 |
| `features/notes/types/domain.ts` | `NoteDetail`, `NotebookListItem`, `Tag` など UI が扱う domain view model |
| `features/notes/types/form.ts` | `NoteEditorFormState`, `NoteEditorInitial`, `NoteEditorSavedNote` |
| `features/notes/types/query.ts` | 一覧検索条件、ページング response |
| `features/notes/types/phase2.ts` | `CueCard`, `NoteCard`, `NoteCueLink` など未実装仕様の型。現行 MVP 型と混ぜない |

判断:

- Phase 2 型を消す必要はないが、現行実装型と同じ場所に置かない。
- `CueCard` / `NoteCard` は現行 MVP の `Cue` / `body` と異なるため、`phase2.ts` または設計 doc に寄せる。

## 将来仕様への耐性評価

| 将来要件 | 評価 | 理由 |
| --- | --- | --- |
| 自動保存 | 耐えやすい | `useNoteEditor` と `notes-client.ts` があれば `useNoteAutosave` を追加し、409 handling を hook に閉じ込められる |
| Undo | 耐えやすい | `useDeleteNote` を差し替え、`useUndoSnackbar` / `undo-client.ts` を追加できる |
| NoteCard / D&D | 耐えやすい | `CueEditorList` と `NoteBodyField` を `CueCardBoard` / `NoteCardBoard` へ段階移行できる |
| 復習タスク画面 | 耐えやすい | `review-client.ts`, `useReviewNote`, `NoteListCard` の一部を再利用できる。専用 feature `features/review-tasks` も選べる |
| 認証追加 | 耐えやすい | `shared/lib/api/fetch-json.ts` と Server Component の fetch helper に 401 / header 方針を集約できる |
| PDF export | 中程度 | 一覧検索条件を `useNotesList` から export controls に渡せる。PDF API と SSR print layout は別 feature が望ましい |
| 高機能 Markdown editor | 中程度 | `MarkdownField` を shared 化しておけば、内部実装を textarea から editor component へ差し替えやすい |

## 移行 task 候補

1. `shared/components/markdown` へ `MarkdownField` / `MarkdownPreview` を移す
   - 目的: notes route 配下から domain 非依存 Markdown UI を分離する。
   - 対象: `markdown-field.tsx`、import 先。
   - 検証: `npm run lint`、Markdown sanitize / checkbox 手動または既存検証観点。

2. notes domain 型を `features/notes/types` に集約する
   - 目的: component 内散在型と `src/app/notes/types.ts` を整理する。
   - 対象: `NoteDetail`, `NotebookListItem`, `Tag`, `NoteEditorFormState` など。
   - 検証: `npm run lint`、`npm run build`。

3. `features/notes/api` と `shared/lib/api/fetch-json.ts` を追加する
   - 目的: UI component 直書き fetch を排除する準備。
   - 対象: notes/tags/review/delete の client、detail server query。
   - 検証: `npm run lint`、`npm run build`。

4. `NotesList` を list components と `useNotesList` に分割する
   - 目的: 検索 state / fetch / 表示を分離する。
   - 対象: `notes-list.tsx`。
   - 検証: `/notes` 初期表示、検索、日付 validation、タグ OR、ページング。

5. `NoteEditor` の小部品を `features/notes/components/editor` へ分割する
   - 目的: 入力部品と form composition を分ける。
   - 対象: `TextInput`, `TextArea`, `TagInput`, Cue UI, summary fields。
   - 検証: 新規作成、既存タグ選択、自由タグ追加、Cue 追加/削除、field error 表示。

6. `useNoteEditor` を追加して form state と save mutation を分離する
   - 目的: 自動保存追加前に保存責務を hook へ閉じる。
   - 対象: `NoteEditor` の state、`toPayload`、`save`。
   - 検証: 新規保存、編集保存、保存失敗 field error。

7. `NoteDetailModes` を shell / view / review / header に分割する
   - 目的: mode 表示を見通しやすくし、復習・削除 mutation を隔離する。
   - 対象: `note-detail-modes.tsx`。
   - 検証: 閲覧、編集へ遷移、復習 mode、本文表示/非表示、閲覧へ戻る。

8. `useReviewNote` と `useDeleteNote` を追加する
   - 目的: mutation と error state を UI から分離する。
   - 対象: review POST、DELETE。
   - 検証: 復習済み更新、削除 cancel/confirm、API error 表示。

9. `src/app/notes/[id]/page.tsx` の fetch を `notes-server.ts` に移す
   - 目的: Server Component の API URL 解決と `cache: no-store` を局所化する。
   - 対象: `getNotebook`。
   - 検証: 詳細表示、存在しない ID の not found 表示。

10. backup UI を `features/backup` へ移す
    - 目的: notes と同じ feature 分割ルールを backup にも適用する。
    - 対象: `src/app/backup/page.tsx`。
    - 検証: backup 一覧、作成、一覧更新、loading/error/empty。

11. shared UI primitive を小さく導入する
    - 目的: Button/Input/Alert/Section の class 重複を減らす。
    - 対象: 既存 component のうち重複が多い箇所から段階適用。
    - 検証: `npm run lint`、主要 UI screenshot 差分確認。

12. Phase 2 型と現行 MVP 型を分離する
    - 目的: `CueCard` / `NoteCard` を現行実装済み型と誤認しないようにする。
    - 対象: `src/app/notes/types.ts` の削除または `features/notes/types/phase2.ts` への移動。
    - 検証: `rg "CueCard|NoteCard|src/app/notes/types"`、`npm run lint`。

## 推奨移行順

1. shared Markdown と notes 型の移動。
2. api client / server query の追加。
3. `NotesList` 分割。
4. `NoteEditor` 分割。
5. `NoteDetailModes` 分割。
6. backup feature 分割。
7. shared UI primitive の整理。

理由:

- 先に型と API 境界を作ると、巨大 component 分割時の判断が安定する。
- `NotesList` は他 component への依存が少なく、最初の feature 分割練習に向く。
- `NoteEditor` と `NoteDetailModes` は保存・編集・復習にまたがるため、前段の api/hook 境界ができてから触る方が安全。

## 検証方針

このタスク自体は設計文書追加のみのため、コード検証コマンドは必須ではない。

実装移行 task では、最低限以下を実行する。

```bash
npm run lint
npm run build
```

挙動を触る task では、対象に応じて以下を確認する。

- `/notes` 初期表示、検索、日付 validation、タグ OR。
- `/notes/new` 作成、タグ候補、Cue、Markdown preview。
- `/notes/[id]` 閲覧、編集保存、復習、削除。
- Markdown sanitize と checkbox readOnly。
- `/backup` 一覧、作成、更新。

## Next Read

- `summary/20260705/target-ui-feature-architecture.md`
- `src/app/notes/_components/notes-list.tsx`
- `src/app/notes/_components/note-editor.tsx`
- `src/app/notes/_components/note-detail-modes.tsx`
- `src/app/notes/_components/markdown-field.tsx`
- `src/app/notes/[id]/page.tsx`
