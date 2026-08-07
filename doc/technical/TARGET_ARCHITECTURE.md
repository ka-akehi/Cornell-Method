# Target Architecture

作成日: 2026-07-06

## 位置づけ

この文書は、Cornell Method Notebook を今後保守しやすく拡張するためのターゲットアーキテクチャを定義する。

現行 MVP は Next.js App Router、React、Prisma、SQLite で動作しているが、現状の構成は巨大な Client Component と Route Handler 直書きに寄っており、Phase 2 以降の自動保存、Undo、NoteCard / D&D、復習タスク、PDF export、認証、将来の Rust API 導入に対して保守性が不足している。

この構成は、単にファイルを細かくするためではなく、変更理由ごとに責務を分け、UI と backend 実装、DB 実装、HTTP contract を疎結合にするための方針である。ただし、層や抽象を増やすこと自体を目的にしない。実装は小さく移行し、機能追加時に実際の変更理由が生じた境界から分ける。

将来の製品主経路は Mac のデスクトップアプリ配布とする。ただし、開発・検証用の Next.js Web 起動形態は残す。デスクトップ版でも現行 MVP の local-first 方針を維持し、クラウド DB を必須にせず、各ユーザーの Mac 内 SQLite を基本とする。Electron を最短経路候補、Tauri + Node.js sidecar を代替候補として比較するが、いずれも実装着手済み・採用確定とは扱わない。

## 採用する考え方

このプロジェクトの主アーキテクチャは **Modular Architecture** とする。`notes`, `backup`, `review-tasks`, `export` などの業務機能単位で責務を分け、各 module の中で UI、HTTP 境界、contract、server use case を必要な範囲だけ整理する。

Clean Architecture、Hexagonal Architecture、Layered Architecture、BFF as Adapter、Feature-Sliced 的な考え方は、正式に全面採用する設計体系ではなく、Modular Architecture を保守しやすくするための参考・補助原則として扱う。特に React UI 側へ Clean Architecture を厳密適用しない。UI は component / hook / remote / model を実用上のまとまりで分けるが、use case 層や presenter 層を機械的に増やさない。

| 考え方 | このプロジェクトでの意味 |
| --- | --- |
| Modular Architecture | 主軸。業務機能単位で module を分け、変更理由を module 内に閉じ込める |
| Layered Architecture | 補助原則。server 側で HTTP、use case、DB access、DTO mapping が混ざる場合だけ軽量に分ける |
| Ports and Adapters / Hexagonal Architecture | 補助原則。Prisma、filesystem、PDF 生成、将来 Rust API など外部境界を明示したい箇所だけ adapter として扱う |
| Clean Architecture | 参考。server 側の責務分離の語彙として使うが、React UI や小さい module に厳密適用しない |
| Contract-First / API-First Design | DTO、error response、date format など HTTP API contract を安定させるために使う。OpenAPI や生成コードは必要になるまで導入しない |
| Backend for Frontend as Adapter | 補助原則。Next.js `app/api/**` を HTTP adapter として薄く保つ考え方に留める |

名前を付けるなら、**Modular Architecture for Next.js with lightweight server boundaries** とする。

## 基本方針

- `src/app/**` は routing、page、layout、HTTP boundary に薄く保つ。
- UI は DB、Prisma、filesystem、Next.js Route Handler の内部実装を知らない。
- UI は domain ごとの remote module 経由で HTTP API を呼ぶ。
- React UI 側には Clean Architecture を厳密適用しない。component、hook、remote、model の分割は、巨大化や再利用、テスト容易性など実際の必要がある場合に行う。
- HTTP request / response の形は contract として明示し、Next.js API でも将来 Rust API でも同じ contract を守る。
- Contract-first の範囲は、当面 DTO、error response、validation error、date-only / datetime format、null の扱いを安定させることに絞る。
- OpenAPI、schema 生成、client 生成は最初から必須にしない。Rust API 移行や contract drift が現実的なリスクになった時点で導入を検討する。
- server 側は service / repository / mapper に分ける。ただし小さい endpoint では無理に全層を作らず、責務が混ざり始めた時点で分割する。
- Prisma shape と API/UI DTO を同一視しない。
- 配布物とユーザーデータの保存境界を明示する。`app bundle` は実行コード、Next.js 資産、Prisma Client / migration、必要な runtime / driver を含む読み取り専用の配布物とし、`user data directory` は SQLite の live DB、DB backup、設定、ログを持つ書き込み可能領域とする。
- `optional note workspace / export directory` はユーザーが可搬性を求めて明示的に選択する領域とし、既定の user data directory や `Downloads` と混同しない。SQLite の live file を iCloud / Dropbox などの同期フォルダへ直接置くことは既定にしない。
- directory や層の数を増やすことを成果にしない。成果は、変更範囲が狭くなり、仕様変更時の影響を追いやすくなることで判断する。
- Phase 2 機能追加とアーキテクチャ移行を同じ task に混ぜない。

