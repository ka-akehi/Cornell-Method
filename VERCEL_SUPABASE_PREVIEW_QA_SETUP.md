# Vercel Preview / Supabase QA セットアップ手順

この文書は、Cornell Method Notebook の Preview / QA 環境を、Supabase
Postgres と Vercel Preview で安全に準備するための operator 向け手順書です。
現行の Local MVP は SQLite のまま維持し、Preview 用の検証 DB と Production 用の
DB を混在させません。

接続 URL、パスワード、Basic Auth の実値はこの文書、Git、チャット、summary、ログへ
書きません。以下の `<...>` は、Dashboard、secret manager、または実行時の shell で
置き換える placeholder です。

## 1. 目的と対象環境

この手順の対象は、発注者が作成済み、または新規作成する Preview / QA 用の Supabase
Project と、その DB を使う Vercel Preview です。目的は、Preview の server-side
Prisma runtime、SQLite からの一度限りの import、再起動・再デプロイ後の永続性を、
Production に触れずに確認することです。

| 環境         | DB / 接続                                                   | 用途                                              | この手順での扱い                                                     |
| ------------ | ----------------------------------------------------------- | ------------------------------------------------- | -------------------------------------------------------------------- |
| Local        | SQLite。`DATABASE_URL` は `file:` URL                       | 個人利用、開発、source SQLite の作成              | 既存の Local MVP として維持。アプリ停止後に frozen source として読む |
| Preview / QA | 専用 Supabase Project。Vercel runtime は shared transaction-mode pooler | Preview の CRUD、検索、Canvas、削除、永続性の検証 | この手順の対象。環境ラベルは `verification` とする                   |
| Production   | Production 用に別管理する DB / secret                       | 本番運用                                          | この手順の対象外。実値を記載せず、QA から接続しない                  |

この文書は、Postgres 対応の Prisma schema、runtime、URL 解決、migration、backup
設計が承認済みであることを前提にします。`DATABASE_URL` だけを Postgres URL に
差し替えれば公開できる、という意味ではありません。実装上の移行境界は
[`doc/technical/MVP_TECHNICAL_DESIGN.md`](doc/technical/MVP_TECHNICAL_DESIGN.md) を
参照してください。

### 接続の原則

- Supabase Data API は使わず、Next.js の server-side Prisma 接続だけを使う。
- Vercel Preview の runtime は、Supabase Connect の **ORM → Prisma** に表示される
  `DATABASE_URL`、すなわち shared transaction-mode pooler の URL を使う。
- migration、import、reconcile は、同じ **ORM → Prisma** 画面に表示される
  `DIRECT_URL`、すなわち shared session-mode pooler の URL を operator 環境で使う。
- `DIRECT_URL` という変数名は Supabase の **Direct Connection** を意味しない。この
  repository では、transaction pooler ではない operator 用の接続を指す。
- `DIRECT_URL` は Vercel runtime に登録しない。
- QA Project / DB と Production Project / DB を同じ URL、同じ secret、同じ target
  label で運用しない。

## 2. Supabase Project 作成時の設定

Supabase Dashboard で Preview / QA 用 Project を作成するとき、次の 3 設定はすべて
**OFF** にします。

| Supabase の設定                  | 推奨値  | 理由                                                                                                                   |
| -------------------------------- | ------- | ---------------------------------------------------------------------------------------------------------------------- |
| データ APIを有効にする           | **OFF** | アプリは Supabase Data API ではなく、Next.js server-side Prisma から DB に接続するため                                 |
| 新しいテーブルを自動的に公開する | **OFF** | テーブルを Data API の公開対象へ自動追加しないため                                                                     |
| 自動 RLS を有効にする            | **OFF** | この構成のアクセス境界は Vercel の server-side Prisma と Basic Auth で管理し、RLS の自動設定を今回の移行に混ぜないため |

