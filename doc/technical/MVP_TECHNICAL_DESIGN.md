# MVP 技術選定・実装方針

作成日: 2026-07-04
現行照合日: 2026-08-08
状態: 設計方針・比較資料。現行の受け入れ判定と作業指示は本書では管理しない。

## 位置づけ

当初のフルリニューアル版 Cornell Method Notebook に対する MVP 技術選定と実装方針を記録します。

作成時は MVP の画面設計、API 設計、データ設計を基準にし、現行実装の比較対象として整理しました。

現行の実装パス、実装状態、MVP の受け入れ判定は、現在のコードと正本文書を基準にします。

## 現行の照合入口と作業制約

現行の実装状態は [`IMPLEMENTATION_STATUS.md`](../implementation/IMPLEMENTATION_STATUS.md)、受け入れ項目と証跡は [`TEST_SCENARIOS.md`](../testing/TEST_SCENARIOS.md)、再開条件は [`HANDOFF_2026-08-08.md`](../../HANDOFF_2026-08-08.md) を参照します。

Gate 0（人力 MVP 結合テスト）は未通過です。

最新の handoff では Browser runtime QA の必須範囲に `BLOCKED` または `NOT RUN` が残っているため、静的確認や過去の部分的な runtime 証跡を Gate 0 の通過と扱いません。

Gate 0 通過後の依存関係と実装順は [`POST_MVP_IMPLEMENTATION_PLAN.md`](../implementation/POST_MVP_IMPLEMENTATION_PLAN.md) を参照します。

Gate 0 を発注者が明示的に閉じるまで、Phase 2、Mac desktop、PDF export、部分消しゴムの coding task は投入しません。

## 参照した公式情報

| 対象 | 参照先 | 確認内容 |
| --- | --- | --- |
| Next.js | `https://nextjs.org/docs` | App Router と最新バージョン表記 |
| Next.js self-hosting | `https://nextjs.org/docs/app/guides/self-hosting` | Node.js server としての自己ホスト、runtime / cache の扱い |
| Prisma | `https://www.prisma.io/docs` | Prisma ORM が SQLite を含む DB に対応 |
| Prisma SQLite connector | `https://docs.prisma.io/docs/orm/v6/overview/databases/sqlite` | SQLite file URL、database file、driver adapter |
| Electron | `https://www.electronjs.org/docs/latest/api/app` | `app.getPath('userData')` などの OS user data path |
| Tauri Node.js sidecar | `https://v2.tauri.app/learn/sidecar-nodejs/` | Node.js runtime を sidecar として配布する場合の候補 |
| Tailwind CSS | `https://tailwindcss.com/docs` | v4 系ドキュメント、ユーティリティベースのスタイリング |

実装直前に `npm view` または公式ドキュメントで再確認し、破壊的変更がない範囲の安定版を採用します。

## 採用方針

| 領域 | 採用方針 |
| --- | --- |
| フレームワーク | Next.js App Router |
| UI | React + TypeScript |
| スタイリング | Tailwind CSS v4 系 |
| DB | SQLite |
| ORM | Prisma ORM |
| バリデーション | Zod |
| Canvas 本文 | 新規ノートは `bodyMode=canvas` とし、`CanvasDocumentV1` を Canvas editor / viewer で扱う |
| Markdown 入力 | Cue、Summary、legacy Markdown 本文に textarea + preview を使う。Canvas 本文には使わない |
| Markdown 表示 | Cue、Summary、legacy Markdown 本文を `react-markdown` + `remark-gfm` + `rehype-sanitize` で安全に表示する |
| テスト | ESLint、TypeScript build、必要に応じて Playwright |
| バックアップ | Node.js script で SQLite DB をコピー |
| 配布 | 開発時は Next.js Web 起動を維持。将来は Mac desktop shell を比較する。Electron-first candidate、Tauri + Node.js sidecar alternative の採用は PoC 後 |
| デスクトップ保存 | SQLite を唯一の正本として user data directory に置く local-first。`app bundle` 内に live DB を置かず、`Downloads` を既定にしない |

