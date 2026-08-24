# Desktop Alpha の Tauri 基盤境界

作成日: 2026-08-17
最終更新: 2026-08-24

状態: 基盤は選定済み。Desktop Alpha のシェルは Tauri + Node.js サイドカーである。製品側 `src-tauri/` は作成済みで、user data / SQLite bootstrap、single-instance recovery、既存 primary lifecycle、Settings shell / bridge / entrypoint の部分実装と責務 audit が完了している。更新確認・取得・検証・state・pending verification、verified artifact の明示 apply preparation、persisted `ApplyPreparation` を起点とする staged migration、candidate health、bundle switch、rollback / recovery、checkpoint persistence、旧 bundle cleanup の backend 実装も完了している。実際の macOS packaged app による health / switch / rollback / cleanup、packaged Apple Silicon GUI QA は未検証である。Desktop Alpha 全体は未完了で、Settings の操作機能、backup / restore、完全なデータ削除、診断も残っている。

## 現在地（2026-08-24）

- 製品側 `src-tauri/` に Tauri shell、dynamic loopback を使う sidecar 起動、user data / SQLite bootstrap、single-instance recovery、window state、dirty close bridge、sidecar cleanup の実装がある。Rust unit test と静的 contract test で確認できる範囲を実装済みとする。
- Settings は、既存 primary WebView へ届く Mac menu bridge、Web gear / mobile trigger の shared bridge、3カテゴリ modal、focus / keyboard 制御までが実装済みである。General は読み取り専用、Updates と Data and Backup の操作は準備中で、現行 `/backup` を維持する。
- UI / Rust の責務抽出と 2026-08-21 の最終 audit は完了し、現時点で追加の責務分割 coding task はない。Desktop Alpha 全体の完了とは扱わない。
- 更新系には provider / manifest / compatible selection / 公開 URL 境界 / download / signature・SHA-256 / archive・bundle validation / update state / pending verification、明示 apply、staged migration、read-back、candidate health、bundle switch、rollback / recovery、checkpoint persistence、cleanup の実装がある。`apply_verified_update`（引数なしの明示 command）は verified candidate を再検証して `ApplyPreparation` の atomic state transition と explicit restart handoff へ渡す。persisted `ApplyPreparation` からだけ staged migration を起動し、candidate health 成功前は current app / live DB / safety backup を保持する。`node --test test/desktop/desktop-update-*.test.js` は 54/54 PASS、rollback/recovery focused tests は 6/6 PASS（同 suite に含む）だが、これは source contract と disposable fixture の証跡であり、実 provider / package runtime、browser / DB read-back、dynamic loopback / sidecar runtime、packaged Apple Silicon GUI の PASS ではない。
- 2026-08-24 の lifecycle/runtime tests は 15 PASS、7 SKIP（loopback / packaged runtime 依存）。対象 ESLint、対象 Desktop test / launcher / runtime helper の `node --check`、`cargo fmt --manifest-path src-tauri/Cargo.toml -- --check`、`git diff --check` は PASS。Rust `cargo test --offline` は環境に `base64 0.22.1` crate がなく compile 前に実行不能だった。実際の macOS packaged app による sidecar health / bundle switch / rollback / cleanup は未検証である。
- dynamic loopback の実 runtime、browser / DB read-back、packaged Apple Silicon GUI、backup / restore、完全なデータ削除、startup failure / 診断は未確認または未実装である。

## 選定結果

- `candidateDecision: selected`
- Desktop Alpha のシェルには **Tauri + Node.js サイドカー**を採用する。
- 選定者: 発注者
- 選定日: 2026-08-17
- 根拠: Tauri PoC retry24 の `poc:validate`、`poc:prepare`、`poc:build`、`poc:runtime-http`、`poc:lifecycle`、`poc:package` が PASS した。`poc:package` は `.app` と DMG の2種類の成果物を生成した。
- 画面操作の自動化は retry24 で利用できず、`poc:smoke` と最終証跡は BLOCKED のまま残る。この未計測項目は PoC の既知の境界として扱い、シェルの選定をやり直す理由にはしない。Desktop Alpha では、パッケージ済みアプリの画面操作を別途確認する。

PoC の証跡は次の一時ディレクトリにある。

```text
/private/tmp/cornell-method-desktop-poc/mvp-gate0-20260812-dcc057d8/tauri-current-vm-20260817-retry24/
```