## ターゲット構成

以下は最終的に目指す配置の目安であり、最初から全ディレクトリを作る指示ではない。module が小さい間はファイルを増やしすぎず、Phase 2 の実装で責務が増えた領域から段階的に移す。

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
      note-workspace.ts

  desktop/                 # target / PoC boundary; not implemented yet
    shell/
      electron-main/       # shortest-path candidate
      tauri/                # alternative candidate
    local-runtime/
      next-server.ts        # local Next.js runtime lifecycle
    storage/
      user-data-path.ts     # OS user data directory resolution
      workspace-path.ts     # explicit note workspace / export path

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
    markdown/
      MarkdownField.tsx
      MarkdownPreview.tsx
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
| SQLite / filesystem adapter | `DATABASE_URL` の絶対 path 解決、user data directory の初期化、SQLite / Prisma migration、DB backup、将来の note workspace export / import | UI の状態、HTTP status、shell の window 制御 |

`app bundle` には実行コード、Web 資産、Prisma Client / migration、必要な runtime / native driver を含める。`user data directory` は macOS の OS 管理領域を基本とし、SQLite live DB、DB backup、設定、ログを置く。初回起動時に領域を作成して migration を適用し、アプリ更新では bundle とデータ migration を分離する。アンインストールとデータ削除は別操作とし、更新で user data を消さない。

ノートファイルを使う場合は、まず SQLite を運用上の正本とし、`optional note workspace / export directory` を export / backup / migration の出力先として扱う。将来、ノートファイルを正本、SQLite を再構築可能な index とする hybrid へ進むかは、必要性・整合性復旧・検索性能を確認して Phase 2 以降に決める。

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

React UI では Clean Architecture の層を厳密に作らない。画面が小さいうちは component と hook に留め、remote 呼び出し、payload 変換、複雑な状態管理が肥大化したときだけ `model` や `lib` へ逃がす。

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

Rust API 導入時も、この contract を守ることで UI 変更を最小化する。当面は TypeScript の DTO 型、Zod schema、error response、date format の合意を正とし、OpenAPI は contract drift を検知する必要が出た段階で追加する。

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

ただし、すべての server 処理に application / infrastructure / presenters を機械的に作る必要はない。複数 endpoint で共有される rule、transaction、DB query、DTO mapping が出てきた箇所から分ける。

### `src/server/<domain>/infrastructure/**`

DB や filesystem など外部実装に依存する処理を置く。

例:

- Prisma repository
- SQLite backup provider
- 将来の PDF provider
- 将来の Postgres / Supabase provider
- SQLite live file の path resolver と migration runner
- 明示的に選択された note workspace の export / import adapter

Repository は Prisma query / command に限定し、HTTP や React に依存しない。

外部境界の明示は軽量に行う。SQLite backup provider、Prisma repository、PDF provider のように差し替え可能性や副作用が大きいものを優先し、小さい helper まで adapter 化しない。

### `src/server/<domain>/presenters/**`

DB record や persistence shape を API DTO に変換する mapper を置く。

例:

- Prisma `DateTime` -> `YYYY-MM-DD`
- `Notebook + cues + tags` -> `NoteDetailDto`
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
- Markdown preview / sanitize config
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

Server Actions は Next.js 固有の境界になりやすいため、今回の主 API contract にはしない。使う場合も form submit の薄い adapter に限定し、正本は HTTP contract に寄せる。

ここでいう BFF / adapter は補助的な見方であり、Next.js API 層を独立した巨大 backend にする意図ではない。Route Handler は request / response 変換と service 呼び出しに留める。

### Desktop 配布時の Next.js runtime

Next.js は self-hosted Node.js server として動かせるため、Desktop PoC では shell がローカル runtime を起動し、既存の App Router / Route Handler をローカル HTTP 境界として再利用する案を第一に比較する。開発用の `next dev` / local Web 起動は残し、配布版だけが `.app` 内の資産と user data directory の path を受け取る。

