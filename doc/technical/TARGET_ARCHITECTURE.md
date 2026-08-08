# Target Architecture

作成日: 2026-07-06

## 位置づけ

Cornell Method Notebook の保守と拡張に向けたターゲットアーキテクチャを定義する。

現行 MVP は Next.js App Router、React、Prisma、SQLite で動作している。現状は巨大な Client Component と Route Handler への処理の直書きに寄っているため、UI、backend、DB、HTTP contract の変更が互いに波及しやすい。Phase 2 以降の自動保存、Undo、本文モデル判断後に採用する場合の NoteCard / D&D、復習タスク、SQLite からの PDF export、将来の Rust API 導入に備えて、責務境界を整える必要がある。

ターゲット構成では変更理由ごとに責務を分け、UI、backend 実装、DB 実装、HTTP contract の変更が別領域へ波及しにくい状態を作る。層や抽象を増やすこと自体は目的にしない。機能追加によって変更理由が分かれた境界から、小さく移行する。

将来の製品主経路は Mac のデスクトップアプリ配布とする。ただし、開発と検証に使う Next.js Web 起動形態は残す。

デスクトップ版でも現行 MVP の local-first 方針を維持し、ノートデータの唯一の正本を各ユーザーの Mac 内 SQLite とする。クラウド DB、クラウド同期、オンラインサービスは製品スコープ外であり、アーキテクチャの将来移行先として扱わない。

Electron を最短経路候補、Tauri + Node.js sidecar を代替候補として比較する。両候補とも、実装着手済みまたは採用確定とは扱わない。

## 採用する考え方

このプロジェクトの主アーキテクチャは **Modular Architecture** とする。`notes`, `backup`, `review-tasks`, `export` などの業務機能単位で責務を分け、各 module の中で UI、HTTP 境界、contract、server use case を必要な範囲だけ整理する。

Clean Architecture、Hexagonal Architecture、Layered Architecture、BFF as Adapter、Feature-Sliced 的な考え方は、Modular Architecture を保守しやすくするための補助原則として扱う。React UI は component / hook / remote / model を実用上のまとまりで分け、Clean Architecture の use case 層や presenter 層を機械的に増やさない。

| 考え方 | このプロジェクトでの意味 |
| --- | --- |
| Modular Architecture | 主軸。業務機能単位で module を分け、変更理由を module 内に閉じ込める |
| Layered Architecture | 補助原則。server 側で HTTP、use case、DB access、DTO mapping が混ざる場合だけ軽量に分ける |
| Ports and Adapters / Hexagonal Architecture | 補助原則。Prisma、filesystem、PDF 生成、将来 Rust API など外部境界を明示したい箇所だけ adapter として扱う |
| Clean Architecture | 参考。server 側の責務分離の語彙として使うが、React UI や小さい module に厳密適用しない |
| Contract-First / API-First Design | DTO、error response、date format など HTTP API contract を安定させるために使う。OpenAPI や生成コードは必要になるまで導入しない |
| Backend for Frontend as Adapter | 補助原則。Next.js `app/api/**` を HTTP adapter として薄く保つ考え方に留める |

この構成を **Modular Architecture for Next.js with lightweight server boundaries** と呼ぶ。

## 基本方針