このディレクトリの検証用データ、稼働データベース、`.app`、DMG、一時出力先は検証用であり、製品のデータや配布物として再利用しない。

## PoC と製品を分ける境界

| 領域 | 役割 | してはいけないこと |
|---|---|---|
| `tools/desktop-poc/tauri/` | 基準、検証用データ、Tauri シェル、サイドカー、測定用スクリプトを置く検証領域 | 製品の実行環境、ユーザーデータ、正式な配布物の正本にする |
| `src-tauri/` | Desktop Alpha の Tauri シェル、パッケージ設定、サイドカー接続を置く製品実装領域。承認済み | PoC のソース、検証用データ、証跡、ロックファイルをそのまま移す |
| アプリバンドル | 読み取り専用の実行コード、Next.js の資産、Prisma Client、マイグレーション、同梱する実行環境やネイティブリソースを置く | 稼働 SQLite、管理用バックアップ、設定、ローカルログを書き込む |
| macOS の Application Support | 稼働 SQLite、管理用バックアップ、設定、ローカルログ、保留中の復元データを置く書き込み領域 | 同期フォルダ、PoC の一時出力先、アプリバンドルに稼働 SQLite を置く |

Application Support の保存構成は発注者承認済みであり、次の実装 task の入力にする。

## アプリ識別子と保存先の候補

この文書では、候補の状態を次のように表す。

- `PROPOSED`: 推奨案。発注者の承認後に実装 task の入力にする。
- `APPROVED`: 発注者が承認済み。前提条件を満たす実装 task の入力にしてよい。
- `UNDECIDED`: まだ決めない項目。
- `PoC ONLY`: PoC 専用。製品へ持ち込まない項目。

### アプリ識別子

| 用途 | 状態 | 候補と理由 |
|---|---|---|
| 製品 | `APPROVED` | `com.cornellmethod.notebook`。製品の Application Support の名前空間としても使えるため、表示名の変更や日本語化の影響を受けにくい。 |
| PoC | `PoC ONLY` | `com.cornellmethod.notebook.tauri.poc`。現在の `tauri.conf.json` に設定された検証用識別子で、PoC の検証用データ、一時出力先、固定ポートと同じ境界に残す。 |
| 開発専用 | `UNDECIDED` | 製品の識別子と保存先を分ける。具体的な接尾辞と Application Support の保存先は配布設定の契約で決める。例として `com.cornellmethod.notebook.dev` があるが、決定値ではない。 |

PoC の識別子を製品へ昇格させると、macOS が管理するアプリ状態、二重起動の判定、Application Support の名前空間を検証環境と共有するおそれがある。製品の識別子を分けることで、PoC の検証用データや一時データを製品が開く経路を切り離せる。

出荷後に bundle ID を変更すると、macOS が別のアプリとして扱い、既存の保存先を見つけられない可能性がある。承認後は長期に維持する。

### 製品実装ディレクトリ

| 候補 | 状態 | 評価 |
|---|---|---|
| `src-tauri/` | `APPROVED` | Tauri の標準配置。既存の `src/app` とローカル実行環境の責務を分け、正式な配布物の入力を独立させる。 |
| `tools/desktop-poc/tauri/` | `PoC ONLY` | 検証用スクリプト、検証用データ、証跡、固定ポートを含むため、製品実装領域には使わない。 |

### Application Support の保存先

ルートには製品識別子と同じ名前空間を使う案を推奨する。

```text
~/Library/Application Support/com.cornellmethod.notebook/
├── live/
│   └── notebook.sqlite
├── backups/
├── staging/
├── settings/
│   └── update-state.json
├── logs/
└── pending-restore/
```

