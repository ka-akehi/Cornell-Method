# Target Architecture

作成日: 2026-07-06

更新日: 2026-08-12

## 位置づけ

Cornell Method Notebook の保守と拡張に向けたターゲットアーキテクチャを定義する。

現行 MVP は Next.js App Router、React、Prisma、SQLite で動作している。現状は巨大な Client Component と Route Handler への処理の直書きに寄っているため、UI、backend、DB、HTTP contract の変更が互いに波及しやすい。Desktop Alpha の lifecycle、更新、migration、backup / restore、診断と、Desktop Alpha 後に採用済みの Canvas PNG、検索サジェスト、大規模一覧へ進めるため、責務境界を整える必要がある。autosave、Undo、専用復習タスク、NoteCard / D&D 等は未採用候補であり、この構成で実装を前提にしない。

ターゲット構成では変更理由ごとに責務を分け、UI、backend 実装、DB 実装、HTTP contract の変更が別領域へ波及しにくい状態を作る。層や抽象を増やすこと自体は目的にしない。機能追加によって変更理由が分かれた境界から、小さく移行する。

将来の製品主経路は Mac のデスクトップアプリ配布とする。ただし、開発と検証に使う Next.js Web 起動形態は残す。

デスクトップ版でも現行 MVP の local-first 方針を維持し、ノートデータの唯一の正本を各ユーザーの Mac 内 SQLite とする。クラウド DB、クラウド同期、オンラインサービスは製品スコープ外であり、アーキテクチャの将来移行先として扱わない。

Desktop Alpha の shell は Tauri + Node.js sidecar とする。retry24 の native lifecycle / runtime HTTP / package 証跡を根拠に、2026-08-17 に発注者が選定を承認した。Electron PoC は比較履歴として保持し、renderer UI automation の PoC BLOCKED は製品 UI の Alpha 受け入れを別途確認する境界として扱う。

## 採用する考え方

このプロジェクトの主アーキテクチャは **Modular Architecture** とする。`notes`、`backup`、Desktop Alpha 後の `export` など、採用済みの業務機能単位で責務を分け、各 module の中で UI、HTTP 境界、contract、server use case を必要な範囲だけ整理する。`review-tasks` 等の未採用候補は、採用判断後に module を追加する。

Clean Architecture、Hexagonal Architecture、Layered Architecture、BFF as Adapter、Feature-Sliced 的な考え方は、Modular Architecture を保守しやすくするための補助原則として扱う。React UI は component / hook / remote / model を実用上のまとまりで分け、Clean Architecture の use case 層や presenter 層を機械的に増やさない。

| 考え方 | このプロジェクトでの意味 |
| --- | --- |
| Modular Architecture | 主軸。業務機能単位で module を分け、変更理由を module 内に閉じ込める |
| Layered Architecture | 補助原則。server 側で HTTP、use case、DB access、DTO mapping が混ざる場合だけ軽量に分ける |
| Ports and Adapters / Hexagonal Architecture | 補助原則。Prisma、filesystem、Canvas PNG 生成、更新、将来 Rust API など外部境界を明示したい箇所だけ adapter として扱う |
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
- Desktop Alpha 後の Canvas PNG は、保存済み `CanvasDocumentV1` の用紙から一方向に生成する派生出力であり、編集用データ形式、復元用正本、SQLite との双方向同期対象にはしない。保存先は未決定で、`user data directory`、`app bundle`、`Downloads` のいずれかに固定しない。PDF export は現在未採用とする。
- SQLite の live file を iCloud / Dropbox などの同期フォルダへ置く設計は採用しない。クラウド同期やオンラインサービスの provider 境界も設けない。
- directory や層は、変更範囲を狭め、仕様変更時の影響を追いやすくする場合にだけ増やす。
- Desktop Alpha または後続機能の追加とアーキテクチャ移行を同じ task に混ぜない。

## ターゲット構成