この設定は、テーブルをブラウザから直接公開することを意味しません。将来 RLS を
導入する場合は、使用する DB role、policy、Prisma の接続方式を別途設計・レビュー
してください。設定後に Dashboard で 3 項目がすべて OFF になっていることを確認し、
Project ref を実値として operator 環境だけに記録します。

## 3. Supabase Connect の ORM → Prisma から URL を取得する

Supabase Dashboard の対象 Project で **Connect → ORM → Prisma** を開き、表示された
`DATABASE_URL` と `DIRECT_URL` を用途ごとに分けます。画面上の接続説明は次の対応です。
URL の実値はこの文書へ転記しません。

| ORM → Prisma 画面の表示 | 通常の Port | 設定先 | 用途 |
| ----------------------- | -----------: | ------ | ---- |
| `DATABASE_URL` — **Connect to Postgres via the shared transaction-mode pooler** | `6543` | Vercel Preview の `DATABASE_URL` | Next.js Preview runtime の DB 接続 |
| `DIRECT_URL` — **Connect to Postgres via the shared session-mode pooler** | `5432` | ローカル operator 環境の `DIRECT_URL` | Prisma migration、SQLite import、reconcile |

この repository では、画面の Step 1 / Step 2 にある generic な Prisma 初期化手順を
実行しません。既存の Prisma 設定、`prisma/schema.prisma`、migration があるため、
`npm install prisma --save-dev`、`npx prisma init`、generic な `.env.local` 例の
コピー、generic な `prisma/schema.prisma` の上書きは不要であり、実行禁止です。
この手順の後続にある Preview 用と operator 用の設定例・command sequence を使います。

確認事項:

- `DATABASE_URL` は ORM → Prisma の shared transaction-mode pooler（通常 port
  `6543`）とし、別画面の Direct Connection URL や `DIRECT_URL` の値を入れない。
- `DIRECT_URL` は ORM → Prisma の shared session-mode pooler（通常 port `5432`）を
  主手順とする。port `6543` または `pgbouncer=true` の transaction pooler は
  `DIRECT_URL` に使わない。
- 別画面で取得できる Direct Connection URL が migration-compatible な場合は、
  operator 用 `DIRECT_URL` の選択肢にしてよい。ただし発注者が見る ORM → Prisma の
  shared session-mode pooler を主手順とする。
- `DIRECT_URL` と `DATABASE_URL` は同じ値にしない。
- Dashboard が案内する SSL、接続 mode、ユーザー名、パスワードをそのまま確認し、
  URL をログや shell history に不用意に残さない。
- operator 用 URL の IPv6 到達性が operator のネットワークで確保できない場合は、
  後述の失敗時の扱いに従って停止する。migration/import を transaction pooler URL
  へ切り替えて続行しない。

## 4. Vercel Project の作成

### 4.1 プロジェクト未作成の Overview から開始

発注者が確認した Vercel の team / workspace Overview のように、左側の「プロジェクト」
が選択され、プロジェクト一覧が空で「最初のプロジェクトをデプロイする」と表示されて
いる状態から始めます。

- この画面は team / workspace の Overview であり、まだ Project Settings ではない。
  ここではこのアプリ専用の Project-specific Environment Variables を登録できない。
- 左側のチーム全体の「環境変数」は、チーム共通の設定を管理する画面である。この
  アプリ専用の DB URL、Basic Auth password、その他の秘密を登録する場所として使わない。
- 右上の「新規追加」または中央の「輸入プロジェクト」カードの「輸入」を選び、Git
  repository の import を開始する。

Project 作成前の Overview で環境変数を探し続けず、まず repository import を完了して
Project を作成します。Project-specific な設定は、次の節の **Project → Settings** から
行います。

### 4.2 Git repository の import

import 画面では、GitHub 等の Git provider を接続し、Cornell Method Notebook の
repository **`ka-akehi/Cornell-Method`** を選択します。接続先と repository 名を確認
してから Project 作成を進めます。