| 保存先 | 状態 | 役割 |
|---|---|---|
| `~/Library/Application Support/com.cornellmethod.notebook/` | `APPROVED` | 製品のユーザーデータのルート。製品識別子と同じ名前空間を使う。 |
| `live/notebook.sqlite` | `APPROVED` | 稼働中の SQLite。ノートデータの唯一の正本とする。 |
| `backups/` | `APPROVED` | マイグレーション前と復元前に作る管理用バックアップ。保持世代数などの retention policy は未決定とする。 |
| `staging/` | `APPROVED` | 更新 package と DB staging copy を一時保管する app 管理領域。verified package は `packages/<sha256>.app.tar.gz`、展開済み candidate は `extract/<sha256>/Cornell Method Notebook.app`、DB migration 作業領域は `database-migrations/` を使い、各 path は state と validator で canonical に検証する。 |
| `settings/` | `APPROVED` | ウィンドウ状態、更新状態、アプリ設定を保存する。`update-state.json` に保存する再起動後の検証用 artifact metadata は承認済みの項目だけとし、manifest root の schema version とは分離する。 |
| `logs/` | `APPROVED` | ノート本文等を含まないローカルログ。保持期間、容量、世代整理の細則は未決定とする。 |
| `pending-restore/` | `APPROVED` | 更新後に明示確認して復元を再開するための隔離したコピーを置く。起動時に自動復元しない。 |
| Application Support 外の SQLite 書き出し | `APPROVED` | ユーザーが保存先を選ぶ平文の書き出し。管理用バックアップの世代管理や完全なデータ削除の対象にしない。 |

提案するルートは `com.cornellmethod.notebook` の名前空間である。開発用実行環境は別の識別子と保存先、PoC は `tools/desktop-poc/tauri/` と一時出力先を使う。パッケージ済みアプリと検証環境で、データ保存先を共有しない。

## 提案する初期値

次の値を Desktop Alpha の初期値とする。未承認の値は `UNDECIDED` または `PROPOSED` として扱う。

| 項目 | 提案値 | 承認前の扱い |
|---|---|---|
| 製品識別子 | `com.cornellmethod.notebook` | 承認済み。実装 task の入力とする |
| 製品実装ディレクトリ | `src-tauri/` | 承認済み。PoC からソース、検証用データ、証跡、ロックファイルを移さない |
| Application Support のルート | `~/Library/Application Support/com.cornellmethod.notebook/` | 承認済み。保存先解決処理の入力とする |
| 稼働 SQLite | `<root>/live/notebook.sqlite` | 承認済み。稼働 DB の唯一の正本とする |
| 管理用バックアップ | `<root>/backups/` | 承認済み。マイグレーション前と復元前に限定し、retention policy の細則は未決定とする |
| 更新 package / DB staging | `<root>/staging/` | 承認済み。package は `packages/<sha256>.app.tar.gz`、candidate は `extract/<sha256>/Cornell Method Notebook.app`、DB migration 作業領域は `database-migrations/`。state の相対 path と symlink を validator が検証する |
| 設定、ログ、保留中の復元 | `<root>/settings/`、`<root>/logs/`、`<root>/pending-restore/` | `settings/update-state.json` は version、channel、architecture、`artifactId`、`sizeBytes`、`sha256`、`keyId`、verification state、app 管理 staging からの relative package path、時刻、recovery checkpoint、typed failure を atomic に保存する。manifest root の schema version とは分離する |
| 開発用実行環境 | 製品と分離した識別子と保存先 | 具体値は未決定 |

## 識別子と保存先を変更する場合のリスク

bundle ID や Application Support のルートを出荷後に変更すると、旧データを見つけられず空の DB を作る、設定やバックアップを見失う、PoC のデータを誤って開くといった事故が起こり得る。

変更が必要になった場合は、旧識別子と旧保存先を明示し、旧 DB の安全確保用バックアップ、スキーマと整合性の検証、コピーまたはアトミックな名前変更、再オープン検証を実施する移行 task を別に承認する。移行成功前に旧保存先を削除しない。

製品実装ディレクトリを変更しても、Application Support の保存先は自動で変更しない。リポジトリ内のディレクトリ移動とユーザーデータ移行を分けて扱う。

## 責務と依存方向

```text
Tauri シェル
  ├─ 主ウィンドウと二重起動の制御
  ├─ ユーザーデータの保存先の決定
  ├─ Next.js のローカル実行環境と Node.js サイドカーの起動・終了
  └─ ループバックで開く画面の制御

WebView の画面
  -> 既存の HTTP API 契約
  -> Next.js のローカル実行環境
  -> アプリケーション層 / Prisma / SQLite adapter
  -> Application Support 内の稼働 SQLite
```