- `src/app/**` は routing、page、layout、HTTP boundary に薄く保つ。
- UI は DB、Prisma、filesystem、Next.js Route Handler の内部実装を知らない。
- UI は domain ごとの remote module 経由で HTTP API を呼ぶ。
- React UI 側には Clean Architecture を厳密適用しない。component、hook、remote、model は、component の巨大化、複数箇所での再利用、単独テストが必要になった場合に分ける。
- HTTP request / response の形は contract として明示し、Next.js API でも将来 Rust API でも同じ contract を守る。
- Contract-first の範囲は、当面 DTO、error response、validation error、date-only / datetime format、null の扱いを安定させることに絞る。
- OpenAPI、schema 生成、client 生成は、Rust API 移行や contract drift が現実的なリスクになった時点で導入を検討する。
- server 側は service / repository / mapper に分ける。ただし小さい endpoint では無理に全層を作らず、責務が混ざり始めた時点で分割する。
- Prisma shape と API/UI DTO を同一視しない。
- 現行の新規本文は `bodyMode=canvas` とし、`NotebookCanvas.documentJson` の `CanvasDocumentV1` を正本にする。`Notebook.body` は空文字で保存する。
- `bodyMode=markdown` と `Notebook.body` は既存ノートの互換モードとして保持し、新規ノートの標準本文や自動移行対象にしない。
- Cue と Summary は Markdown のまま扱い、Canvas 本文は Canvas editor / viewer で扱う。Canvas 本文を Markdown textarea / preview の対象にしない。
- 現行 Prisma model は `Notebook`、`NotebookCanvas`、`Cue`、`Tag`、`NotebookTag` の 5 model とする。`NoteCard`、`CueCard`、`NoteCueLink` は現行 MVP に存在しない。
- 一覧のフリーワード検索は title、Summary、Cue、legacy `Notebook.body`、Canvas text 要素から生成した `NotebookCanvas.searchText` を対象にする。Canvas の用紙寸法だけを変更した場合は `searchText` を変えない。
- 配布物とユーザーデータの保存境界を明示する。`app bundle` は実行コード、Next.js 資産、Prisma Client / migration、必要な runtime / driver を含む読み取り専用の配布物とし、`user data directory` は SQLite の live DB（唯一の正本）、DB backup、設定、ログを持つ書き込み可能領域とする。
- PDF output は SQLite から一方向に生成する派生出力であり、編集用データ形式、復元用正本、SQLite との双方向同期対象にはしない。PDF の具体的な出力先は未決定であり、`user data directory`、`app bundle`、`Downloads` のいずれかに固定しない。
- SQLite の live file を iCloud / Dropbox などの同期フォルダへ置く設計は採用しない。クラウド同期やオンラインサービスの provider 境界も設けない。
- directory や層は、変更範囲を狭め、仕様変更時の影響を追いやすくする場合にだけ増やす。
- Phase 2 機能追加とアーキテクチャ移行を同じ task に混ぜない。

## ターゲット構成

次の配置をターゲットの目安とする。全ディレクトリを先に作らず、module が小さい間はファイル数を抑え、Phase 2 の実装で責務が増えた領域から段階的に移す。

```text
src/
  app/
    notes/
      page.tsx
      new/
        page.tsx
      [id]/
        page.tsx
    backup/
      page.tsx
    api/
      notes/
        route.ts
        [id]/
          route.ts
          review/
            route.ts
      tags/
        route.ts
      backups/
        route.ts

  modules/
    notes/
      ui/
        components/
        hooks/
      remote/
        notes.remote.ts
        tags.remote.ts
        review.remote.ts
      contracts/
        note.dto.ts
        note.schema.ts
        note.errors.ts
      model/
        note-form.ts
        note-view.ts
      lib/
        date.ts
        field-errors.ts
        note-payload.ts
    backup/
      ui/
        components/
        hooks/
      remote/
        backups.remote.ts
      contracts/
        backup.dto.ts
      model/
      lib/
    review-tasks/
      ui/
      remote/
      contracts/
      model/

  server/
    notes/
      application/
        notes.service.ts
      infrastructure/
        notes.repository.ts
      presenters/
        notes.mapper.ts
    backup/
      application/
        backup.service.ts
      infrastructure/
        local-sqlite-backup-provider.ts
      presenters/
        backup.mapper.ts
    infrastructure/
      prisma.ts
      local-sqlite-path.ts
      pdf-output.ts

  desktop/                 # target / PoC boundary; not implemented yet
    shell/
      electron-main/       # shortest-path candidate
      tauri/                # alternative candidate
    local-runtime/
      next-server.ts        # local Next.js runtime lifecycle
    storage/
      user-data-path.ts     # OS user data directory resolution
      pdf-output-destination.ts # destination policy remains undecided

  shared/
    ui/
      Button.tsx
      FieldError.tsx
      FormField.tsx
      Modal.tsx
      Snackbar.tsx
    http/
      fetch-json.ts
      http-error.ts
      route-response.ts
    validation/
      zod.ts
    date/
      date-only.ts
    canvas/
      index.ts             # CanvasDocumentV1 contract / searchText
    markdown/
      MarkdownField.tsx    # Cue / Summary / legacy body only
      MarkdownPreview.tsx  # Cue / Summary / legacy body only
      markdown-components.tsx

contracts/
  openapi.yaml  # 将来必要になった場合のみ
```