初回の Project 設定では、少なくとも次を確認します。

- Framework は Vercel が検出した **Next.js** を採用する。
- Root Directory は repository root にする。アプリを別のサブディレクトリとして指定
  しない。
- Build command は既存の `package.json` が使う **`npm run build`** を採用する。
- Build command や install / build の設定へ migration、import、reconcile、`db push`
  を追加しない。これらは Vercel build から起動せず、operator の明示的な手順で行う。

Project 作成画面または作成直後の Git 設定で、branch の境界も確認します。

- **`main` は Production Branch** として扱う。`main` への push / merge は Production
  deployment になり得る。
- QA は `main` 以外の既存 branch、またはその branch から作成した pull request の
  Preview deployment で行う。Preview の対象 branch / PR が Production Branch では
  ないことを確認する。
- Vercel の画面で Preview branch を選択・確認する項目が表示された場合は、QA 用の
  non-main branch を対象にする。`main` を QA 用 Preview として扱わない。
- QA では Production DB、Production の `DATABASE_URL`、Production secret を使わない。
  Preview 用の Supabase Project / DB と Preview 専用 Basic Auth を使う。
- QA 用の Preview branch が repository にまだ存在しない場合、この手順書では branch を
  作成しない。先に repository 側で別途 branch を作成し、その後に Vercel で Preview
  deployment を作成する。

### 4.3 Project 作成直後の Production への注意

Project 作成直後に Vercel が `main` の deployment を作成し、Production deployment と
して扱う場合があります。これは QA が完了したことを意味しません。

- Project 作成直後は Production scope の環境変数を設定せず、Production DB に接続
  しない。
- `main` の deployment が存在しても、Preview QA の確認対象は non-main branch / PR の
  Preview deployment に限定する。
- Production は Preview QA が PASS になった後、接続先、secret、migration、rollback
  を分離した別手順で扱う。

## 5. Vercel Preview の環境変数

Project が作成された後、Vercel Dashboard の **Project → Settings → Environment
Variables** を開きます。ここが、このアプリの Project-specific Environment Variables
を登録する場所です。左側の team / workspace 共通「環境変数」画面と混同しないでください。

Environment は **Preview** を選び、対象 branch の Preview deployment に適用されることを
確認してから、次の変数を登録します。Production scope はこの手順では登録・変更しません。

```env
DATABASE_URL="<shared-transaction-pooler-url>"
BASIC_AUTH_ENABLED=true
BASIC_AUTH_USER="<preview-basic-auth-user>"
BASIC_AUTH_PASSWORD="<preview-basic-auth-password>"
```

登録ルール:

- `DATABASE_URL` は Supabase **Connect → ORM → Prisma** に表示される shared
  transaction-mode pooler の URL（通常 port `6543`）を使う。
- `BASIC_AUTH_ENABLED=true` とし、未認証の Preview page / API を拒否できる状態に
  する。
- `BASIC_AUTH_USER` と `BASIC_AUTH_PASSWORD` は Preview 専用の値を使う。
- `DATABASE_URL` と `BASIC_AUTH_PASSWORD` は Vercel の Sensitive / Secret 扱いで保存
  する。特に DB URL、Basic Auth password の実値を build log、deployment log、README、
  Git、チャットへ出さない。
- `DIRECT_URL` は Vercel に登録しない。これは Supabase Connect → ORM → Prisma の
  shared session-mode pooler を使う operator 専用の接続である。
- `POSTGRES_TARGET_PROJECT`、`POSTGRES_TARGET_ENVIRONMENT`、
  `POSTGRES_TARGET_ALLOWLIST`、`SOURCE_SQLITE_PATH` も Vercel に登録しない。これらは
  operator の migration / import / reconcile だけで使う。
- 保存後は既存 deployment に自動反映されないことがあるため、対象 Preview branch を
  指定して再デプロイする。再デプロイ後に、新しい環境変数がその deployment に適用
  されたことを確認する。

