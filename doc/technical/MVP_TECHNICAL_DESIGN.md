# MVP 技術選定・実装方針

確認日: 2026-07-04

## 位置づけ

このドキュメントは、フルリニューアル版 Cornell Method Notebook の MVP 技術選定と実装方針です。

現行実装や既存依存関係は制約にせず、MVP の画面設計・API設計・データ設計に合う構成を採用します。

## 参照した公式情報

| 対象 | 参照先 | 確認内容 |
| --- | --- | --- |
| Next.js | `https://nextjs.org/docs` | App Router と最新バージョン表記 |
| Prisma | `https://www.prisma.io/docs` | Prisma ORM が SQLite を含む DB に対応 |
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
| Markdown 入力 | textarea ベースから開始。必要なら軽量エディタを追加 |
| Markdown 表示 | `react-markdown` + `remark-gfm` + `rehype-sanitize` を候補 |
| テスト | ESLint、TypeScript build、必要に応じて Playwright |
| バックアップ | Node.js script で SQLite DB をコピー |

## 将来の Vercel / Supabase 移行検討

### 背景

発注者は、無料で運用できる範囲であれば、将来的にローカル実行だけでなく Vercel へデプロイし、SQLite ではなく Supabase を使う可能性を検討している。

2026-06-15 時点の公式情報では、Vercel の Hobby plan は個人プロジェクト向けに Free とされている。Supabase は Free plan を提供し、Free plan では 2 free projects、Database Size 500 MB per project などの利用枠が示されている。

### 現行MVPへの影響

現行の MVP 構想は大きく変えない。ただし、以下は将来移行に影響する。

| 領域 | ローカル SQLite MVP | Vercel + Supabase 移行時 |
| --- | --- | --- |
| DB | SQLite ファイル | Supabase Postgres |
| バックアップ | DB ファイルコピー | Supabase 側のバックアップ / export 方針 |
| デプロイ | ローカル dev server | Vercel deployment |
| 環境変数 | `DATABASE_URL=file:...` | Supabase connection string |
| API | Next.js Route Handler | 継続利用しやすい |
| 認証 | なし | Vercel に載せる場合、URLが生成されるためアプリ側Basic認証相当を実装する |
| データ保護 | ローカルPC依存 | Supabase project / RLS / 接続情報管理が必要 |

### 影響を小さくする設計方針

MVP ではローカル SQLite を採用しつつ、将来 Supabase へ移しやすくするために以下を守る。

- Prisma schema は SQLite 固有機能に寄せすぎない。
- DB アクセスは `src/lib/db` または `src/lib/prisma` に集約する。
- API は Route Handler として維持し、DB 実装を UI から直接参照しない。
- バックアップ処理は `src/lib/backup` に閉じ込め、DB ファイルコピー前提を画面やAPIに漏らさない。
- 日付、ID、タグ、Cue の仕様は SQLite / Postgres のどちらでも表現できる形にする。
- 将来 Vercel へ載せる場合に備え、Phase 2 で無料範囲を優先したアプリ側Basic認証相当を実装する。

### MVP でやらないこと

- Supabase 接続をMVPに含めない。
- Vercel deploy をMVP完成条件にしない。
- Supabase Auth / RLS をMVPに含めない。
- SQLite -> Postgres migration をMVPに含めない。

### Phase 2 で検討すること

- Vercel deploy
- アプリ側Basic認証相当の実装
- Supabase Postgres への移行
- Prisma の datasource を PostgreSQL 向けに変更する migration
- Supabase backup / export 方針
- Vercel 生成URL / production domain のアクセス制御
- 環境変数とシークレット管理

### Vercel URL と個人利用の注意点

Vercel にデプロイすると、アプリへアクセスするための URL は生成される。これは「個人利用目的かどうか」とは別の話で、URLを知っている人がアクセスできる状態になるか、認証が必要になるかは Deployment Protection やアプリ側認証の設計に依存する。

2026-06-15 時点の Vercel 公式ドキュメントでは、Hobby plan でも Vercel Authentication with Standard Protection は利用できるが、production domain は publicly accessible のままとされている。Standard Protection は production domains を除く deployments を保護する。All Deployments protection は production domain と generated URL を含む全URLを保護するが、Pro/Enterprise 側の機能として説明されている。