- runtime が受け取る `DATABASE_URL` は user data directory 内の SQLite absolute path とする。
- 初回起動時は user data directory の作成、DB 初期化、bundled migration の適用を行ってから画面を利用可能にする案を PoC で検証する。
- app bundle 内の DB を更新する、またはアプリ更新時に user data を再生成する設計は採用しない。
- `Downloads` を DB / backup の既定場所にしない。可搬性が必要な場合は shell の明示的な directory chooser を通した note workspace / export directory を使う。
- Electron は Node.js、Next.js、Prisma、Playwright と同一の runtime / process model を保ちやすい最短経路候補である。ただし、Electron の採用は未確定であり、サイズ、署名、更新、security boundary を PoC で確認する。
- Tauri は軽量 shell の代替候補だが、現行 Node.js / Prisma / Playwright をそのまま同梱できるとは仮定しない。Node.js runtime を sidecar / bundled resource として扱う構成、IPC、権限、配布 target を PoC で検証する。

## Rust API 移行への適合性

理想の依存は次の通り。

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

Rust API 移行をさらに滑らかにするために、当面安定させる条件:

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
| NoteCard / D&D | `modules/notes/ui/components`, `modules/notes/model`, `server/notes/infrastructure`, `server/notes/presenters` |
| 復習タスク | `modules/review-tasks`, `server/review-tasks` |
| PDF export | `modules/export` または `server/export`, provider boundary |
| 認証 | middleware, `shared/http`, Route Handler adapter |
| backup provider 差し替え | `server/backup/infrastructure` |

重要な順序:

1. DTO / mapper / HTTP contract を固める。
2. notes service / repository を作る。
3. UI remote / hooks / components を分割する。
4. NoteCard / NoteCueLink の DB model を決める。
5. その後に autosave / Undo / review task を入れる。

自動保存は保存対象の構造に依存するため、MVP の単一 `body` 前提で先に作ると NoteCard 化の時に作り直しが大きくなる。先に card model と DTO 境界を決める方がよい。

## 移行方針

大規模な一括移動はしない。以下の順で、挙動を変えない task と機能追加 task を分ける。

1. `shared/http` と API error DTO を作る。
2. `server/infrastructure/prisma.ts` へ Prisma singleton を移す。
3. `modules/notes/contracts` と mapper を作る。
4. notes read service / repository を作る。
5. notes command service / repository を作る。
6. `modules/notes/remote` を作り、UI の fetch 直書きを排除する。
7. `modules/notes/ui` に NotesList / NoteEditor / NoteDetail を段階分割する。
8. `shared/markdown` を作る。
9. backup を `modules/backup` / `server/backup` へ移す。
10. Phase 2 DB migration に入る前に NoteCard / delete / draft の方針を決める。

上記は推奨順であり、空の層や薄すぎる wrapper を先に量産しない。既存 route / component が十分小さい場合はそのまま残し、次の変更で責務が増えると判断できる箇所だけ移す。

## 今後の判断事項

### Phase 2 の最初の実装対象

推奨: NoteCard / NoteCueLink / D&D の設計と migration を先に決め、その後に autosave を入れる。

理由: autosave payload は最終的な card model に依存するため。

### `deletedAt` の扱い

推奨: 各実データ table に `deletedAt` を持たせ、`SoftDeleteBuffer` は Undo 期限と entity type / id を管理する。

理由: 最終仕様と整合しやすく、Undo 期限後の purge も扱いやすい。

### MVP `body` から `NoteCard` への移行

推奨: 既存 `body` を order 0 の `NoteCard` 1 枚に移す。

理由: 自動分割は誤分割リスクがあり、`body` と `NoteCard` の二系統運用は保守性を落とす。

### API query name

推奨: 最終仕様に合わせて `tags` を正とし、移行中だけ `tag` も受ける。

理由: 既存動作を壊さず仕様へ寄せられる。

### Postgres / Supabase 移行

推奨: 当面 SQLite local を継続し、repository / provider 境界だけ確保する。実移行は別 spike にする。

理由: デスクトップ版の前提にクラウド DB はなく、Phase 2 機能とオンライン DB 移行を同時にやると判断点が増えすぎる。Vercel / Supabase / Postgres はオンライン公開・同期が必要になった場合の任意の将来案として扱う。

### Desktop shell と保存方式

デスクトップ配布へ進む前に、次の判断を別 PoC / 設計 task として確定する。

| 論点 | 選択肢 | 現時点の推奨 |
| --- | --- | --- |
| Desktop shell の選定 | Electron / Tauri + Node.js sidecar / その他 | Electron-first candidate と Tauri alternative を同じ最小 PoC で比較する |
| user data / workspace path | OS user data directory / ユーザー選択 workspace | live DB・backup は OS user data、可搬ファイルだけ明示選択 workspace |
| SQLite-only と hybrid の境界 | SQLite 正本 / file-only / file 正本 + local SQLite index | 第一段階は SQLite 正本 + file export / backup / migration |
| export / import 契約 | `note.md` + `canvas.json` + `metadata.json` / パッケージ形式 | まず file layout と schema version、atomic write、復旧エラーを定義する |
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