次の配置をターゲットの目安とする。全ディレクトリを先に作らず、module が小さい間はファイル数を抑え、Desktop Alpha または採用済みの後続機能で責務が増える領域から段階的に移す。

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
      canvas-png-output.ts # post-Alpha target; not implemented yet

  desktop/                 # target / PoC boundary; not implemented yet
    local-runtime/
      next-server.ts        # local Next.js runtime lifecycle
    storage/
      user-data-path.ts     # OS user data directory resolution
      canvas-png-output-destination.ts # post-Alpha destination remains undecided

src-tauri/                 # Desktop Alpha product Tauri shell and packaging; PoC remains tools/desktop-poc/tauri/

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
| Desktop shell | `.app` の lifecycle、single application instance / 1 primary window、OS の file open / export dialog、user data path の決定、local runtime の起動・終了 | Notebook の business rule、Prisma query、Canvas の保存形式 |
| local Next.js runtime | self-hosted の Node.js 上で App Router、Route Handler、既存 API contract を提供する。開発時は `next dev`、配布時は bundle された runtime と `next start` 相当の起動を比較する | `.app` 内へ live DB を書くこと、shell 固有 API を UI / domain に漏らすこと |
| SQLite / filesystem adapter | `DATABASE_URL` の絶対 path 解決、user data directory の初期化、SQLite / Prisma migration、SQLite DB backup / restore | UI の状態、HTTP status、shell の window 制御、Canvas PNG を backup として扱うこと |
| Canvas PNG output adapter | Desktop Alpha 後に、保存済み Canvas の用紙を PNG へ変換して外部出力境界へ渡す。生成物は派生出力として扱う | SQLite の正本を書き換えること、PNG からの import、双方向同期、legacy Markdown の出力 |

`app bundle` には実行コード、Web 資産、Prisma Client / migration、必要な runtime / native driver を含める。macOS が管理する `user data directory` には SQLite live DB、app 管理 safety backup、設定、local log を置く。更新や reinstall で user data を暗黙に削除しない。アンインストールと完全なデータ削除も別操作とする。

SQLite の live DB はデスクトップ版でもノートデータの唯一の正本である。DB backup は SQLite ファイルの保全・復元用コピーとして扱う。Canvas PNG は Desktop Alpha 後に保存済み Canvas の用紙から生成する一方向の派生出力であり、PNG から SQLite へ戻す import や双方向同期は設計しない。PDF export は採用済みの provider boundary として扱わない。

### Desktop PoC の比較境界

Desktop Alpha の shell 選定は完了している。PoC は Tauri + Node.js sidecar の成立性を確認した証跡として保持し、次の条件を Desktop Alpha の packaged QA にも引き継ぐ。

Desktop Alpha の Tauri / Node.js sidecar の基盤境界は [DESKTOP_ALPHA_TAURI_FOUNDATION.md](DESKTOP_ALPHA_TAURI_FOUNDATION.md) に定める。

- 同じ現行 MVP baseline、同じ deterministic な 10,000 note SQLite fixture、同じ Apple Silicon Mac と macOS を使う。
- cold start、一覧・検索・詳細・編集・保存の操作反応、shell の main / core、renderer / WebView、local runtime、Node.js sidecar、framework helper、関連子 process の合計メモリ、成果物サイズを同じ手順で測定する。
- SQLite / Prisma / migration、single application instance / 1 primary window、二重起動時の既存 primary window 前面化、local runtime の起動・終了、app-owned process tree cleanup、DMG、アプリ内更新の成立性を確認する。
- shell の main / core、renderer / WebView、local runtime、Node.js sidecar、framework helper、関連子 process を許容する。OS process が複数存在することだけを blocker または不合格理由にしない。
- 実装・保守難度、安全性、framework / dependency license、Apple 関連費用、配布 storage / bandwidth、CI、保守工数を含む総コストを比較する。
- PDF export、packaged Playwright / Chromium、Canvas PNG、Intel、未検証の古い macOS を blocker または必須受け入れ条件にしない。

### Lifecycle と Settings