そのため、個人利用で Vercel に載せる場合の選択肢は以下になる。

| 選択肢 | 内容 | MVPでの扱い |
| --- | --- | --- |
| Vercelに載せない | ローカル利用のみ | MVP |
| Preview / generated URL を Vercel Authentication で守る | Vercelログイン前提でアクセス制限 | 無料範囲とproduction domain保護範囲を確認して判断 |
| production URL も含めて完全に守る | Vercelの有料保護機能、またはアプリ側認証を検討 | 無料範囲を超える可能性があるため優先しない |
| アプリ側Basic認証相当を実装する | Next.js middleware 等でID/パスワードを検証し、アプリ全体を保護する | Phase 2で採用する |

Manager 判断:

> Vercel deploy は「公開目的ではない」としてもURLが生成されるため、個人利用ならアクセス制御とセットでPhase 2にする。無料範囲を重視するため、まずはVercel有料保護機能ではなく、アプリ側Basic認証相当を実装する。

### Basic認証相当のPhase 2要件

Vercel deploy を行う段階では、以下を実装する。

- Next.js middleware 等で全ページとAPIを保護する。
- `BASIC_AUTH_USER` と `BASIC_AUTH_PASSWORD` を環境変数で管理する。
- 認証情報はリポジトリにコミットしない。
- ローカル開発では認証を無効化できる設定を用意する。
- Supabase移行後も、個人利用であればまず同じ保護方針を維持する。

MVPでは実装しないが、Vercel deploy の前提条件として扱う。

### SQLite のまま Vercel で使う場合の注意点

Vercel 上で、ローカル開発と同じように SQLite の DB ファイルを永続的に読み書きする構成は採用しない。

理由:

- Vercel はデプロイ環境であり、アプリの永続データは外部ストレージやマネージドDBに置く前提で設計するのが自然。
- Vercel 公式 Storage overview でも、永続データ用途として Blob、Edge Config、Marketplace Storage が案内され、Marketplace Storage では Supabase などのDBプロバイダ連携が示されている。
- SQLite ファイルをアプリに同梱しても、デプロイ後の書き込みを永続DBとして扱う設計は危険。
- 複数インスタンス、再デプロイ、実行環境の差により、ファイルDBの一貫性・永続性・バックアップ方針が不安定になる。

Vercel で SQLite 系の体験を維持したい場合の選択肢:

| 選択肢 | 内容 | 判断 |
| --- | --- | --- |
| SQLite ファイルをそのまま使う | アプリ内の `.db` ファイルを永続DBとして扱う | 採用しない |
| Supabase Postgres に移行 | Prisma の datasource を Postgres に変更する | Phase 2 有力候補 |
| SQLite互換の外部DBを使う | Turso / libSQL などのリモートSQLite系を検討する | Phase 2候補 |

Manager 判断:

> Vercel に載せる段階では、SQLite ファイルをそのまま使うのではなく、Supabase Postgres などの外部DBへ移行する。SQLite互換にこだわる場合は Turso / libSQL などを別途比較する。

### Supabase 以外のDB候補

Vercel deploy を Phase 2 で検討する場合、Supabase 以外にも以下を比較対象にする。

| 候補 | 種類 | 特徴 | 今回の相性 |
| --- | --- | --- | --- |
| Supabase | PostgreSQL | DB、Auth、Storage などをまとめて扱える | 有力候補 |
| Neon | Serverless PostgreSQL | Vercel/Prismaと相性がよいPostgres系。Free planあり | 有力候補 |
| Turso | libSQL / SQLite互換 | SQLiteに近い設計感を維持しやすい。Free planあり | SQLite互換を重視する場合の有力候補 |
| Cloudflare D1 | SQLite系 serverless DB | Cloudflare Workersとの統合が強い。Prisma対応も示されている | VercelよりCloudflare寄せにするなら候補 |
| PlanetScale | MySQL系 | Prisma対応DBとして扱えるが、今回の要件ではPostgres/SQLite系より優先度低め | 低優先 |

Manager 推奨:

1. Vercel + Postgres で進めるなら Supabase または Neon を比較する。
2. SQLite に近い体験を重視するなら Turso / libSQL を比較する。
3. Cloudflare Workers へ寄せるなら D1 を検討する。

今回のアプリでは、Prisma と Next.js Route Handler を維持しやすい **Supabase / Neon / Turso** を Phase 2 の主要比較候補にする。

結論:

> MVP はローカル SQLite で小さく作る。ただし、DBアクセスとバックアップ処理を局所化し、将来 Vercel + Supabase へ移せる余地を残す。

### Vercel公開時の実施手順

#### 適用範囲

この手順は、現行 MVP を直ちに変更するためのものではなく、Vercel で運用を開始する別タスクの実施順序を固定するためのものである。

- ローカル個人利用と現行 MVP は、これまでどおり SQLite のままでよい。Vercel 公開を行わない限り、Supabase / Postgres への移行は不要である。
- Vercel 上でノートの作成・編集・削除を永続利用する場合は、Vercel の実行環境へ SQLite ファイルを置くのではなく、Supabase に限らず Postgres などの外部永続 DB を用意する。
- Supabase は有力候補だが唯一の選択肢ではない。Neon などの Postgres、要件によっては Turso / libSQL なども比較対象に残す。以下は Supabase Postgres を第一候補にした場合の手順であり、接続方式・migration 手順・バックアップ方式は採用先に合わせて読み替える。
- 「Vercel へ表示確認だけ行う場合」と「Vercel で本番保存を行う場合」を分ける。表示確認だけなら、Preview でレイアウト、ビルド、認証境界を確認するための一時環境として扱い、実データの CRUD と永続性を保証しない。DB に依存する画面を表示する場合も、検証用の空 DB または使い捨ての検証データを使い、Vercel 上の SQLite ファイルを本番 DB とみなさない。本番保存を行う場合は、外部永続 DB、migration、バックアップ、アクセス制御をすべて完了条件に含める。

#### 現リポジトリ固有の移行阻害点

このリポジトリは、`DATABASE_URL` の値を Postgres URL に差し替えるだけでは移行できない。現行実装の SQLite 固定箇所と、公開時に別タスクで変更する箇所は次のとおりである。

| 現在の箇所 | 現行の前提 | 公開時に必要な対応 |
| --- | --- | --- |
| `prisma/schema.prisma` | `datasource db` の `provider = "sqlite"` | 選定した Postgres 用 provider と migration 方針へ変更する。既存のモデル、snake_case の table / column mapping、Canvas JSON 契約は別途変更理由がない限り維持する |
| `src/server/infrastructure/prisma.ts` | `PrismaBetterSqlite3` と `@prisma/adapter-better-sqlite3` を使う | Postgres に対応した Prisma の接続方式 / adapter へ置き換え、Vercel の runtime で接続を再利用できる構成にする |
| `config/project-env.js` | `file:` 形式だけを受け付け、未指定時は SQLite の `file:./dev.db` を使う | runtime 用 pooler URL と migration 用 URL を解決できるようにし、Vercel 本番で SQLite fallback が発生しないようにする |
| `prisma.config.ts` | `resolveDatabaseUrl()` から SQLite URL を受け取り Prisma CLI を動かす | migration 用接続を明示的に解決する。runtime 用と CLI / migration 用の接続を同じ URL に固定しない |
| `src/server/backup/infrastructure/local-sqlite-backup-provider.js` | SQLite ファイルのパス解決、`.db` コピー、ローカル prune が前提 | ファイルコピーではなく、Supabase の backup / export または採用先の Postgres backup provider へ再設計する |

したがって、移行時は Prisma schema、Prisma runtime、URL 解決、バックアップ実装をまとめて実装タスク化する。秘密情報を含む接続文字列をコード、Markdown、ログへ記載しない。

#### 実施順序

1. **公開目的、データ移行要否、アクセス制御を決める。**

   最初に、表示確認だけか、本番の CRUD と永続保存まで行うかを決める。既存の `dev.db` を持ち込むか、空の DB から始めるか、Preview と Production で DB を分けるかもここで決定する。個人ノートを扱うため、Vercel Deployment Protection で守れる範囲と、production domain を含めてアプリ側認証が必要かを、利用する Vercel plan とともに確認する。未認証の generated URL / Preview に実データを置かない。