## Desktop 配布 / local-first 保存方針

### 製品経路と現行 MVP の境界

将来の製品主経路は Mac のデスクトップアプリ配布とします。ただし、開発と検証に使う Next.js Web 起動形態は残します。現行 MVP は Prisma + SQLite の local-first 構成であり、ノートデータの唯一の正本は SQLite です。デスクトップ化に伴ってクラウド DB、クラウド同期、オンラインサービスを追加したり、現行の route、API、Prisma schema、手動保存、物理削除を作り替えたりしません。

Desktop shell は未決定です。Electron は Next.js / Node.js / Prisma / Playwright の組み合わせをまとめて配布しやすい候補、Tauri + Node.js sidecar は軽量 shell の代替候補として扱います。Apple Silicon / Intel の配布差、native runtime / driver、Playwright / Chromium、署名、notarization、更新、process lifecycle、filesystem 権限を Desktop PoC で比較してから採用案を決めます。

### 配布物と書き込み可能データの境界

| 境界 | 内容 | 配置・責務 |
| --- | --- | --- |
| `app bundle` | 実行コード、Next.js 資産、Prisma Client / migration、必要な Node.js runtime / SQLite driver、必要なら Playwright / Chromium の配布資産 | インストールされた `.app` 側。配布・更新対象であり、SQLite live file やユーザーのノートを保存しない |
| `user data directory` | SQLite live DB（唯一の正本）、DB backup、アプリ設定、ログ、runtime state | macOS の OS 管理ユーザーデータ領域。Desktop shell が path を解決し、初回起動時に作成する。`Downloads` は既定保存先にしない |
| `PDF output destination` | SQLite から生成する PDF | user data directory や `app bundle` とは別の外部出力境界。具体的な保存先は未決定で、既存仕様の確定前に固定しない |

SQLite の live file は `.app` 内に置きません。Desktop shell または local runtime が初回起動時に user data directory と必要なサブディレクトリを作成し、bundle に含めた migration を適用してからアプリを利用可能にする案を PoC で検証します。

アプリ更新では bundle の更新と user data migration を分離し、既存 DB、backup、設定を削除しません。アンインストールとユーザーデータ削除も別操作として扱います。

開発用 Web 起動では、既存の `.env` / `DATABASE_URL`、プロジェクト内の `dev.db`、論理的な `backup/` の扱いを維持します。配布版では同じ DB / backup adapter が user data directory の絶対 path を解決する形を比較し、`/backup` の UI と手動バックアップの MVP 契約を変更しません。

PDF output は SQLite から生成する派生出力です。PDF を編集して SQLite を更新することや、PDF から復元することは対象外とします。

### Desktop の backup / migration 段階

現行 MVP のバックアップは SQLite DB ファイルの手動コピーです。Desktop 化に伴う次の項目は候補であり、実装済みとは記述しません。

| 項目 | 現行 MVP | Desktop 化後の追加候補 |
| --- | --- | --- |
| 起動時初期化 | 開発手順で Prisma migration を適用 | 初回起動時に user data directory を作成し、migration を適用する。既存 DB の更新と初期化を分ける |
| DB backup | 手動で SQLite DB ファイルを `backup/` へコピー、最新 3 世代を保持 | user data 内の DB backup、バックアップ対象・保持・復元手順を PoC で定義する |
| PDF output | 現行 MVP の対象外、未実装 | SQLite から PDF を生成する。PDF は編集用データ形式・復元用正本ではなく、具体的な出力先は別途決める |
| restore / corruption detection | 自動復元なし。必要時は手動で DB を戻す | SQLite DB の整合性検査、復元、途中書き込みからの回復を別途設計する |

### PDF 出力の位置づけ

アプリ内のノートデータは SQLite に保存し、SQLite を現行 MVP、Phase 2、将来のデスクトップ版に共通する唯一の正本とします。外部へノートを持ち出す場合は、SQLite から PDF を生成する一方向の派生出力を基本とします。