| 構成要素 | 担当する処理 | 担当させない処理 |
|---|---|---|
| Tauri シェル | 主ウィンドウ、二重起動時の既存ウィンドウ表示、ウィンドウ状態、OS のファイル選択ダイアログ、サイドカーの起動・終了、アプリが所有する子プロセスの終了、ループバックへの画面遷移 | ノートの業務ルール、Prisma クエリ、Canvas の保存形式、DB トランザクション |
| Next.js のローカル実行環境 | App Router、既存 route / API、MVP の HTTP API 契約、画面へのデータ提供 | アプリバンドルへの DB 書き込み、Tauri 固有 API の業務ロジックへの持ち込み |
| Node.js サイドカー | パッケージ済み Next.js の実行環境。シェルから DB の絶対パスと起動条件を受け取る | ウィンドウ制御、承認されていないネットワーク通信、別 DB の作成 |
| SQLite / filesystem adapter | ユーザーデータ保存先の初期化、SQLite の絶対パス、スキーマ / マイグレーション、バックアップ / 復元の保存境界 | ウィンドウ状態、HTTP ステータス、画面状態 |
| WebView の画面 | `/notes` を起点とする現行 MVP、HTTP API の利用、未保存状態と確認ダイアログ | Tauri 内部プロセスの直接管理、SQLite ファイルの直接操作 |

`DATABASE_URL` は、シェルが決めた Application Support 内の SQLite の絶対パスを基に、実行環境の起動時にサイドカーへ渡す。画面側にはパスを公開しない。相対パス、PoC 固定パス、固定ループバックポートを製品契約にしない。

## 起動と終了の前提

### 起動

1. Tauri シェルがユーザーデータ保存先とシェルのインスタンスの状態を確認する。
2. DB がない初回利用の場合だけ、ユーザーデータ保存先に初期 DB を作る。既存 DB のマイグレーションは稼働 DB へ直接適用せず、更新時の隔離環境で処理する。
3. シェルが Node.js サイドカーと Next.js のローカル実行環境を、アプリが所有する子プロセスとして起動する。
4. 実行環境の ready 状態とプロセス識別情報を確認してから主ウィンドウを作り、常に `/notes` を表示する。
5. 二重起動では新しい主ウィンドウを作らず、既存の主ウィンドウを前面に出す。Settings モーダル、確認ダイアログ、OS のファイル選択ダイアログは主ウィンドウ数に数えない。

### Desktop Alpha の single-instance 実装境界

製品側の lifecycle は次の境界まで実装済みである。

- `settings/.instance.lock` は rename / unlink しない stable file とし、read/write で開いて Unix/macOS の `flock(LOCK_EX | LOCK_NB)` を取得する。ファイルの内容、PID、marker、socket pathname は ownership の authority ではない。
- owner 情報は `settings/.instance.owner` に分離し、temp file への全量書き込み、`sync_all`、同一 directory 内の `rename` で atomic replace する。stable lock file に旧形式 JSON が残る場合は、旧 process を推測で奪取せず、sanitized error で停止する。
- advisory lock を取得した primary だけが owner marker を更新し、focus socket を bind する。secondary は `Focused`、または socket 未作成 / `not-ready` の bounded retry 後に `AlreadyRunningNotReady` として終了し、Tauri window や sidecar を作らない。
- lock 保持中に接続不能と確認できた stale Unix socket だけを再利用する。active endpoint、unknown protocol、permission error は socket を残して起動失敗とする。guard の clean exit は自分の owner marker と socket だけを cleanup し、stable lock file は残す。
- primary の bootstrap より前に focus listener を bind するため、起動途中の secondary には `not-ready` を返せる。実装の正本は `src-tauri/src/main.rs` の Rust unit test であり、Node test は製品識別子と静的契約だけを補強する。

この task の範囲は single-instance recovery と既存の primary lifecycle である。Settings、更新、backup / restore、完全削除、diagnostic、packaging QA は別境界として残す。旧 `create_new` 実装で起動した live process との hot upgrade は Desktop Alpha の受け入れ対象外であり、旧 marker/socket/DB/backup の無条件削除は行わない。

### 終了

1. 最後の主ウィンドウに対する終了要求を受ける。
2. 未保存状態がある場合は「保存して終了」「保存せず終了」「戻る」を画面側で確認する。保存に失敗した場合は終了せず、未保存状態を維持する。
3. 終了が確定した場合だけ、シェルがサイドカーとアプリ所有の子プロセスを停止する。
4. 観測した子孫プロセス全体が終了したことを確認し、孤立プロセスを残さない。

シェル内部に複数のプロセスが存在すること自体は失敗条件にしない。アプリが所有するプロセスの範囲、終了対象、終了後に空になったプロセスツリーを分けて記録する。

## データとネットワークの境界