2. **Supabase project と接続情報を準備する。**

   Supabase project、リージョン、Preview 用と Production 用の DB の分離方針を決め、アプリ runtime と Prisma migration に使う DB ユーザー / 接続情報を用意する。Vercel の serverless runtime からは接続数を抑えられる pooler 接続を使い、migration の作成・適用は direct 接続または Supabase が案内する migration 用接続を使う。runtime 用と migration 用を目的別に管理し、最小権限のユーザーとする。

   実装時の環境変数名は、既存コードを Postgres 対応に変更するタスクで確定する。値は次のようなプレースホルダーだけを使い、実際の URL やパスワードは記載しない。

   ```env
   DATABASE_URL="<supabase-runtime-pooler-url>"
   DIRECT_URL="<supabase-migration-connection-url>"
   ```

   `DIRECT_URL` は現行実装がそのまま認識する設定ではないため、`prisma.config.ts` と URL 解決処理を変更する実装タスクで、Prisma CLI が migration 用接続を使うことを確認する。pooler のモード、SSL、接続数、Prisma の adapter との互換性は、採用する Supabase 接続方式の公式手順に従う。

3. **Prisma datasource、adapter、URL 解決、バックアップを Postgres 対応にする。**

   次の変更を一つの設計・実装タスクとして行い、`DATABASE_URL` だけを変更して済ませない。

   - `prisma/schema.prisma` の datasource provider を Postgres 用に変更し、既存の model 名、`@map` / `@@map`、外部キー、Canvas の `documentJson` と `searchText` の保存契約を確認する。
   - `src/server/infrastructure/prisma.ts` から SQLite 専用の adapter と依存を外し、選定した Postgres の Prisma 接続方式へ変更する。Vercel の関数ごとに無制限な接続を作らない。
   - `config/project-env.js` は `file:` 以外の URL を拒否する実装を見直し、runtime 用 pooler URL と migration 用 URL を、環境ごとに明示的に解決する。本番で未設定時に `file:./dev.db` へ fallback しない。
   - `prisma.config.ts` は Prisma CLI の migration 用 URL を受け取るようにする。runtime の pooler URL と migration 用の接続 URL を同じ用途として扱わない。
   - `src/server/backup/infrastructure/local-sqlite-backup-provider.js` の `.db` ファイルコピー前提を公開環境へ持ち込まない。Supabase の backup / export、または採用した Postgres provider の backup API / `pg_dump` 相当を使う新しい provider と、復元手順・保持期間を別途設計する。

   この段階では既存の SQLite MVP、`dev.db`、Canvas JSON の内容を変更しない。変更は Vercel 公開用の別タスクとしてレビューする。

4. **migration を作成し、適用する。**

   Postgres 用 schema 変更後、まず検証用 DB で migration を作成し、生成された SQL と、既存の migration history との関係を確認する。schema migration はテーブル構造を作るものであり、`dev.db` の行データを自動で移すものではない。

   - `prisma migrate dev` は開発環境で migration を作成・検証するためだけに使う。Vercel の build command で `prisma migrate dev` を実行しない。build 中の対話、DB reset、migration 生成を本番デプロイに混ぜない。
   - migration SQL、provider、外部キー、日時型、unique / index、文字列として保持する Canvas JSON をレビューし、`prisma validate` と `prisma generate` を通す。
   - Production への適用は、承認済み migration を CI / release の明示的な手順で `prisma migrate deploy` 等により行う。Vercel build は Client 生成と Next.js build に限定し、migration 適用は DB と順序を管理できる別ステップにする。
   - destructive な変更を含む場合は、先に backup / export、復元確認、停止時間または段階的切替を決める。`prisma db push` を本番の migration 管理の代わりに使わない。