- PDF は閲覧、印刷、持ち出しのための出力であり、編集用データ形式や SQLite の復元用正本ではない。
- PDF を編集して SQLite に戻す import、PDF と SQLite の双方向同期、PDF を canonical source とする運用は設計しない。
- PDF 生成は現行 MVP に実装されていない。Phase 2 で生成 provider、レイアウト、エラー処理、出力先を別途定義するが、具体的な出力先はこの文書では固定しない。
- Markdown / Canvas JSON / metadata の外部ノートファイルや、file-only / hybrid の保存方式は製品の将来機能として設計しない。

## クラウド・オンライン境界

クラウド DB、クラウド同期、オンラインサービス、Vercel / Supabase / Postgres などの外部基盤は、現時点の製品スコープ外です。過去に検討されたオンライン公開、同期の資料が残っている場合も、採用しない検討履歴として扱い、Phase 2 や将来の実装予定にはしません。

現行 MVP、Phase 2、将来の Mac desktop 版では、ノートデータの唯一の正本を SQLite とします。内部データは user data directory 内の SQLite に保存し、バックアップは SQLite DB のコピーとして扱います。アプリ外への出力は SQLite から生成する PDF の派生出力に限り、PDF を編集用データや復元用正本にせず、PDF から SQLite へ戻す import や双方向同期は設計しません。

PDF 生成は現行 MVP に未実装です。Phase 2 の PDF export で生成 provider、レイアウト、失敗時の扱い、出力先を定義しますが、具体的な出力先はこの文書では固定しません。

## API 実装言語の検討

### 候補

| 候補 | 内容 |
| --- | --- |
| TypeScript API | Next.js Route Handler で API を実装する |
| Rust API | axum などで Rust 製 API サーバーを別途実装する |

### Rust API のメリット

Rust は公式サイトでも、低いランタイムコスト、メモリ安全性、ネットワークサービスへの適性が強みとして説明されています。axum は Rust の HTTP ルーティング / リクエスト処理ライブラリで、extractor、JSON response、エラー処理、middleware などを備えています。

Rust API を採用するメリット:

- 高い実行性能を狙える。
- メモリ安全性が高い。
- 長期的にバックエンドを独立させやすい。
- API サーバー単体の責務境界を明確にできる。
- 将来的に重い処理、並列処理、CLI、ローカル常駐プロセスへ発展させやすい。

### Rust API のデメリット

MVP に Rust API を導入すると、次の運用と実装の負担が増えます。

- Next.js と Rust API の 2 プロセス構成になる。
- 開発サーバー起動、環境変数、ポート、CORS、ログの扱いが増える。
- Prisma を TypeScript 側で使う場合、Rust API と DB アクセス層が分断される。
- Rust 側で SQLx などを採用する場合、Prisma schema との二重管理が発生する。
- API 型定義を TypeScript / Rust 間で共有する仕組みが必要になる。
- Worker タスクが frontend / TypeScript API / Rust API に分かれ、実装と検証のコストが増える。
- SQLite の個人ローカル利用では、Rust の性能メリットが体感しにくい。

### MVP での判断

MVP では **TypeScript + Next.js Route Handler API を採用**します。

理由:

- 画面、API、Prisma、バリデーションを TypeScript で揃えられる。
- MVP の処理はノート CRUD、検索、復習済み更新、バックアップであり、Rust が必要な負荷ではない。
- ローカル個人利用の SQLite では、API 言語より DB 設計と UI の使いやすさの方が重要。
- Worker タスクを小さく分けやすい。
- `npm run lint` / `npm run build` / Prisma コマンドで検証を揃えられる。

### Phase 2 で Rust API を再検討する条件

次の条件が生じた場合は、Rust API または Rust 製補助プロセスを Phase 2 で再検討します。

- Markdown 解析、全文検索、PDF 生成など重い処理を常時行う。
- SQLite の単一プロセス前提では扱えない負荷や複数プロセス運用が発生する。
- API を Next.js から独立させたい。
- ローカル常駐アプリ、CLI、デスクトップアプリ化を検討する。
- バックアップ、インポート、エクスポート、インデックス生成などを高速なバイナリで扱いたい。