- 稼働 SQLite をノートデータの唯一の正本とする。
- ノートの作成、編集、閲覧、検索、復習、保存、バックアップ / 復元はオフラインで動作させる。
- ネットワーク通信は更新マニフェストの確認と更新パッケージの取得に限る。初期 provider は GitHub Releases とするが、取得側は provider-neutral な manifest interface とする。manifest の logical field allowlist と validation boundary は下記で承認済みとし、具体的な URL、署名アルゴリズム名・encoding・canonicalization・鍵値、package archive の拡張子は未決定である。
- 現行 MVP の `/notes`、`/notes/new`、`/notes/[id]`、`/backup`、API、明示保存、確認付き物理削除、復習、`CanvasDocumentV1`、旧形式の Markdown 互換を変更しない。
- アプリバンドルの更新、再インストール、通常のアンインストールで稼働 DB、管理用バックアップ、設定を暗黙に削除しない。
- 開発・検証用の Next.js Web 起動経路を維持する。開発 Web とパッケージ済み Tauri の実行環境で、保存先と DB を共有しない。

## Desktop Alpha の更新契約と基盤責務

更新契約は確定済みである。製品側の provider normalization、manifest validation、compatible selection、公開 URL 境界、download、signature・SHA-256、archive・bundle validation、update state、pending verification、verified artifact の apply preparation、staged migration、read-back、candidate health、bundle switch、rollback / recovery、checkpoint persistence、旧 bundle cleanup は backend 実装済みである。実 provider / package runtime、実際の macOS packaged app による health / switch / rollback / cleanup、packaged Apple Silicon GUI の検証は未実施である。focused static / disposable test の PASS を provider / package runtime、browser / DB read-back、packaged GUI の PASS へ繰り上げない。

### Manifest / package の実装状態

| 範囲 | 現状 | 検証境界 |
|---|---|---|
| provider / manifest / compatible selection / 公開 URL 境界 | backend 実装済み、focused static contract test PASS（54/54） | GitHub Releases provider response の実取得、dynamic network、browser / GUI 経由の確認は未検証。 |
| package download / signature・SHA-256 / archive・bundle validation | backend 実装済み、focused static contract test PASS（54/54） | disposable fixture と source contract の確認であり、実 package、packaged `.app`、Apple Silicon GUI の検証ではない。 |
| update state / pending verification | backend 実装済み、focused static contract test PASS（54/54） | atomic state と staging revalidation を持つ。apply / migration / recovery の checkpoint は typed state として永続化する。実 runtime は未検証。 |
| verified artifact の update apply preparation | backend 実装済み、focused static contract test PASS（54/54） | `apply_verified_update` は引数なしの明示 command。manifest / candidate identity、signature・digest、canonical staging path、archive、bundle ID / version / architecture / arm64 Mach-O を再検証し、`ApplyPreparation` の atomic state transition 後に explicit restart handoff へ渡す。自動 check、startup check、download 完了、pending notification からは apply / restart しない。実 provider / package runtime、packaged GUI は未検証。 |
| staged migration | backend 実装済み、read-back / switch fixture PASS | persisted `ApplyPreparation` だけを起点とし、pending migration 時だけ safety backup、DB staging copy の migration / reopen、既存列・Notebook / Canvas / legacy Markdown の read-back、atomic switch、failure / interruption の fail-closed state を実装。実 packaged runtime は未検証。 |
| rollback / recovery / candidate health / cleanup | backend 実装済み、rollback/recovery focused tests 6/6 PASS（54/54 に含む） | `HealthPending`、`BundleSwitching`、`BundleSwitched`、`CleanupPending`、`RollbackPending` を永続化し、candidate health 成功前の current app / live DB / backup 保持、成功後だけの cleanup、SQLite restore、旧 bundle 復帰を実装。candidate health は `Contents/Resources/runtime` を使用。実 macOS bundle の sidecar health / switch / rollback / cleanup は未検証。 |
| runtime QA / packaged Apple Silicon GUI | 未検証 | dynamic loopback / sidecar runtime、browser / DB read-back、GUI の dirty close、packaged GUI は未確認。 |