- Desktop Alpha は single application instance / 1 primary window とする。Settings modal、確認 dialog、OS file dialog は primary window に数えず、新しい独立 primary window を作らない。
- 二重起動時は新しい application instance / primary window を増やさず、既存 primary window を前面へ出す。最後の primary window を閉じると application instance を終了し、local runtime と app-owned child process をすべて停止して orphan process を残さない。
- shell の main / core、renderer / WebView、local runtime、Node.js sidecar、framework helper 等の内部 process を許容する。
- 次回起動はノート一覧から始め、前回 route は復元しない。window size / position は保持し、現在の画面領域外にある場合は見える位置へ補正する。
- dirty な状態で終了する場合は、保存して終了、保存せず終了、終了取消しの 3 結果を提供する。現行正本の取消し操作は「戻る」で、Escape と dialog 外操作も終了取消しとして扱う。保存失敗時は終了せず、編集内容と dirty 状態を保持する。
- 更新適用時の dirty state は通常終了と別に扱い、保存して更新、保存せず更新、更新取消しの 3 結果を提供する。Escape と dialog 外操作は更新取消しとして扱う。
- Settings modal は General、Updates、Data and Backup の 3 区分とする。Mac は Settings menu、開発用 Web は gear から開く。正確な文言と項目配置は UI 実装 task で決める。
- 現行 MVP の `/backup` は、Settings modal の Data and Backup が既存機能を代替し、受け入れ確認を通るまで維持する。その後の Desktop UI では段階的に廃止するが、このアーキテクチャ同期で route や API を削除しない。

### 更新と migration

- Desktop Alpha の初期配布は DMG とする。起動完了後に更新を非同期確認し、自動確認は最大 1 日 1 回とする。手動確認を提供し、更新確認の ON / OFF 設定は設けない。
- 更新 package は background download する。取得後も自動適用せず、ユーザーが「再起動して更新」を選んだ場合だけ明示的な再起動を経て適用する。
- 更新確認または download に失敗しても現行版を利用可能にする。次回の定期確認または手動確認で、manifest 確認から package 取得までの更新処理全体を再試行する。
- 同じ保留更新を modal で繰り返し通知せず、Settings から状態を確認できるようにする。複数版を飛ばす場合は、端末で利用できる最新の compatible version を選ぶ。
- 共通の静的 manifest は version、architecture、OS compatibility 等、更新判定に必要な最小情報だけを扱う。端末固有 ID、利用状況、ノート本文、Cue、Summary、タイトル、タグ、学習元、検索内容、SQLite、backup、診断 log を送信しない。
- package の署名・完全性検証に失敗した場合は取得物を破棄し、現行版を維持する。provider、manifest / package の配置先、検証方式は未決定である。
- pending migration がある更新だけ、更新適用直前に app 管理 safety backup を作る。pending migration がなければ、この理由による backup と migration を実行しない。
- migration は live DB へ直接適用せず、staging copy 上で古い順に実行する。schema、必須データ、Canvas、reopen を検証し、成功した場合だけ新しい app と DB へ atomic switch する。
- migration または reopen に失敗した場合は、現行 app と live DB を変更せず、現行版を利用可能にする。
- migration 前 safety backup は restore 前 safety backup と同じ app 管理領域で最新 3 世代を保持する。定期・日次・通常起動時・データ変更時の自動 backup は Desktop Alpha の必須要件にしない。

### Backup、restore、完全なデータ削除

- Data and Backup は、ユーザーが保存先を選ぶ平文 SQLite の手動 export、app 管理 backup からの復元、外部 backup file からの復元を別の操作として提供する。app 管理 backup の 3 世代 retention は外部 export file に適用しない。
- 2 つの restore 入口は staging validation、明示確認、atomic switch、restart の同じ pipeline を使う。restore 前に現在の live DB を app 管理 safety backup として保存する。
- restore file は SQLite integrity、foreign key、schema / migration compatibility、必須データ、存在する全 `CanvasDocumentV1`、切替後の reopen を検証する。validation または reopen に失敗した file は適用せず、live DB を変更しない。
- 古い schema の backup は staging copy に migration を古い順に適用する。現行 app より新しい schema の backup はその場で復元せず、compatible な更新後にユーザーの明示確認で復元を再開する pending restore とする。
- 完全なデータ削除は入力確認を伴う明示操作とし、live DB、app 管理 backup、設定を対象にする。外部 SQLite export は削除しない。更新、reinstall、通常の uninstall から暗黙に実行しない。