採用判断:

> MVP の API は TypeScript / Next.js Route Handler で実装する。Rust API は Phase 2 の検討事項とする。

## MVP の技術判断

### Canvas 本文と Markdown 項目を分離する

現行 MVP の新規ノート本文は `bodyMode=canvas` です。本文の正本は `NotebookCanvas.documentJson` 内の `CanvasDocumentV1` とし、`Notebook.body` は空文字で保存します。入力には Canvas editor、閲覧と復習には Canvas viewer を使い、Canvas 本文を Markdown textarea / preview の対象にしません。

Cue と Summary は Markdown のままです。textarea で編集し、GFM を含む preview を sanitize して表示します。`bodyMode=markdown` と `Notebook.body` は既存ノートを壊さないための互換モードとして保持し、既存本文を安全に表示します。新規ノートの標準本文や Canvas への自動移行対象にはしません。

高機能な Markdown エディタ、Markdown ツールバー、ショートカット拡張を検討する場合も、対象は Cue、Summary、legacy Markdown 本文です。Canvas 本文の editor / viewer 契約は分けて扱います。

### UI コンポーネントライブラリは必須にしない

MVP は画面数が少なく、フォーム、タブ、ボタン、一覧、確認ダイアログが中心です。最初から大きな UI ライブラリを入れるより、Tailwind と小さなローカルコンポーネントで始めます。

必要になった場合のみ、Headless UI や Radix UI などを検討します。

### SQLite + Prisma を維持する

このアプリはローカル個人利用です。サーバー運用、複数ユーザー、外部DB接続を前提にしないため、MVP では SQLite が適しています。

Prisma は型安全な DB アクセスと migration 管理に使います。

## MVP DB / Prisma 運用設計

### 対象 schema

MVP の Prisma schema 対象は `doc/data/MVP_DATA_DESIGN.md` の 5 model に限定します。

| Model | MVP での扱い |
| --- | --- |
| `Notebook` | ノート本体、`bodyMode`、legacy Markdown 本文、Summary、手動復習情報を保存する。`bodyMode=canvas` では `body` は空文字 |
| `NotebookCanvas` | `CanvasDocumentV1` の `documentJson`、schema version、Canvas text 要素由来の `searchText` を保存する |
| `Cue` | 左欄の Cue / キーワード / 質問。`Notebook` に従属する |
| `Tag` | タグ候補マスタ。`name` は unique |
| `NotebookTag` | Notebook と Tag の中間テーブル |

新規ノートは `bodyMode=canvas` で作成し、`NotebookCanvas.documentJson` を保存します。一覧のフリーワード検索は title、Summary、Cue、legacy `Notebook.body`、`NotebookCanvas.searchText` を対象にします。`searchText` は Canvas の text 要素から生成し、用紙寸法だけを変更した場合は値を変えません。

MVP 外として schema に混ぜないもの:

- `NotebookDraftState`
- `NotebookReviewProgress`
- `SoftDeleteBuffer`
- `BackupLog`
- `CueCard`
- `NoteCard`
- `NoteCueLink`

`CueCard`、`NoteCard`、`NoteCueLink` は現行 MVP に存在しません。Phase 2 での本文カード採用と現行 Canvas 本文の関係は未決定です。Gate 0 通過後に Canvas 維持、カード併用、カード不採用を比較し、legacy `Notebook.body` の order 0 カード化や Canvas からの自動変換を前提にしません。

### SQLite DB ファイルと環境変数

MVP は SQLite file URL だけをサポートします。

| 項目 | 方針 |
| --- | --- |
| 環境変数 | `DATABASE_URL` |
| URL 形式 | `file:` で始まる SQLite path |
| `.env.example` | 現行の local SQLite セットアップ用テンプレートではない。ファイル内の Postgres / hosted 用変数は、採用しない検討資産として扱う |
| 実行時 fallback | `src/lib/prisma.ts` と `src/lib/backup/index.js` は未指定時に `file:./dev.db` を使う |
| Prisma CLI fallback | `prisma.config.ts` は未指定時に `file:./dev.db` を使う |