### 5.1 Vercel CLI（任意）

Dashboard の代わりに CLI を使う場合は、先に対象 Project を `vercel link` で link して
から、Preview scope を明示して環境変数を追加します。

```bash
vercel link
vercel env add NAME preview
```

`vercel env add NAME preview` は `NAME` を `DATABASE_URL`、`BASIC_AUTH_ENABLED`、
`BASIC_AUTH_USER`、`BASIC_AUTH_PASSWORD` に置き換えて、各値を対話的に登録する例です。
secret の実値を command history、ターミナルログ、CI / Vercel log、Git に出さないで
ください。値をコマンドライン引数へ直書きしないでください。

`vercel env pull` を使う場合は取得先を未追跡でアクセス制御されたローカルファイルに
限定し、追跡対象の `.env` や summary へ出力しません。`vercel env run` を使う場合は
環境変数を process injection として一時的に渡す用途に限定し、値をファイル、ログ、
shell history に残さないでください。どちらも実値を repository に保存するためには
使いません。

## 6. operator 環境の秘密情報と変数

operator の作業環境では、次のいずれかで秘密情報を注入します。

- 未追跡でアクセス制御された `.env`
- secret manager の一時的な process injection
- shell variable または one-shot command の環境変数

`.env` を使う場合も、実値が Git の追跡対象でないことを作業前に確認します。どの方式
でも、実値をチャット、Git、README、summary、command output、ログへ書きません。
`set -x`、`env`、`printenv` などで secret を出力しないでください。

operator で使う値の対応は次のとおりです。これは実行前の placeholder 例であり、
実値をこのファイルへ追記しません。

```env
DATABASE_URL="<shared-transaction-pooler-url>"
DIRECT_URL="<shared-session-pooler-url>"
POSTGRES_TARGET_PROJECT="<project-ref>"
POSTGRES_TARGET_ENVIRONMENT=verification
POSTGRES_TARGET_ALLOWLIST="<project-ref>:verification"
SOURCE_SQLITE_PATH="<absolute-path-to-frozen-dev-db>"
```

特に次を守ります。

- `POSTGRES_TARGET_PROJECT` は Dashboard で確認した QA / verification Project ref
  と一致させる。
- `POSTGRES_TARGET_ENVIRONMENT` は QA import の例では必ず `verification` とする。
- `POSTGRES_TARGET_ALLOWLIST` は `<project-ref>:verification` の完全一致にする。
- `SOURCE_SQLITE_PATH` はアプリ停止後に固定した SQLite ファイルの絶対パスを指定する。
  `file:` URL、相対パス、暗黙の `dev.db` fallback は使わない。
- operator の import / reconcile は `DATABASE_URL` ではなく `DIRECT_URL` を使う。
  `DATABASE_URL` と `DIRECT_URL` は同じ値にしない。
- `POSTGRES_TARGET_*` と `SOURCE_SQLITE_PATH` は Vercel の Preview runtime に渡さない。

## 7. source freeze と事前確認

source SQLite は、読み取り中に書き換わらない snapshot として扱います。次の確認が
終わるまで target への migration や import を開始しません。

1. Next.js 開発サーバー、worker、バックグラウンドの書き込み処理を停止する。
   ノートの作成・編集・削除を行わない。
2. `SOURCE_SQLITE_PATH` に、凍結した source SQLite の**絶対パス**を明示する。
   アプリの既定 DBへ暗黙に fallback させない。
3. source と同じ場所にある `<source>-wal` と `<source>-shm` の sidecar が存在しない
   ことを確認する。存在する場合は削除で済ませず、source の一貫性を確認できる方法を
   operator が決めるまで停止する。
4. source の Prisma migration state が完了状態であること、ファイルを読み取れること、
   source が作業中に変更されていないことを確認する。