5. **既存 `dev.db` を移すか、空の DB から開始するかを分岐する。**

   **既存データを移行する場合**

   - 移行前に `dev.db` のバックアップを取得し、移行中のローカル書き込みを止める。ノート件数、Cue 件数、タグと中間テーブルの件数、日付範囲を記録する。
   - Postgres へ schema migration を適用した後、行データは別の one-off migration script / export-import 手順で移す。`DATABASE_URL` の差し替えや `prisma migrate dev` だけでデータ移行が完了したと判断しない。
   - `Notebook` の ID、日時、nullable 値、`bodyMode`、削除フラグ、Cue の順序、タグ関連、`NotebookCanvas.documentJson` と `searchText` を保持する。Canvas document の要素、`page.width` / `page.height`、`x` / `y` / `width` / `height` / `points` / `style` を変換・再生成しない。
   - まず検証用 DB へ移し、件数比較、代表ノートの CRUD、Canvas の閲覧・編集・再読込、検索、削除、PDF / export を確認する。元の `dev.db` とバックアップは、受け入れ完了まで読み取り専用で保管する。

   **空の DB から開始する場合**

   - 新しい Supabase DB に承認済み migration を適用し、既存の `dev.db` は移行せずローカル MVP 用として残す。
   - seed を必須にせず、検証用のノートを API / UI から作成して、作成・編集・閲覧・削除・検索・Canvas 復元を確認する。検証用データと本番データの接続先を分ける。

6. **Vercel 設定前にローカルで検証する。**

   Postgres 対応実装後、検証用 Postgres 接続を使い、少なくとも次を確認する。

   - `npm run lint`、`npm run build`、`npx prisma validate`、`npx prisma generate` が成功する。
   - CRUD の作成・編集・閲覧・削除と、再起動 / 再デプロイ後も保存内容が残ることを確認する。
   - Canvas の JSON、用紙サイズ、要素の geometry / style、text 要素の `searchText` が保存・閲覧・編集・再読込で一致することを確認する。タイトル、Cue、Summary、タグ、Canvas text の検索も確認する。
   - 現行 MVP の物理削除契約を維持した削除結果と、削除後の一覧・詳細 API の応答を確認する。Phase 2 の soft-delete / Undo をこの移行手順で追加しない。
   - 公開対象に PDF / export が含まれる場合は、Playwright / Chromium の起動、1 ノート 1 ページの生成、タイムアウト、失敗時のエラー応答を確認する。現行 MVP で未実装の機能を、移行完了のために追加しない。
   - Postgres の backup / export と復元の手順を検証する。ローカル SQLite の `backup/` コピーだけを公開環境の復旧確認とみなさない。

7. **GitHub へ push し、Vercel project を設定する。**

   migration 実装と検証結果をレビュー可能な commit として GitHub へ push し、Vercel で対象 repository を Import する。Vercel の Project Settings は、少なくとも次を明示する。

   - **Root Directory**: Next.js アプリが置かれたディレクトリ。monorepo 化していない現状は repository root を基本とする。
   - **Install Command**: lockfile に対応した再現可能な install（`package-lock.json` を使う場合は `npm ci` を基本とする）。
   - **Build Command**: Prisma Client 生成と Next.js build を行うコマンド（例: `npm run prisma:generate && npm run build`）。実装後の package script に合わせて確定し、`prisma migrate dev` は含めない。
   - **Output / Framework**: Next.js の自動判定を基本とし、不要な custom output を追加しない。

   Preview と Production は別環境変数として登録する。少なくとも runtime 用 `DATABASE_URL`、migration 実行主体だけが使う `DIRECT_URL` 相当の値、選択したアプリ側認証の秘密情報を環境ごとに分ける。Preview から Production DB へ接続させず、Vercel の画面で Secret として登録し、リポジトリ・`.env` の共有・build log へ出力しない。

8. **Preview で runtime を確認してから Production へ昇格する。**

   Preview deploy では、build log に SQLite adapter、`file:` fallback、migration 実行が残っていないことを確認し、検証用 DB に対して認証、CRUD、Canvas 保存・復元、検索、削除、対象なら PDF / export を確認する。Preview の再デプロイ後にも同じデータが外部 DB から読めることを確認する。

   Preview の受け入れ後に、Production 用環境変数と DB を再確認し、承認済み migration を Production DB へ適用してから Production deployment を有効化する。Production へは Preview の検証結果と、データ移行を行った場合の件数・代表データの照合結果を添付する。