上表は開発用 Web 起動形態の MVP 契約です。Desktop 配布では、`DATABASE_URL` を user data directory 内の SQLite absolute path に解決する adapter を用意する案を検証します。`app bundle` 内の `.db` を live DB にしたり、更新時に bundle から DB を再コピーしたりしません。初回起動時に user data directory を作成し、同梱 migration を適用します。アプリ更新では migration の適用と bundle 更新を分け、既存データを削除しません。アンインストールとデータ削除も別操作とします。

Desktop shell の候補は Electron-first、Tauri + Node.js sidecar alternative であり、両候補とも未採用で未実装です。Apple Silicon / Intel の native runtime、Prisma driver、Playwright / Chromium の同梱、ローカル Next.js process の起動と終了を PoC で確認してから、`DATABASE_URL` の path resolver と migration runner の実装方法を決めます。

README 化時の推奨（作成時の履歴メモ）:

- 新規環境では local SQLite を使い、未指定時の `DATABASE_URL` は `file:./dev.db` と案内する。
- 別の SQLite ファイルを使う場合だけ、未追跡の `.env` または shell に `file:` URL を設定する。
- `DATABASE_URL` に `postgres://` など SQLite 以外を指定しない。クラウド DB や別 DB への移行は製品スコープ外であり、この MVP 技術方針の将来計画には含めない。

このメモは現行のセットアップ手順ではありません。

### Prisma migrate / generate 手順

初回セットアップ:

```bash
npm install
npm run prisma:generate
npm run prisma:migrate
```

別の SQLite ファイルを使う場合だけ、未追跡の `.env` または shell に `DATABASE_URL="file:./relative.db"` などの `file:` URL を設定します。

`.env.example` の Postgres / hosted 用変数を local SQLite の設定例としてコピーしません。

schema 変更時:

```bash
npm run prisma:migrate
npm run prisma:generate
```

検証:

```bash
npx prisma validate
npm run prisma:generate
npm run prisma:migrate
```

運用メモ:

- `npm run prisma:migrate` は `prisma migrate dev` を実行し、migration 適用と必要な生成処理を行う。
- Worker タスクで schema を変更した場合は、migration SQL を確認し、MVP 外テーブルが混入していないことを確認する。
- schema を変更していないドキュメント作業では Prisma コマンドの実行は必須ではない。

### Seed 方針

MVP では seed を必須にしません。

理由:

- 固定マスタがない。
- `Tag` はノート保存時に upsert できる。
- サンプルデータなしでも、作成、検索、復習、バックアップの主要フローを確認できる。

README には seed 手順を書かないか、「MVP では seed なし」と明記します。開発用サンプルデータが必要になった場合は、任意実行の `prisma/seed.*` として別タスクで追加し、通常セットアップ手順からは分離します。

### 削除と `deletedAt`

MVP は物理削除です。

- `DELETE /api/notes/:id` は `Notebook` を物理削除する。
- `NotebookCanvas`、`Cue`、`NotebookTag` は外部キー cascade で削除する。
- `Notebook.deletedAt` は現 schema に存在するが、MVP では使用しない。
- `SoftDeleteBuffer`、Undo、期限切れ purge は Phase 2 とする。

## MVP Backup 運用設計

### 対象と保存先

バックアップは SQLite DB ファイルだけを対象にします。

| 項目 | 方針 |
| --- | --- |
| コピー元 | `DATABASE_URL` が指す SQLite DB ファイル |
| 保存先 | プロジェクトルートの `backup/` |
| ファイル名 | `YYYY-MM-DDTHH-mm-ss.db` |
| 保持数 | 最新 3 世代 |
| 4 世代目以降 | 古いものから削除 |
| ログ DB | MVP では作らない |
| 復元 | MVP では自動復元なし。必要時は手動で DB ファイルを戻す |