5. Supabase Dashboard の Project ref が QA / verification 用であり、Production
   Project でないことを二重確認する。target の application rows が空であることも
   確認する。空でない場合は import を開始しない。
6. `DIRECT_URL` が ORM → Prisma の shared session-mode pooler（通常 port `5432`）で
   あり、transaction pooler でないことを確認する。接続先の Project ref と operator の
   target label が一致することも確認する。

### source dry-run

最初の source gate として、次を実行します。`--dry-run` は source の schema、件数、
Canvas の inventory、hash を読むだけで、Postgres target へ接続せず、target を変更
しません。

```bash
SOURCE_SQLITE_PATH="<absolute-path-to-frozen-dev-db>" \
npm run postgres:import -- --dry-run
```

成功しても source の本文、タイトル、タグ名、Cue text、Canvas text をログへ出さない
運用を続けます。source の hash が変わった、sidecar が出現した、schema / foreign key
が不正だった場合は、import を行わず source freeze からやり直します。

## 8. migration / import / reconcile の実行順

source dry-run が成功し、QA target が空で Production でないことを確認した後、
target 操作を開始します。作業全体の安全な順序は次のとおりです。

> source dry-run → baseline migration → import → reconcile

`postgres:import -- --dry-run` は target を変更しないため、下記の target 操作列でも
baseline 前後の最終確認として再実行できます。source freeze の最初の dry-run を
省略しないでください。指定された npm script の実行順は、baseline、import dry-run、
import、reconcile として記録します。

### 8.1 baseline migration

ORM → Prisma の shared session-mode pooler を使った `DIRECT_URL` のみで、承認済み
Prisma migration を QA target に適用します。

```bash
DIRECT_URL="<shared-session-pooler-url>" \
npm run prisma:migrate:postgres
```

この段階で migration が失敗した場合、Preview deploy や import へ進みません。migration
の作成・適用を Vercel build に混ぜず、operator の明示的な実行として扱います。

### 8.2 import の dry-run（最終 no-write gate）

baseline 後に source が変わっていないことを再確認するため、必要に応じて同じ frozen
source を dry-run します。これは source の再読だけで、Postgres target への接続・書き込み
を行いません。

```bash
SOURCE_SQLITE_PATH="<absolute-path-to-frozen-dev-db>" \
npm run postgres:import -- --dry-run
```

### 8.3 実 import

次の target variables は QA 用の完全一致 allowlist で指定します。import は baseline
済みで application rows が空の target だけを受け付けます。実行中の transaction 内で
source hash、target empty、import 前後の reconciliation を確認します。

```bash
DIRECT_URL="<shared-session-pooler-url>" \
POSTGRES_TARGET_PROJECT="<project-ref>" \
POSTGRES_TARGET_ENVIRONMENT=verification \
POSTGRES_TARGET_ALLOWLIST="<project-ref>:verification" \
SOURCE_SQLITE_PATH="<absolute-path-to-frozen-dev-db>" \
npm run postgres:import
```

成功 JSON と終了 code を確認するまで、import 完了とは扱いません。既存行を無条件に
上書きする処理ではなく、空 target に一度だけ投入する operator workflow です。

### 8.4 read-only reconcile

import が成功した後、同じ frozen source と同じ QA target を、operator の
`DIRECT_URL`（shared session-mode pooler）で read-only 照合します。

```bash
DIRECT_URL="<shared-session-pooler-url>" \
POSTGRES_TARGET_PROJECT="<project-ref>" \
POSTGRES_TARGET_ENVIRONMENT=verification \
POSTGRES_TARGET_ALLOWLIST="<project-ref>:verification" \
SOURCE_SQLITE_PATH="<absolute-path-to-frozen-dev-db>" \
npm run postgres:reconcile
```

少なくとも row count、ID set、parent ID / foreign key、scalar 値、UTC 日時、Canvas
`document_json` の hash / deep equality、`page.width` / `page.height`、element の
geometry / points / style / text、`search_text` が一致していることを確認します。
reconcile は read-only で、target row を修正しません。不一致または非 0 exit code
なら QA import は未完了です。