9. **個人ノートを保護する。**

   Vercel Deployment Protection を Preview / generated URL に適用し、利用する plan で production domain まで保護できるかを確認する。Production domain が対象外なら、Next.js middleware 等によるアプリ側認証をページと API の両方へ実装する。認証ユーザー名・パスワードは環境変数で管理し、未認証の API が CRUD や検索結果を返さないこと、認証情報やノート本文をログへ出さないことを確認する。保護方式が未決定のまま本番データを載せない。

#### Vercel公開後に再設計が必要な項目

| 項目 | SQLite MVP の前提 | 公開後に必要な再設計・確認 |
| --- | --- | --- |
| SQLite ファイルバックアップ | `local-sqlite-backup-provider.js` が `.db` を `backup/` へコピーする | Supabase / Postgres の backup、export、保持期間、復元テスト、障害時の切替手順を定義する。Vercel filesystem や repository 内の `.db` をバックアップ先にしない |
| PDF の Chromium 実行 | ローカル Node で Playwright / Chromium を起動できる | Vercel runtime の実行時間、binary / bundle 制約、メモリ、同時実行数を確認する。起動できない場合は、クライアント印刷、専用 worker、外部ジョブ等へ切り出す再設計を行う |
| 環境変数 | `file:./dev.db` fallback とローカル `.env` を使う | Preview / Production、runtime / migration の値を分離し、権限、secret rotation、漏えい時の無効化、ログへの非出力を運用化する |
| ログ・障害時の復旧 | ローカル画面 / CLI のエラー表示と手動 DB コピーが中心 | Vercel function log と DB 側のログ、migration 失敗、接続枯渇、PDF 失敗、復元実績を追跡できるようにし、停止・復旧・rollback / forward-fix の runbook を用意する |

#### 公式参照リンク