ここでいう `backup/` は開発用 Web 起動形態における現行 MVP の論理保存先であり、手動の SQLite DB コピーという契約を表す。Desktop 配布では、同じバックアップ処理を user data directory 内の backup 領域へ解決する候補を検討する。DB backup は PDF output と別の保全単位であり、PDF をバックアップや復元用の正本とはみなさない。

アプリ起動時の migration / 初期化、DB の復元、破損検出、PDF 生成は Desktop 化または Phase 2 の追加候補である。現行 MVP の自動バックアップ、Undo、soft delete、復元 API、`BackupLog`、PDF export を実装済みとは扱わない。

### 実装単位

現行のバックアップ処理は、API / application service / SQLite infrastructure と Node script の wrapper に分かれます。

| ファイル | 役割 |
| --- | --- |
| `src/server/backup/infrastructure/local-sqlite-backup-provider.js` | `DATABASE_URL` 解決、SQLite コピー、一覧、3 世代 prune |
| `src/server/backup/application/backup.service.js` | provider の create / list を application service として公開 |
| `src/app/api/backups/route.ts` | `GET /api/backups`、`POST /api/backups` の route handler |
| `src/modules/backup/ui/components/backup-page.tsx` | `/backup` の一覧・作成 UI |
| `src/lib/backup/index.js` | 既存 import 向けの互換 re-export。主実装ではない |
| `scripts/backup-copy.js` | CLI から `createBackup` を実行する wrapper |
| `package.json` | `npm run backup:copy` で CLI 実行 |

`src/server/backup/infrastructure/local-sqlite-backup-provider.js` は `DATABASE_URL` が `file:` 形式でない場合や DB ファイルが存在しない場合に `BackupError` を投げます。API はこの失敗を `{ code, message, errors? }` 形式の server error として返します。

### 実行手順

CLI:

```bash
npm run backup:copy
```

画面 / API:

- `/backup` から手動作成する。
- API は `POST /api/backups` で同じ helper を呼ぶ。
- 一覧は `GET /api/backups` で `backup/` 配下の最新 3 世代を返す。

### 失敗時の扱い

MVP では、失敗を永続ログへ保存しません。

| 失敗 | MVP の扱い |
| --- | --- |
| DB ファイル不在 | 画面/API/CLI にエラーを返す |
| `DATABASE_URL` が `file:` 形式ではない | エラーを返す |
| コピー失敗 | エラーを返す |
| prune 失敗 | エラーを返す |

Phase 2 で扱うもの:

- `BackupLog`
- `/api/backups/retry`
- `/api/backups/logs`
- `/notes/backup` ルートへの統合
- アプリ起動時の自動バックアップ

### README に書く材料（作成時の履歴メモ）

次の一覧は本書作成時に README へ反映するために残したメモです。

現行の案内は README と正本文書を参照し、この一覧を作業指示として扱いません。

1. local SQLite を使うことを明記する。
2. 未指定時の `DATABASE_URL` は `file:./dev.db` であることを明記する。
3. `npm install`、`npm run prisma:generate`、`npm run prisma:migrate` を案内する。
4. seed は MVP では不要と明記する。
5. `npm run dev` で起動する。
6. `/notes` で作成、検索、閲覧、編集、復習を確認する。
7. `/backup` または `npm run backup:copy` で DB バックアップを作成する。
8. `backup/` は最新 3 世代のみ保持し、復元は手動運用であることを明記する。

### Server Actions はMVPでは必須にしない

MVP では Route Handler ベースの API を採用します。

理由:

- Worker タスクに分割しやすい
- API テスト観点が明確
- 画面と保存処理の境界がわかりやすい

Server Actions は、フォーム実装を簡略化したくなった段階で検討します。

## ディレクトリ方針

```text
src/
  app/
    notes/page.tsx
    notes/new/page.tsx
    notes/[id]/page.tsx
    backup/page.tsx
    api/notes/
    api/tags/
    api/backups/
  modules/
    notes/contracts/
    notes/model/
    notes/remote/
    notes/ui/components/
    notes/ui/canvas/
    notes/ui/hooks/
  server/
    notes/application/
    notes/infrastructure/
    backup/application/
    backup/infrastructure/
  shared/
    canvas/
    markdown/
  lib/
    backup/index.js       # 既存 import 向けの互換 re-export
prisma/
  schema.prisma
scripts/
  backup-copy.js
```