## Desktop shell / local runtime / storage boundary

Desktop 配布時は、shell、ローカル Web runtime、永続化 adapter を次の責務に分ける。これは target architecture と Desktop PoC の境界であり、現在の Next.js / Prisma 実装へ直ちにディレクトリを追加する指示ではない。

| 境界 | 責務 | 保持してはいけない責務 |
| --- | --- | --- |
| Desktop shell | `.app` の lifecycle、ウィンドウ、単一インスタンス、OS の file open / export dialog、user data path の決定、local runtime の起動・終了 | Notebook の business rule、Prisma query、Canvas の保存形式 |
| local Next.js runtime | self-hosted の Node.js 上で App Router、Route Handler、既存 API contract を提供する。開発時は `next dev`、配布時は bundle された runtime と `next start` 相当の起動を比較する | `.app` 内へ live DB を書くこと、shell 固有 API を UI / domain に漏らすこと |
| SQLite / filesystem adapter | `DATABASE_URL` の絶対 path 解決、user data directory の初期化、SQLite / Prisma migration、SQLite DB backup | UI の状態、HTTP status、shell の window 制御、PDF の編集データ化 |
| PDF output adapter | SQLite から読み出したノートを PDF へ変換し、外部出力境界へ渡す。生成物は派生出力として扱う | SQLite の正本を書き換えること、PDF からの import、双方向同期 |

`app bundle` には実行コード、Web 資産、Prisma Client / migration、必要な runtime / native driver を含める。macOS が管理する `user data directory` には SQLite live DB、DB backup、設定、ログを置く。初回起動時に領域を作成して migration を適用し、アプリ更新では bundle とデータ migration を分離する。アンインストールとデータ削除は別操作とし、更新で user data を消さない。

SQLite の live DB はデスクトップ版でもノートデータの唯一の正本である。DB backup は SQLite ファイルのコピーとして保全し、PDF output は SQLite の内容から生成する一方向の派生出力とする。PDF を編集用データや復元用正本として扱わず、PDF から SQLite へ戻す import や双方向同期は設計しない。PDF の出力先と UI の詳細は未決定で、別の PDF export 設計で定義する。

## 各領域の責務

### `src/app/**`

Next.js の route entry と HTTP adapter を置く。

- `page.tsx` は Server Component を基本にし、初期データ取得、404 判断、Client Component 配置に留める。
- `route.ts` は HTTP request / response の adapter に留める。
- business logic、Prisma transaction、DTO mapping、UI state は置かない。

### `src/modules/<domain>/ui/**`

domain ごとの UI component と hook を置く。

例:

- `modules/notes/ui/components/NoteEditor`
- `modules/notes/ui/components/NotesList`
- `modules/notes/ui/hooks/useNoteEditor`
- `modules/notes/ui/hooks/useNotesList`

UI state、form state、表示 component、browser interaction はここに置く。

React UI では Clean Architecture の層を厳密に作らない。画面が小さいうちは component と hook に留め、remote 呼び出し、payload 変換、複雑な状態管理が肥大化したときだけ `model` や `lib` へ分ける。

### `src/modules/<domain>/remote/**`

UI から HTTP API contract を呼び出す境界を置く。

`api` という名前は backend API 実装場所と誤解されやすく、`client` は frontend 全般に見えるため、HTTP 境界の意味を明示するために `remote` を使う。

ここに置くもの:

- `fetch`
- query string 生成
- request DTO / response DTO の受け渡し
- HTTP error decode

ここに置かないもの:

- Prisma
- DB access
- server-only logic
- React component
- business transaction

### `src/modules/<domain>/contracts/**`

HTTP API contract を置く。

例:

- `NoteListItemDto`
- `NoteDetailDto`
- `NoteCreateRequest`
- `NoteUpdateRequest`
- `ApiErrorDto`
- Zod schema

Rust API 導入時もこの contract を守れば、UI の変更を抑えられる。当面は TypeScript の DTO 型、Zod schema、error response、date format の合意を正とし、OpenAPI は contract drift を検知する必要が出た段階で追加する。

### `src/modules/<domain>/model/**`

UI 内部や domain view model を置く。

API DTO と UI form state は分ける。

例:

- `NoteEditorFormState`
- `NoteViewModel`
- `TagTokenState`