### 禁止する実行

- `db push` を migration の代わりに使わない。
- `DATABASE_URL`（shared transaction-mode pooler）へ migration、import、reconcile を
  実行しない。
- Vercel Preview の build、request、route handler から migration / import / reconcile
  を起動しない。
- Production label、Production Project、Production secret をこの QA workflow の
  target にしない。
- 既存 rows を無条件に上書きしない。空でない target に import を再実行しない。

## 9. Preview deploy と QA 確認

### deploy 前

- 対象 branch の Vercel Preview に、Preview scope の `DATABASE_URL`、
  `BASIC_AUTH_ENABLED`、`BASIC_AUTH_USER`、`BASIC_AUTH_PASSWORD` が適用されることを
  Dashboard で確認する。
- `DIRECT_URL`、`POSTGRES_TARGET_*`、`SOURCE_SQLITE_PATH` が Vercel にないことを
  確認する。
- build は Prisma Client の generate と Next.js build のみとする。`npm run build`
  の承認済み設定に migration、import、reconcile、`db push` が含まれていないことを
  build command とログで確認する。
- build log、deployment log、runtime log に URL、password、Basic Auth 実値、ノート
  本文が出ていないことを確認する。

### Preview の QA 項目

1. **Project / branch / URL**
   - Vercel Project に対象 non-main branch または pull request の deployment が存在する。
   - Preview URL の deployment detail が、QA 対象の branch / pull request を指している。
   - Preview URL を `main` の Production deployment と取り違えていない。
   - この deployment の build log に migration、import、reconcile、`db push` がない。
2. **Basic Auth**
   - 未認証の page と API が拒否される。
   - 正しい Preview 専用 credentials で page と API にアクセスできる。
   - 失敗した credentials、空の credentials、認証情報を含まない request が QA DB の
     データを返さない。
3. **CRUD と物理削除**
   - ノートを作成、一覧取得、詳細取得、編集、保存、再読込できる。
   - 現行 MVP の契約どおり、確認後の削除は physical delete である。
   - 削除後は詳細取得で存在せず、一覧・検索にも残らない。Phase 2 の soft-delete / Undo
     をこの手順に追加しない。
4. **Canvas の保存と検索**
   - Canvas JSON が保存・復元でき、`page.width` / `page.height` が用紙寸法として
     保持される。
   - 用紙サイズ変更で既存 element の `x`、`y`、`width`、`height`、`points`、`style`
     が自動変形・削除されない。
   - Canvas の text element が `searchText` / `search_text` に反映され、一覧の検索で
     見つかる。用紙サイズだけの変更で検索 text が変化しない。
5. **外部永続性**
   - Preview の再起動・再デプロイ後も、QA DB に保存した検証用データを取得できる。
   - runtime が SQLite fallback やローカル filesystem に戻っていない。
   - QA の検証中に Production DB へ接続していないことを、Vercel env と Supabase
     Project ref の両方で確認する。

QA 用 fixture や個人ノートの本文をログへ出しません。検証用 fixture を削除する場合は、
対象 ID と QA target を確認してから別の明示的な操作として行います。

## 10. 失敗時の扱い

- import または reconcile が failure、非 0 exit code、不一致、timeout になった場合は、
  成功扱いにせず Preview deploy や Production へ進まない。
- import は transaction rollback を期待できる設計ですが、失敗後の target を自動で
  「空」と見なさない。schema または rows が残っている可能性があるため、再実行、削除、
  cleanup、overwrite を operator の確認なしに行わない。
- target が空でない、Project ref が不一致、environment が `verification` でない、
  allowlist が完全一致しない場合は、コマンドを開始せず停止する。
