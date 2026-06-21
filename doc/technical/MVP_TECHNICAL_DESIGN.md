# MVP 技術選定・実装方針

確認日: 2026-06-15

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
  backup-copy.ts
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