入力途中の空文字、dirty flag、modal state、preview state などは API DTO に混ぜない。

### `src/server/<domain>/application/**`

use case と transaction policy を置く。

例:

- `listNotes`
- `getNoteDetail`
- `createNote`
- `updateNote`
- `deleteNote`
- `markNoteReviewed`
- 将来: `autosaveNoteDraft`, `softDeleteNote`, `undoDelete`

Service は HTTP status や `NextResponse` を知らない。DTO または domain result を返す。

application / infrastructure / presenters は、複数 endpoint で共有される rule、transaction、DB query、DTO mapping が出てきた箇所から分ける。

### `src/server/<domain>/infrastructure/**`

DB や filesystem など外部実装に依存する処理を置く。

例:

- Prisma repository
- SQLite backup provider
- PDF output provider
- SQLite live file の path resolver と migration runner
- PDF output destination resolver（具体的な保存先は未決定）

Repository は Prisma query / command に限定し、HTTP や React に依存しない。

外部境界の明示は軽量に行う。SQLite backup provider、Prisma repository、PDF provider のように差し替え可能性や副作用が大きいものを優先し、小さい helper まで adapter 化しない。

### `src/server/<domain>/presenters/**`

DB record や persistence shape を API DTO に変換する mapper を置く。

例:

- Prisma `DateTime` -> `YYYY-MM-DD`
- `Notebook + canvas + cues + tags` -> `NoteDetailDto`
- list item DTO
- tag sort / cue order sort

Prisma include shape を mapper の外へ漏らさない。

### `src/shared/**`

domain 非依存の共通部品を置く。

例:

- UI primitive
- HTTP fetch helper
- API error helper
- date helper
- Canvas document の共通 contract / validation
- Cue / Summary / legacy Markdown 本文の preview / sanitize config
- validation primitive

`shared` を巨大な catch-all にしない。domain 固有のものは `modules/<domain>` または `server/<domain>` に置く。

## 依存方向

```text
app/page.tsx
  -> modules/<domain>/ui
  -> server/<domain>/application  (Server Component 初期取得のみ)

modules/<domain>/ui
  -> modules/<domain>/remote
  -> modules/<domain>/contracts
  -> modules/<domain>/model
  -> shared/ui

modules/<domain>/remote
  -> modules/<domain>/contracts
  -> shared/http

app/api/**/route.ts
  -> modules/<domain>/contracts
  -> server/<domain>/application
  -> shared/http

server/<domain>/application
  -> server/<domain>/infrastructure
  -> server/<domain>/presenters
  -> modules/<domain>/contracts

server/<domain>/infrastructure
  -> server/infrastructure
  -> Prisma / filesystem / external libraries
```

禁止する依存:

- `modules/**/ui` から `server/**` を import しない。
- `modules/**/remote` から Prisma、filesystem、Route Handler 実装を import しない。
- `server/**` から React component / hook を import しない。
- repository から HTTP status、`NextResponse`、browser API を参照しない。
- UI component から Prisma payload 型を import しない。

## Next.js での扱い

Next.js App Router では `page.tsx` / `layout.tsx` は Server Component が標準である。これを活かし、初期表示に必要なデータ取得は Server Component で行ってよい。ただし、DB access や use case を page に直書きせず、server application service へ委譲する。

Route Handler は HTTP endpoint であり、Next.js 側の BFF / adapter として使う。将来 Rust API を導入する場合、Route Handler は次のいずれかになる。

- 廃止
- Rust API への proxy
- ローカル版だけの BFF
- 段階移行中の互換 adapter

Server Actions を主 API contract にすると UI と保存処理が Next.js 固有の境界へ依存するため、今回の主 contract にはしない。使う場合も form submit の薄い adapter に限定し、正本は HTTP contract に寄せる。

ここでいう BFF / adapter は、Next.js API 層の責務を限定するための補助原則である。Route Handler は request / response 変換と service 呼び出しに留める。

### Desktop 配布時の Next.js runtime

Next.js は self-hosted Node.js server として動かせるため、Desktop PoC では shell がローカル runtime を起動し、既存の App Router / Route Handler をローカル HTTP 境界として再利用する案を第一に比較する。開発用の `next dev` / local Web 起動は残し、配布版だけが `.app` 内の資産と user data directory の path を受け取る。