- source の本文、タイトル、タグ名、Cue、Summary、Canvas text、secret、接続 URL を
  エラーログへ出さない。必要な記録は command 名、終了 code、redacted error、対象
  environment など最小限にする。
- source SQLite が freeze 後に変化した、WAL / SHM sidecar が出た、source schema または
  foreign key が不正になった場合は、source を再固定して dry-run からやり直す。
- operator 用 `DIRECT_URL` の IPv6 到達性、DNS、firewall、TLS など環境依存の blocker
  が出た場合は、秘密を含まないエラー要約と環境条件だけを記録して手順を止める。
  shared transaction-mode pooler（port `6543` または `pgbouncer=true`）へ置き換えて
  migration/import を通すことはしない。
- Vercel Preview の認証、build、runtime CRUD、Canvas 復元、検索、削除、再デプロイ後の
  永続性のいずれかに失敗した場合は、Production へ進めず、最後に成功した Preview と
  QA target の状態を保全する。

## 11. 完了チェックリスト

### QA / Preview 完了

- [ ] Local のアプリと SQLite source を停止・freeze した。
- [ ] source path を絶対パスで明示した。
- [ ] WAL / SHM sidecar がないことを確認した。
- [ ] source `postgres:import --dry-run` が成功した。
- [ ] Supabase Project 作成時の Data API、新規テーブル自動公開、自動 RLS がすべて
      OFF である。
- [ ] QA Project / target が Production ではなく、application rows が空である。
- [ ] ORM → Prisma の shared transaction-mode pooler（通常 port `6543`）を Vercel
      Preview の `DATABASE_URL` に設定した。
- [ ] ORM → Prisma の shared session-mode pooler（通常 port `5432`）を operator の
      `DIRECT_URL` にだけ設定した。
- [ ] `DATABASE_URL` と `DIRECT_URL` が同じ値でない。
- [ ] Basic Auth の 3 変数を Preview scope に設定し、保存後に再デプロイした。
- [ ] `npm run prisma:migrate:postgres` が QA target に対して成功した。
- [ ] import の dry-run が成功した。
- [ ] `npm run postgres:import` が成功し、target の rows が未完了状態でない。
- [ ] `npm run postgres:reconcile` が read-only で PASS した。
- [ ] Vercel build が generate + Next build のみで、migration / import / reconcile / db
      push を実行していない。
- [ ] 未認証拒否、正しい Basic Auth、CRUD、Canvas JSON / page dimensions、Canvas text
      search、physical delete、再デプロイ後の永続性を Preview で確認した。
- [ ] QA 操作中に Production DB、Production secret、Production label を使っていない。

### Production へ進む前の未完了条件

次の条件がすべて完了するまで、Production へ進みません。この文書は Production の
Project、DB、secret、deployment を作成・変更する承認ではありません。

- [ ] Production 用 Supabase Project / DB を QA と分離し、接続先と所有者を確認した。
- [ ] Production 用の runtime pooler URL、migration-compatible な operator 用 URL、
      Basic Auth / 認証 secret を secret manager と Vercel の Production scope で別管理した。
- [ ] Production target に対する migration、data import、reconcile の手順と承認が、
      QA と別の作業記録として準備されている。
- [ ] Production の backup / export、restore、retention、credential rotation、
      rollback / forward-fix 手順を検証した。
- [ ] Production deployment の build に operator workflow が混ざらないことを確認した。
- [ ] Preview QA の結果、接続先、migration history、件数・ID・Canvas 照合結果、認証
      確認をレビューできる状態にした。
- [ ] Production に投入するデータの有無、停止時間、切替手順、復旧責任者を決めた。

## 12. 公式参考リンク

- [Supabase Prisma](https://supabase.com/docs/guides/database/prisma)
- [Supabase connecting to Postgres](https://supabase.com/docs/guides/database/connecting-to-postgres)
- [Vercel environment variables](https://vercel.com/docs/environment-variables)
- [Vercel CLI env](https://vercel.com/docs/cli/env)