### Startup、診断、privacy

- 通常起動は DB open と schema 状態を確認し、全件 integrity check を毎回実行しない。詳細 integrity check は異常終了後、migration 後、restore 後等の必要時に限定する。
- 初回利用で DB がない場合は新規作成する。過去の利用記録があるのに live DB がない場合は空 DB を自動作成せず、backup 復元を主操作とする recovery UI へ案内する。
- DB が破損または読み取り不能で起動できない場合は通常のノート UI を開かず、自動修復もしない。診断情報を書き出して終了する操作を主とし、終了と backup 復元への案内を提供する。backup がない場合だけ、明示確認後に空 DB で始める選択肢を用意する。
- 利用中の save 失敗は編集内容と dirty 状態を保持し、再試行または編集へ戻れるようにする。保存成功扱い、自動終了、自動再起動を行わない。
- 異常終了後の次回手動起動で DB open と schema 確認に成功した場合は通常のノート一覧を開き、非 blocking 通知を一度だけ表示する。確認に失敗した場合は通常 UI より recovery UI を優先する。
- 外部 telemetry と crash report の自動送信を行わない。診断 bundle はユーザーの明示操作で local にだけ作成する。
- Application Support の local log は最大 14 日かつ合計 20 MB を上限とし、いずれかを超えた場合は古いものから削除する。
- local log と診断 bundle にノート本文、Cue、Summary、タイトル、タグ、学習元、SQLite、backup、Canvas JSON、検索文字列、token、user path、crash dump を含めない。診断 bundle は error log、時刻、component、sanitized stack、app version、macOS version、CPU architecture、DB schema version の allowlist で構成する。
- 更新 manifest と package 取得以外のノート操作は offline とする。Full Disk Access を要求せず、Application Support とユーザーが明示選択した file だけを扱う。
- local SQLite は macOS の file permission と FileVault を前提とし、Desktop Alpha で app 独自 DB encryption や専用 password / Touch ID lock を必須にしない。手動 export は平文 SQLite であることを保存時に案内する。

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
- Canvas PNG output provider（Desktop Alpha 後。未実装）
- SQLite live file の path resolver と migration runner
- Canvas PNG output destination resolver（具体的な保存先は未決定）

Repository は Prisma query / command に限定し、HTTP や React に依存しない。

外部境界の明示は軽量に行う。SQLite backup / restore provider、Prisma repository、Canvas PNG provider、更新 package のように副作用が大きいものを優先し、小さい helper まで adapter 化しない。

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
- 初回起動時は user data directory を作成し、DB がない初回利用だけ初期化する。既存 DB の migration は更新時の staging pipeline と分け、live DB へ直接適用しない。
- app bundle 内の DB を更新する、またはアプリ更新時に user data を再生成する設計は採用しない。
- `Downloads` を DB / backup の保存先として固定しない。Canvas PNG の保存先も未決定であり、shell や UI の保存先をこの文書で決めない。
- Electron と Tauri + Node.js sidecar は、同じ baseline、fixture、Mac、測定手順で比較する。Electron に既存 Node.js process model の利点があり得ることや、Tauri に shell size の利点があり得ることは実測前の仮説として扱う。
- PoC は現行 Next.js / Prisma runtime、lifecycle、SQLite、DMG、アプリ内更新の成立性を比較する。Playwright / Chromium の同梱や PDF export は必須条件にしない。

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

## Desktop Alpha 後の拡張境界

Desktop Alpha を先に完成させ、その後に追加機能を実装する。Canvas PNG と検索・一覧の UX・規模要件は採用済みであり、その他の候補は発注者が採用するまで module、API、schema、migration を固定しない。