- 初期配布は DMG とする。アプリ内更新は Apple Silicon の `aarch64-apple-darwin` 向け `.app archive` とする。Intel の artifact と QA は Desktop Alpha の対象にせず、Public Mac Release で別途判断する。archive の具体的な拡張子は固定しない。
- 初期 provider は GitHub Releases とする。Tauri 側は provider 固有の response へ直接依存せず、provider adapter が `releases[]` を持つ provider-neutral な manifest interface へ正規化した結果を受け取る。provider の並び順、文字列順、raw response、release notes は候補選択に使わない。
- 端末側で channel、version、architecture、macOS compatibility を判定し、同一 channel の新しい compatible version だけを選択する。downgrade は行わない。
- 各 release の `keyId` はアプリに保持する現行鍵または次期鍵を参照する。package は公開鍵署名と SHA-256 の両方を検証し、manifest を信頼根の追加経路にしない。署名アルゴリズム名、encoding、canonicalization、鍵値、承認済み field allowlist 以外の wire-level details は未決定とする。
- 更新 package は Application Support の app 管理 `staging/` に保管する。DB compatibility はユーザー固有情報を manifest に載せず、端末内の DB staging copy で migration と reopen を検証する。
- `settings/update-state.json` に保存する再起動後の検証用 artifact metadata は承認済みの項目だけとする。ノート本文、SQLite、backup、診断情報を保存せず、manifest root の schema version と local state schema を分離する。`ApplyPreparation`、`RestartHealthCheck`、`Rollback`、`Cleanup` と recovery checkpoint / typed failure は atomic に保持する。
- `apply_verified_update` は引数なしの明示 invoke command とし、verified candidate の manifest / candidate identity、signature・digest、canonical staging path、archive、bundle（bundle ID / version / architecture / arm64 Mach-O）を再検証する。検証後に `ApplyPreparation` を atomic に保存し、explicit restart handoff へ渡す。自動 check、startup check、download 完了、pending notification だけでは apply / restart しない。
- staged migration は persisted `ApplyPreparation` からだけ起動し、pending migration がある場合だけ safety backup を作成する。DB staging copy 上で古い順に migration、schema / integrity / foreign key / reopen、既存列・Notebook / Canvas / legacy Markdown の read-back を確認し、成功後だけ atomic switch する。failure / interruption 後に自動 migration を再実行しない。
- candidate/current の path、symlink、bundle identity、version、architecture を検証する。candidate health には packaged app bundle root ではなく固定 runtime root `Contents/Resources/runtime` を渡し、health 成功前は current app / live DB / backup を保持する。
- `HealthPending`、`BundleSwitching`、`BundleSwitched`、`CleanupPending`、`RollbackPending` の checkpoint を atomic に永続化する。rollback、SQLite restore、旧 bundle 復帰、typed failure は fail-closed に扱い、cleanup は `BundleSwitched` 後だけ行う。成功後にだけ旧 bundle、staged artifact、migration safety backup を削除する。
- package と DB staging の検証に成功した場合だけ明示的な再起動で切り替える。旧 app が新しい DB schema を検出した場合は live DB を変更せず、現行版への更新または backup restore を案内する。
- 切り替え後の新版の初回起動と health check が成功するまで旧 app bundle を保持する。検証または health check に失敗した場合は現行 app、live DB、app 管理 backup を維持して rollback し、成功後にだけ旧 bundle を削除する。
- Developer ID と notarization は Desktop Alpha の必須条件にしない。Public Mac Release で判断する。
- 通常のアンインストールでは live DB を削除しない。Settings の完全なデータ削除は別操作とし、明示確認後に live DB、app 管理 backup、設定だけを対象にする。外部 SQLite export は削除しない。

### Manifest validation boundary

provider response の正規化後に、manifest を strict に検証する。次の logical field allowlist は、root、release、artifact、signature の未知 field を拒否するための境界である。

| object | 許可する field | 必須・値の境界 |
| --- | --- | --- |
| root | `productId`, `schemaVersion`, `releases` | `productId` は `com.cornellmethod.notebook` と一致する。`schemaVersion` は必須の `1` とし、未知 version は fail closed とする。`releases[]` は必須配列で、空配列は有効な「更新なし」とする。 |
| release | `channel`, `version`, `architecture`, `minVersion`, `maxVersionExclusive`, `artifact`, `signature` | `channel` は `stable` 固定、`version` は SemVer 互換、`minVersion` は必須の macOS 下限、`maxVersionExclusive` は任意の排他的上限とする。macOS version は数値 component で比較する。 |
| artifact | `artifactId`, `format`, `url`, `sizeBytes`, `sha256` | `artifactId` は必須の opaque immutable ID とし、同じ package には同じ ID を使う。`format` は抽象値 `app-archive`、`sizeBytes` は正の整数 byte 数、`sha256` は 64 文字の lowercase hexadecimal とする。 |
| signature | `keyId`, `proof` | `keyId` と opaque な `proof` を必須とする。proof は package digest と release metadata をまとめて署名した結果を表すが、署名アルゴリズム名、encoding、canonicalization、鍵値は固定しない。 |