- runtime が受け取る `DATABASE_URL` は user data directory 内の SQLite absolute path とする。
- 初回起動時は user data directory の作成、DB 初期化、bundled migration の適用を行ってから画面を利用可能にする案を PoC で検証する。
- app bundle 内の DB を更新する、またはアプリ更新時に user data を再生成する設計は採用しない。
- `Downloads` を DB / backup の保存先として固定しない。PDF の具体的な出力先も既存仕様で未確定のため、shell や UI の保存先をこの文書で決めない。
- Electron は Node.js、Next.js、Prisma、Playwright と同一の runtime / process model を保ちやすい最短経路候補である。ただし、Electron の採用は未確定であり、サイズ、署名、更新、security boundary を PoC で確認する。
- Tauri は軽量 shell の代替候補だが、現行 Node.js / Prisma / Playwright をそのまま同梱できるとは仮定しない。Node.js runtime を sidecar / bundled resource として扱う構成、IPC、権限、配布 target を PoC で検証する。

## Rust API 移行への適合性

Rust API 移行時に保つ依存方向は次の通り。

```text
modules/notes/ui
  -> modules/notes/remote
  -> HTTP API contract
  -> Next.js Route Handler or Rust API
  -> service
  -> repository
  -> DB
```

UI は `createNote`, `updateNote`, `listNotes` などの remote 関数を呼ぶだけにする。API の実体が Next.js Route Handler から Rust API に変わっても、HTTP contract が維持されていれば UI 側の変更は remote の接続先や fetch helper に閉じ込められる。

Rust API 移行時の UI 変更を remote の接続先と fetch helper に閉じ込めるため、当面は次を安定させる。

- DTO の JSON shape を固定する。
- date、null、error response、validation error の形式を厳密に決める。
- UI は `modules/*/remote` 以外から HTTP API を呼ばない。

OpenAPI など機械的に検証できる contract や生成 client は、Rust API 移行の具体化、複数実装の並行運用、または手書き DTO の drift が問題になった段階で導入する。最初から導入して設計作業を重くしない。

## Phase 2 拡張への適合性

Phase 2 の主な機能は、次のように配置する。

| 機能 | 主な配置 |
| --- | --- |
| 自動保存 / draft / 409 | `modules/notes/ui/hooks/useAutosave`, `modules/notes/remote`, `server/notes/application` |
| Undo / soft delete | `modules/notes/ui`, `server/notes/application`, `server/notes/infrastructure`, `modules/notes/contracts` |
| NoteCard / D&D（本文モデル判断後に採用する場合） | `modules/notes/ui/components`, `modules/notes/model`, `server/notes/infrastructure`, `server/notes/presenters` |
| 復習タスク | `modules/review-tasks`, `server/review-tasks` |
| PDF export | `modules/export` または `server/export`, provider boundary |
| backup provider 差し替え | `server/backup/infrastructure` |

Phase 2 の実装順序は Gate 0 通過後に確定する。本文モデルは、現行 Canvas の維持、Canvas とカードの併用、カード不採用を比較してから決める。NoteCard を採用する場合に限り NoteCard / NoteCueLink の DTO、DB model、migration、D&D 境界を定義する。

自動保存の payload は採用した本文モデルに依存するため、本文モデル判断より先に固定しない。legacy `Notebook.body` を order 0 の NoteCard へ移すことも、`CanvasDocumentV1` をカードへ自動変換することも前提にしない。

## 移行方針

挙動を変えない task と機能追加 task を分け、次の順に小さく移行する。

1. `shared/http` と API error DTO を作る。
2. `server/infrastructure/prisma.ts` へ Prisma singleton を移す。
3. `modules/notes/contracts` と mapper を作る。
4. notes read service / repository を作る。
5. notes command service / repository を作る。
6. `modules/notes/remote` を作り、UI の fetch 直書きを排除する。
7. `modules/notes/ui` に NotesList / NoteEditor / NoteDetail を段階分割する。
8. Canvas の共通 contract は `shared/canvas`、Cue / Summary / legacy 本文の Markdown 表示は `shared/markdown` へ分ける。
9. backup を `modules/backup` / `server/backup` へ移す。
10. Phase 2 DB migration に入る前に、Canvas と NoteCard の関係、delete、draft の方針を決める。