| 機能 | 採用状態 | 主な責務境界 |
| --- | --- | --- |
| Canvas PNG | Desktop Alpha 後の最初の外部出力として採用済み、未実装 | `modules/export` または `server/export` と filesystem provider。保存先等は未決定 |
| 検索サジェスト | 採用済み、未実装 | notes UI / contract / application / search infrastructure。tag filter は既存境界を維持 |
| 無限スクロールと DOM windowing | 採用済み、未実装 | notes list UI / remote / contract / read infrastructure。取得単位と方式は未決定 |
| 自動保存 / draft / 409 | 未採用 | 採用時に `modules/notes/ui`、remote、application、persistence の競合境界を定義 |
| Undo / soft delete | 未採用 | 採用時に notes application、persistence、contracts と現行物理削除の移行境界を定義 |
| NoteCard / D&D | 未採用 | 採用時に Canvas との所有関係、DTO、DB model、migration、UI を定義 |
| 専用復習タスク | 未採用 | 採用時に `modules/review-tasks` と server boundary を追加 |
| PDF export | 未採用。再検討するかも未決定 | Canvas PNG と別の仕様、PoC、採用判断がない限り provider boundary を追加しない |

### Canvas PNG

Canvas PNG は、保存済み Canvas の用紙を画像として持ち出す機能であり、SQLite backup や編集用データ形式ではない。

- 保存済み `CanvasDocumentV1.page.width` × `page.height` の用紙全体を同じ寸法で PNG 化する。
- 出力対象は現在の paper 背景を含む Canvas の用紙だけとし、header、sidebar、toolbar、Cue、Summary、Settings 等のアプリ UI を含めない。
- 用紙外の要素部分は用紙境界で切り取り、画像を用紙外まで広げない。
- legacy `bodyMode=markdown` の本文を対象にしない。
- 初期ファイル名は `[タイトル]_[学習日].png` とし、その文字列を画像内へ描画しない。
- 使用不可文字、同名 file、保存先、失敗時 UI、色管理は後続仕様 task で決める。この文書では provider、artifact 方式、保存先を固定しない。

### 検索サジェスト

- 既存の tag 専用 filter を維持し、tag を検索対象 selector とサジェストに含めない。
- 検索対象は単一選択で、既定値をタイトルとする。タイトル、学習元、本文、Cue、すべてを基本候補とし、「すべて」はタイトル、学習元、本文、Cue を検索する。
- サジェストはノート card ではなく、選択した検索範囲の local data に存在する語句候補とする。外部辞書 API、外部推論、telemetry を使わない。
- 入力 1 文字目から最大 5 件を返し、前方一致を優先する。前方一致で 5 件に満たない場合の扱い、tokenization、同順位は未決定とする。
- debounce は 10,000 件の実測で必要な場合だけ導入する。現行 MVP の query にある 300ms debounce を、将来サジェストの方式として固定しない。
- Summary の検索対象分類、表示文言、API、index、query schema、keyboard 操作は未決定とする。

### 大規模一覧

- 5,000 件を長期利用の最低目標とし、それを利用上限にしない。deterministic な 10,000 note fixture で検索、一覧、詳細遷移、メモリの性能余裕を確認する。
- 一覧は全件を一度に取得・描画せず、下端へ近づいたときに次のまとまりを読む追加読み込み型の無限スクロールとする。
- virtualization または同等の windowing で、長時間スクロール後も DOM 要素とメモリを無制限に増やさない。
- 取得単位、cursor / offset、仮想化方式、事前読み込み距離は fixture の実測後に決める。現行 MVP の API と 1 ページ 50 件の契約は、後続仕様 task が承認されるまで変更しない。

自動保存、Undo、専用復習タスク、NoteCard / D&D 等を後から採用する場合も、legacy `Notebook.body` を order 0 の NoteCard へ移すことや、`CanvasDocumentV1` をカードへ自動変換することを前提にしない。

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
10. Desktop Alpha を完成させた後、Canvas PNG と検索・一覧を別 task で実装する。NoteCard、soft delete、draft は採用判断前に migration を作らない。

上記は推奨順であり、空の層や薄すぎる wrapper を先に量産しない。既存 route / component が十分小さい場合はそのまま残し、次の変更で責務が増えると判断できる箇所だけ移す。