実際の最低対応 macOS version と deployment target は、Apple Silicon の packaged PoC 後に決める。`minVersion` / `maxVersionExclusive` の validation boundary を先に固定することは、最低対応 version の数値を確定することを意味しない。

root、release、artifact、signature の未知 field、product ID 不一致、未知 root schema version、必須 field・型・SemVer・macOS range・artifact metadata・URL・signature proof の不備、同一 target の重複（duplicate）は manifest 全体を拒否する。`stable` 以外の channel、未知 architecture、未知 format はその release だけを対象外とし、他の有効な release を評価する。Desktop Alpha で評価する architecture は `aarch64-apple-darwin` である。

`version` は SemVer の precedence で比較し、`releases[]` の並び順や文字列順を使わない。prerelease は対象外とし、build metadata は version の大小判定に使わない。対象 channel、architecture、format、macOS range に適合し、現行 version より新しい候補のうち、最も高い SemVer precedence の release を選ぶ。空配列、または非対象 release だけの manifest は有効な「更新なし」とする。

同じ channel、version、architecture、macOS target（`minVersion` と `maxVersionExclusive` の組）の重複が manifest 全体にあれば、対象外 release を含めて manifest 全体を拒否する。`maxVersionExclusive` がない target は、上限なしの target として重複判定する。

artifact URL は公開 direct HTTPS とする。許可する redirect は HTTPS から HTTPS への redirect だけであり、HTTP への downgrade、credential、token、ユーザー固有 query を含む URL は拒否する。package format は `app-archive` という抽象値だけを契約に置き、archive の具体的な拡張子は固定しない。

manifest root の `schemaVersion: 1` は manifest の version namespace であり、local `settings/update-state.json` の schema version と分離する。update state には再起動後の検証に必要な version、channel、architecture、`artifactId`、`sizeBytes`、`sha256`、`keyId`、verification state、app 管理 staging からの relative package path、時刻だけを保存する。URL、provider response 全体、token、DB、user path は保存しない。

## 実装の順序

1. `ユーザーデータ / SQLite 初期化`（実装済み）: 保存先の決定、初回 DB、スキーマ状態、実行環境への絶対パスの受け渡し。
2. `単一ウィンドウのライフサイクル`（single-instance recovery、primary lifecycle、window state、close bridge、sidecar cleanup の実装済み。packaged QA は未確認）: 単一インスタンス、二重起動時の表示、ウィンドウ状態、サイドカーの所有権、終了処理。
3. `Settings`（shell / bridge / entrypoint / 3カテゴリ modal は実装済み。操作機能は未実装）: General、Updates、Data and Backup の入口と、現行 `/backup` からの段階移行。
4. `更新 apply preparation`: provider / manifest / `releases[]` の端末内選択、公開 URL 境界、package download、署名・SHA-256 / archive・bundle 検証、update state、pending verification、verified artifact の明示再検証、`ApplyPreparation` の atomic state transition、explicit restart handoff まで backend 実装済み。自動経路から apply / restart しない。
5. `staged migration`: persisted `ApplyPreparation` を起点に、pending migration の有無を判定し、必要な場合だけ migration 前 safety backup、DB staging copy の migration / read-back / reopen、既存列・Notebook / Canvas / legacy Markdown の保持確認、atomic switch、failure / interruption の typed checkpoint を実装済み。
6. `rollback / recovery`: package / DB staging、candidate health、切替、更新後 health check、interrupted state の失敗時に、現行 app、live DB、app 管理 backup を維持して rollback / SQLite restore / 旧 bundle 復帰し、成功後だけ cleanup する backend を実装済み。candidate health には `Contents/Resources/runtime` を渡す。実 packaged runtime は未検証。
7. `バックアップ / 復元`: 手動 SQLite 書き出し、管理用バックアップと外部ファイルの別入口、検証、アトミックな切り替え、再オープン。
8. `削除 / 診断`: 完全なデータ削除、ローカルログの保持、診断 ZIP、起動失敗時の画面。
9. `パッケージ済み Desktop Alpha の品質確認`: Apple Silicon のパッケージ済みアプリで、現行 MVP と Desktop Alpha 契約を結合確認する。