上記は推奨順であり、空の層や薄すぎる wrapper を先に量産しない。既存 route / component が十分小さい場合はそのまま残し、次の変更で責務が増えると判断できる箇所だけ移す。

## 今後の判断事項

### Phase 2 の本文モデル

判断は未決である。Gate 0 通過後に、現行 Canvas 本文を維持する案、Canvas と NoteCard を併用する案、NoteCard を採用しない案を比較する。NoteCard / NoteCueLink / D&D を採用する場合は、その判断後に DTO、DB model、migration、UI の責務境界を定義する。

autosave は採用した本文モデルの payload を前提に設計する。本文モデル判断前に NoteCard を Phase 2 の最初の実装対象として固定しない。

### `deletedAt` の扱い

推奨: 各実データ table に `deletedAt` を持たせ、`SoftDeleteBuffer` は Undo 期限と entity type / id を管理する。

理由: 最終仕様と整合しやすく、Undo 期限後の purge も扱いやすい。

### 現行本文と `NoteCard` の移行境界

`bodyMode=canvas` の本文は `NotebookCanvas.documentJson` の `CanvasDocumentV1`、`bodyMode=markdown` の `Notebook.body` は既存データ互換である。どちらも NoteCard への自動移行を決定していない。

NoteCard を採用する判断になった場合は、Canvas を維持する範囲、カードとの併用方法、legacy Markdown 本文の扱いを別のデータ移行設計で定義する。order 0 の NoteCard を自動作成する案や Canvas 要素をカードへ変換する案を、このターゲットアーキテクチャの既定値にしない。

### API query name

推奨: 最終仕様に合わせて `tags` を正とし、移行中だけ `tag` も受ける。

理由: 既存動作を壊さず仕様へ寄せられる。

### クラウド・オンライン境界

クラウド DB、クラウド同期、オンラインサービス、Vercel / Supabase / Postgres などの外部基盤は、現時点の製品スコープ外であり、将来実装予定の移行先として扱わない。過去に作成されたオンライン公開、同期の比較資料が残っている場合も、採用しない検討履歴として扱い、このターゲットアーキテクチャの provider や migration の前提にはしない。

したがって、現行 MVP、Phase 2、将来の Mac desktop 版のデータ境界は SQLite を唯一の正本とする。外部へ持ち出す必要がある場合は、SQLite から生成する PDF の派生出力だけを対象とし、PDF からの import や双方向同期は設計しない。

### Desktop shell と保存方式

デスクトップ配布へ進む前に、次の判断を別 PoC / 設計 task として確定する。

| 論点 | 選択肢 | 現時点の推奨 |
| --- | --- | --- |
| Desktop shell の選定 | Electron / Tauri + Node.js sidecar / その他 | Electron-first candidate と Tauri alternative を同じ最小 PoC で比較する |
| user data / PDF output path | OS user data directory / 未決定の PDF 出力先 | live DB・DB backup は OS user data。PDF の具体的な出力先は別途決める |
| canonical source / derived output | SQLite 正本 / PDF 派生出力 | SQLite を唯一の正本とし、PDF は一方向に生成する。PDF import / 双方向同期は設計しない |
| PDF export 契約 | レイアウト、生成 provider、エラー、出力先 | Phase 2 の PDF 設計で定義する。現行 MVP には追加しない |
| 配布・署名・更新 PoC | Apple Silicon / Intel、署名、notarization、更新方式 | Prisma native runtime、Playwright / Chromium、migration、データ保持を含めて検証する |

## 参考資料

- `summary/20260705/target-ui-feature-architecture.md`
- `summary/20260705/target-api-data-architecture.md`
- `summary/20260705/architecture-decision-record-draft.md`
- `summary/20260705/api-data-lib-architecture-inventory-report.md`
- `doc/technical/MVP_TECHNICAL_DESIGN.md`
- `doc/review/MVP_DETAIL_GAP_INVENTORY.md`

Desktop / local runtime の一次資料:

- [Next.js: Self-Hosting](https://nextjs.org/docs/app/guides/self-hosting)
- [Electron: `app` API / `app.getPath('userData')`](https://www.electronjs.org/docs/latest/api/app)
- [Tauri: Node.js as a sidecar](https://v2.tauri.app/learn/sidecar-nodejs/)
- [Prisma: SQLite database connector](https://docs.prisma.io/docs/orm/v6/overview/databases/sqlite)