## MVP で追加しない依存

| 依存候補 | MVPで外す理由 |
| --- | --- |
| D&D ライブラリ | Cue は単純な上下移動または作成順で足りる |
| PDF export provider / packaged Chromium | PDF 出力は Phase 2。既存の Playwright は E2E 検証用であり、PDF export の実装を意味しない |
| 高機能 Markdown エディタ | Cue / Summary / legacy Markdown 本文は textarea + preview で扱い、Phase 2 で必要に応じて導入する。Canvas 本文は対象にしない |
| 状態管理ライブラリ | React state と URL query で足りる |
| 認証ライブラリ | ローカル個人利用で認証なし |
| 通知・スケジューラ | 高度な復習タスクは Phase 2 |
| Rust API サーバー | MVP では TypeScript API に統一し、Phase 2 で必要に応じて検討 |

## 実装時の検証コマンド

MVP 実装では次を実行します。

```bash
npm run lint
npm run build
npm run prisma:generate
npm run prisma:migrate
```

必要に応じて、主要フローだけ Playwright で確認します。

## Open Question

| ID | 論点 | Manager 推奨 |
| --- | --- | --- |
| Q-001 | Cue / Summary と legacy Markdown 本文は textarea + preview、現行本文は Canvas editor / viewer でよいか | はい。新規本文は Canvas、Markdown UI は Cue / Summary と互換本文に限定する |
| Q-002 | UI ライブラリは MVP では入れず、Tailwind とローカルコンポーネントでよいか | はい |
| Q-003 | Route Handler API を採用し、Server Actions は MVP 外でよいか | はい |
| Q-004 | バックアップスクリプトは TypeScript ではなく Node.js script でもよいか | はい |
| Q-005 | Rust API は MVP では採用せず、Phase 2 検討事項でよいか | はい |
| Q-006 | Desktop shell を Electron と Tauri + Node.js sidecar のどちらにするか | Electron-first candidate と Tauri alternative の最小 PoC を比較して決める |
| Q-007 | user data directory と PDF output destination の path をどう決めるか | live DB・DB backup は user data directory。PDF の具体的な出力先は別途決める |
| Q-008 | PDF export の生成 provider、レイアウト、エラー処理をどう定義するか | Phase 2 の PDF export 設計で決める。PDF import / 双方向同期は設計しない |
| Q-009 | Mac 配布・署名・更新をどう検証するか | Apple Silicon / Intel、native runtime / driver、Playwright / Chromium、migration、データ保持を含む PoC を行う |
| Q-010 | Phase 2 で Canvas 本文と NoteCard をどう扱うか | Gate 0 後に Canvas 維持、カード併用、カード不採用を比較する。legacy body / Canvas の自動移行は決定しない |

## 現行の作業案内

最初に、[`HANDOFF_2026-08-08.md`](../../HANDOFF_2026-08-08.md) の再開条件と [`TEST_SCENARIOS.md`](../testing/TEST_SCENARIOS.md) の必須シナリオを確認します。

Gate 0（人力 MVP 結合テスト）が未通過で、Browser runtime QA に `BLOCKED` または `NOT RUN` が残る間は、UI を含む新しい coding task を投入しません。

Gate 0 の finding 修正、再テスト、品質コマンド、証跡更新、発注者の明示承認がそろった後に、[`POST_MVP_IMPLEMENTATION_PLAN.md`](../implementation/POST_MVP_IMPLEMENTATION_PLAN.md) の Stage 1 から採用範囲を決めます。

### 作成時の「次に決めること」（履歴）

当初は、Desktop shell の選定、`user data directory` と PDF output destination の境界、PDF export 契約、配布、署名、更新に関する PoC の順に判断し、Electron / Tauri の実装と PDF 生成を別 task に分ける案を記録しました。

この順序は Gate 0 通過後の候補です。

現在の投入指示ではありません。