この順序に Phase 2 の Canvas PNG、検索サジェスト、大規模一覧、自動保存、Undo、専用復習 task、NoteCard / D&D を追加しない。

## 発注者の承認が必要な項目

- 開発専用の識別子と製品の識別子を分ける命名方針。
- bundle ID またはユーザーデータのルートを将来変更する場合の移行対象、旧保存先の保持期間、失敗時の復旧方針。
- package の staging metadata、保留中の復元メタデータ、app 管理 backup / local log の retention policy の細則。`update-state.json` に保存する artifact metadata の境界は承認済みである。

## 後続 task が引き継ぐ基盤情報

1. 承認済みの製品識別子と製品ソースディレクトリ。
2. PoC ディレクトリを参照しないパッケージ / リソースの境界。
3. 承認済みの Application Support ルートと相対レイアウト。
4. 稼働 DB の絶対パス、初回 DB 作成条件、既存 DB がない場合の復旧条件。
5. `DATABASE_URL` をサイドカーへ渡す境界。画面側にはパスを公開しない。
6. 管理用バックアップ、更新 package / DB staging、`update-state.json`、保留中の復元を初期化 task で扱うか、後続 task に残すかという責務分担。

## 未決事項

| 項目 | 状態 | 次に必要な判断 |
|---|---|---|
| 製品 bundle ID | `APPROVED`: `com.cornellmethod.notebook` | 実装 task の入力とする |
| 製品実装ディレクトリ | `APPROVED`: `src-tauri/` | PoC と分離した製品配置として使う |
| Application Support 内の保存先 | `APPROVED`: 識別子の名前空間と `live` / `backups` / `settings` / `logs` / `pending-restore` | 保存形式とメタデータの詳細を実装 task で決める |
| 開発用識別子と保存先 | `UNDECIDED` | 製品と分離する命名規則の承認 |
| Node.js サイドカーの同梱方式 | `UNDECIDED` | パッケージ済み実行環境とネイティブ依存関係の配布設計 |
| 最低対応 macOS | `UNDECIDED` | Tauri の実行環境と Apple Silicon の結合確認 |
| 更新 provider | `APPROVED`: 初期 provider は GitHub Releases。取得側は provider-neutral な manifest interface とし、provider response を正規化してから strict validation する | 具体的な URL、provider adapter の実装詳細は更新実装 task で決める |
| manifest / package の判定と配置 | `APPROVED`: `productId`、root `schemaVersion: 1`、strict field allowlist、`releases[]`、SemVer / stable / macOS range / Apple Silicon / artifact / URL / duplicate / non-target release の境界、Application Support 内の app 管理 staging | package archive の wire-level 拡張子は契約で固定しないが、現行 validator の canonical staging path は実装済み。manifest validation、compatible selection、provider normalization、download、apply preparation、staged migration / full apply の backend を static / disposable test で確認し、packaged runtime は未検証 |
| package の署名・完全性検証 | `APPROVED`: 公開鍵署名と SHA-256 を併用し、`keyId` と opaque proof で package digest / release metadata を検証する | 署名アルゴリズム名、encoding、canonicalization、秘密鍵・公開鍵の値、manifest から信頼根を追加しない検証実装の wire-level details は未決定。signature verification、apply 時の再検証、candidate health / rollback / cleanup の backend は実装済み、packaged runtime は未検証 |
| Developer ID / notarization | `UNDECIDED`、Desktop Alpha の必須条件ではない | Public Mac Release で判断する |
| 画面操作の自動化 | PoC `BLOCKED` | パッケージ済み画面の Alpha 品質確認で使う検証方法 |

## 次に読むファイル

- `HANDOFF_2026-08-22.md`
- `summary/20260821/0800-audit-final-responsibility-boundaries.md`
- `doc/implementation/POST_MVP_IMPLEMENTATION_PLAN.md` §7〜§8、§12〜§14
- `doc/implementation/MVP_CONTRACT.md` §9 と `doc/implementation/IMPLEMENTATION_STATUS.md` §5.4
- `doc/testing/TEST_SCENARIOS.md` の Desktop Alpha 節
- `src-tauri/src/main.rs`、`instance.rs`、`runtime.rs`、`lifecycle.rs`、`menu.rs`、Settings source と対応 contract test