## 今後の判断事項

### 未採用候補の本文モデル

NoteCard / NoteCueLink / D&D は未採用である。採用を検討する場合は、現行 Canvas 本文を維持する案、Canvas と NoteCard を併用する案、NoteCard を採用しない案を比較し、採用判断後に DTO、DB model、migration、UI の責務境界を定義する。

autosave も未採用であり、本文モデルの payload を先に固定しない。NoteCard を Desktop Alpha 後の実装対象として自動投入しない。

### `deletedAt` の扱い

soft delete と Undo は未採用である。現行 MVP は確認後の物理削除を維持し、既存 `Notebook.deletedAt` を復元や purge の契約に使わない。採用判断前に `SoftDeleteBuffer`、Undo 期限、各 table の `deletedAt` 方針を固定しない。

### 現行本文と `NoteCard` の移行境界

`bodyMode=canvas` の本文は `NotebookCanvas.documentJson` の `CanvasDocumentV1`、`bodyMode=markdown` の `Notebook.body` は既存データ互換である。どちらも NoteCard への自動移行を決定していない。

NoteCard を採用する判断になった場合は、Canvas を維持する範囲、カードとの併用方法、legacy Markdown 本文の扱いを別のデータ移行設計で定義する。order 0 の NoteCard を自動作成する案や Canvas 要素をカードへ変換する案を、このターゲットアーキテクチャの既定値にしない。

### API query name

推奨: 最終仕様に合わせて `tags` を正とし、移行中だけ `tag` も受ける。

理由: 既存動作を壊さず仕様へ寄せられる。

### クラウド・オンライン境界

クラウド DB、クラウド同期、オンラインサービス、Vercel / Supabase / Postgres などの外部基盤は、現時点の製品スコープ外であり、将来実装予定の移行先として扱わない。過去に作成されたオンライン公開、同期の比較資料が残っている場合も、採用しない検討履歴として扱い、このターゲットアーキテクチャの provider や migration の前提にはしない。

したがって、現行 MVP、Desktop Alpha、Phase 2、将来の Mac desktop 版のデータ境界は SQLite を唯一の正本とする。Desktop Alpha 後の外部出力は保存済み Canvas の用紙から生成する PNG とし、PNG からの import や双方向同期は設計しない。PDF export は現在未採用である。

### Desktop shell と保存方式

Desktop PoC と後続仕様 task では、次の未決事項だけを確定する。承認済みの lifecycle、更新、migration、backup / restore、Canvas PNG、検索・一覧の契約は採否未決へ戻さない。

| 論点 | 現在の契約 | 未決事項 |
| --- | --- | --- |
| Desktop shell の選定 | Tauri + Node.js sidecar を Desktop Alpha の shell とする。Electron は比較履歴として保持する | 承認済み |
| user data path | live DB、app 管理 backup、設定、local log は Application Support 側、app bundle は配布物として分離する | 保存構成は承認済み。実装の詳細は user data / SQLite bootstrap task で決める |
| 更新 | DMG、最大 1 日 1 回の非同期確認、手動確認、toggle なし、background download、明示再起動、失敗時の現行版維持 | provider、manifest / package の配置、署名・完全性検証方式 |
| Canvas PNG | 保存済み Canvas の用紙全体を同寸法で出力する。PDF は未採用 | 使用不可文字、同名 file、保存先、失敗時 UI、色管理、PDF を再検討するか |
| 検索・一覧 | 単一対象、local suggestion、5,000 件目標、10,000 件 fixture、無限スクロール、windowing を採用済み | Summary 分類、tokenization、同順位、API / index、取得単位、仮想化方式 |
| Public Mac Release | Intel、古い macOS、Developer ID、notarization、一般公開配布は Desktop Alpha の blocker にしない | architecture、minimum deployment target、署名、公開配布方式 |

## 参考資料

- `doc/requirements/PRODUCT_SPEC.md`
- `doc/implementation/POST_MVP_IMPLEMENTATION_PLAN.md`
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