- [Vercel: Is SQLite supported in Vercel?](https://vercel.com/kb/guide/is-sqlite-supported-in-vercel)
- [Vercel Git integration](https://vercel.com/docs/git)
- [Vercel build configuration](https://vercel.com/docs/builds/configure-a-build)
- [Vercel environment variables](https://vercel.com/docs/environment-variables)
- [Vercel Deployment Protection](https://vercel.com/docs/deployment-protection)
- [Supabase: Connect to Postgres with Prisma](https://supabase.com/docs/guides/database/prisma)
- [Supabase: Connecting to Postgres](https://supabase.com/docs/guides/database/connecting-to-postgres)

#### 完了条件

- 公開目的、データ移行要否、Preview / Production の DB、アクセス制御方式が決定され、秘密情報を含まない手順と設定がレビュー済みである。
- Postgres 用 Prisma provider / adapter、URL 解決、migration、backup / export が実装され、SQLite 固定実装を `DATABASE_URL` の差し替えだけで済ませていない。
- 検証用 DB と Production DB に承認済み migration が適用され、既存データを移行した場合は件数・代表ノート・Canvas JSON・検索結果が照合済みである。空 DB 開始の場合は CRUD の smoke test が完了している。
- `lint`、`build`、`prisma validate`、CRUD、Canvas 復元、削除、検索、対象機能の PDF / export、backup / restore が確認済みである。
- Preview の runtime 確認後に Production を有効化し、再デプロイ後も外部 DB のデータが残り、未認証アクセスから個人ノートと API が保護されている。

#### ロールバック / 失敗時の戻し方

- 表示確認または Preview で失敗した場合は Production へ昇格せず、最後に正常だった Vercel deployment を維持する。現行のローカル SQLite MVP と `dev.db` は変更せず、検証用 DB の問題と切り分ける。
- migration 適用前の build / deploy 失敗は、migration を適用せずにデプロイを止める。Production DB に migration を適用した後は、旧アプリへ戻せるのは schema が後方互換の場合だけとし、非互換なら backup / restore または forward-fix を選ぶ。migration SQL を手動で逆編集して戻さない。
- 既存 `dev.db` のデータ移行に失敗した場合は、本番切替を行わず、元の `dev.db` と移行前 backup を保持したまま検証用 DB で再実行する。移行先のデータを破棄する操作は対象と backup を確認してから別途承認する。
- Production で障害が起きた場合は書き込みを止め、Vercel / DB のログと backup / export を保全する。最後の正常 deployment へ戻す、Supabase の復元手順を実行する、接続情報をローテーションする、の順で影響範囲を確認する。復旧後に CRUD、Canvas 復元、検索、削除を再確認してから公開を再開する。

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

MVP では以下の負担が大きくなります。

- Next.js と Rust API の 2 プロセス構成になる。
- 開発サーバー起動、環境変数、ポート、CORS、ログの扱いが増える。
- Prisma を TypeScript 側で使う場合、Rust API と DB アクセス層が分断される。
- Rust 側で SQLx などを採用する場合、Prisma schema との二重管理が発生する。
- API 型定義を TypeScript / Rust 間で共有する仕組みが必要になる。
- Worker タスクが frontend / TypeScript API / Rust API に分かれ、実装・検証コストが増える。
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

以下が出てきた場合は、Rust API または Rust 製補助プロセスを Phase 2 で再検討します。

- Markdown 解析、全文検索、PDF/HTML変換など重い処理を常時行う。
- SQLite 以外の DB や複数プロセス運用へ移行する。
- API を Next.js から独立させたい。
- ローカル常駐アプリ、CLI、デスクトップアプリ化を検討する。
- バックアップ、インポート、エクスポート、インデックス生成などを高速なバイナリで扱いたい。

結論:

> MVP の API は TypeScript / Next.js Route Handler で実装する。Rust API は Phase 2 の検討事項とする。

## 重要な判断

### Markdown 入力は最初から高機能エディタに寄せない

MVP では、ノート本文は 1 つの Markdown 本文です。入力体験は重要ですが、エディタライブラリに強く依存するとフルリニューアル直後の保守範囲が増えます。

MVP では `textarea + preview` で進め、Markdown 専用エディタライブラリは Phase 2 要件として扱います（発注者承認済み）。

そのため、MVP では以下を優先します。

- textarea で Markdown を入力できる
- 横または縦に Markdown プレビューを表示できる
- サマリーも同じ仕組みで扱う
- チェックリストなどの GFM は表示側で対応する

高機能な Markdown エディタ、ツールバー、ショートカット拡張は Phase 2 候補とします。

### UI コンポーネントライブラリは必須にしない

MVP は画面数が少なく、フォーム、タブ、ボタン、一覧、確認ダイアログが中心です。最初から大きな UI ライブラリを入れるより、Tailwind と小さなローカルコンポーネントで始めます。

必要になった場合のみ、Headless UI や Radix UI などを検討します。

### SQLite + Prisma を維持する

このアプリはローカル個人利用です。サーバー運用、複数ユーザー、外部DB接続を前提にしないため、MVP では SQLite が適しています。

Prisma は型安全な DB アクセスと migration 管理に使います。

## MVP DB / Prisma 運用設計

### 対象 schema

MVP の Prisma schema 対象は `doc/data/MVP_DATA_DESIGN.md` の 4 モデルに限定します。

| Model | MVP での扱い |
| --- | --- |
| `Notebook` | ノート本体。`body` は 1 つの Markdown 本文として保存する |
| `Cue` | 左欄の Cue / キーワード / 質問。`Notebook` に従属する |
| `Tag` | タグ候補マスタ。`name` は unique |
| `NotebookTag` | Notebook と Tag の中間テーブル |

MVP 外として schema に混ぜないもの:

- `NotebookDraftState`
- `NotebookReviewProgress`
- `SoftDeleteBuffer`
- `BackupLog`
- `CueCard`
- `NoteCard`
- `NoteCueLink`

### SQLite DB ファイルと環境変数

MVP は SQLite file URL だけをサポートします。

| 項目 | 方針 |
| --- | --- |
| 環境変数 | `DATABASE_URL` |
| URL 形式 | `file:` で始まる SQLite path |
| `.env.example` | `DATABASE_URL="file:./prisma/dev.db"` |
| 実行時 fallback | `src/lib/prisma.ts` と `src/lib/backup/index.js` は未指定時に `file:./dev.db` を使う |
| Prisma CLI fallback | `prisma.config.ts` は未指定時に `file:./dev.db` を使う |

README 化時の推奨:

- 新規環境では `.env.example` を元に `.env` を作り、`DATABASE_URL="file:./prisma/dev.db"` を明示する。
- `.env` を作らない場合は `file:./dev.db` fallback で動くが、DB ファイル位置が README と実行時で誤解されやすいため、MVP 手順では `.env` 明示を推奨する。
- `DATABASE_URL` に `postgres://` など SQLite 以外を指定しない。Supabase / Postgres は Phase 2 の移行検討事項とする。

### Prisma migrate / generate 手順

初回セットアップ:

```bash
npm install
cp .env.example .env
npm run prisma:generate
npm run prisma:migrate
```

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
- `Cue` と `NotebookTag` は外部キー cascade で削除する。
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

### 実装単位

現行のバックアップ処理は CommonJS helper と Node script に分けます。

| ファイル | 役割 |
| --- | --- |
| `src/lib/backup/index.js` | `DATABASE_URL` 解決、コピー、一覧、3 世代 prune |
| `scripts/backup-copy.js` | CLI から `createBackup` を実行する wrapper |
| `package.json` | `npm run backup:copy` で CLI 実行 |

`src/lib/backup/index.js` は `DATABASE_URL` が `file:` 形式でない場合や DB ファイルが存在しない場合に `BackupError` を投げます。API はこの失敗を `{ code, message, errors? }` 形式の server error として返します。

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

### README へ後で書く材料

README 更新タスクでは、少なくとも以下を記載します。

1. `.env.example` から `.env` を作る。
2. `DATABASE_URL="file:./prisma/dev.db"` を使う。
3. `npm install` を実行する。
4. `npm run prisma:generate` を実行する。
5. `npm run prisma:migrate` を実行する。
6. seed は MVP では不要と明記する。
7. `npm run dev` で起動する。
8. `/notes` で作成、検索、閲覧、編集、復習を確認する。
9. `/backup` または `npm run backup:copy` で DB バックアップを作成する。
10. `backup/` は最新 3 世代のみ保持し、復元は手動運用であることを明記する。

### Server Actions はMVPでは必須にしない

API 設計を明示しているため、MVP では Route Handler ベースの API を採用します。

理由:

- Worker タスクに分割しやすい
- API テスト観点が明確
- 画面と保存処理の境界がわかりやすい

Server Actions は、フォーム実装を簡略化したくなった段階で検討します。

## ディレクトリ方針

```text
src/
  app/
    notes/
      page.tsx
      new/page.tsx
      [id]/page.tsx
      _components/
    backup/
      page.tsx
    api/
      notes/
      tags/
      backups/
  components/
    ui/
  lib/
    db/
    validation/
    markdown/
    backup/
prisma/
  schema.prisma
scripts/
  backup-copy.js
```

## MVP で追加しない依存

| 依存候補 | MVPで外す理由 |
| --- | --- |
| D&D ライブラリ | Cue は単純な上下移動または作成順で足りる |
| PDF / Playwright | PDF 出力は Phase 2 |
| 高機能 Markdown エディタ | textarea + preview で開始し、Phase 2 で必要に応じて導入する |
| 状態管理ライブラリ | React state と URL query で足りる |
| 認証ライブラリ | ローカル個人利用で認証なし |
| 通知・スケジューラ | 高度な復習タスクは Phase 2 |
| Rust API サーバー | MVP では TypeScript API に統一し、Phase 2 で必要に応じて検討 |

## 実装時の検証コマンド

MVP 実装では、少なくとも以下を実行します。

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
| Q-001 | Markdown 入力は MVP では textarea + preview でよいか | はい（発注者承認済み） |
| Q-002 | UI ライブラリは MVP では入れず、Tailwind とローカルコンポーネントでよいか | はい |
| Q-003 | Route Handler API を採用し、Server Actions は MVP 外でよいか | はい |
| Q-004 | バックアップスクリプトは TypeScript ではなく Node.js script でもよいか | はい |
| Q-005 | Rust API は MVP では採用せず、Phase 2 検討事項でよいか | はい |

## 次に決めること

発注者確認後、この技術方針を元に Worker 向け実装タスクへ分割する。
