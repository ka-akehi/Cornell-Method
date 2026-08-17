# Desktop Alpha の Tauri 基盤境界

作成日: 2026-08-17

状態: 基盤は選定済み。製品識別子、製品実装ディレクトリ、保存構成は承認済み。実装は未着手

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
├── settings/
├── logs/
└── pending-restore/
```

| 保存先 | 状態 | 役割 |
|---|---|---|
| `~/Library/Application Support/com.cornellmethod.notebook/` | `APPROVED` | 製品のユーザーデータのルート。製品識別子と同じ名前空間を使う。 |
| `live/notebook.sqlite` | `APPROVED` | 稼働中の SQLite。ノートデータの唯一の正本とする。 |
| `backups/` | `APPROVED` | マイグレーション前と復元前に作る管理用バックアップ。最新3世代を保持する。 |
| `settings/` | `APPROVED` | ウィンドウ状態、更新状態、アプリ設定を保存する。ノート本文の代替にはしない。 |
| `logs/` | `APPROVED` | ノート本文等を含まないローカルログ。最大14日かつ合計20MBで古いものから削除する。 |
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
| 管理用バックアップ | `<root>/backups/` | 承認済み。マイグレーション前と復元前に限定する |
| 設定、ログ、保留中の復元 | `<root>/settings/`、`<root>/logs/`、`<root>/pending-restore/` | 保存形式とメタデータの詳細は実装 task で決める |
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

### 終了

1. 最後の主ウィンドウに対する終了要求を受ける。
2. 未保存状態がある場合は「保存して終了」「保存せず終了」「戻る」を画面側で確認する。保存に失敗した場合は終了せず、未保存状態を維持する。
3. 終了が確定した場合だけ、シェルがサイドカーとアプリ所有の子プロセスを停止する。
4. 観測した子孫プロセス全体が終了したことを確認し、孤立プロセスを残さない。

シェル内部に複数のプロセスが存在すること自体は失敗条件にしない。アプリが所有するプロセスの範囲、終了対象、終了後に空になったプロセスツリーを分けて記録する。

## データとネットワークの境界

- 稼働 SQLite をノートデータの唯一の正本とする。
- ノートの作成、編集、閲覧、検索、復習、保存、バックアップ / 復元はオフラインで動作させる。
- ネットワーク通信は更新マニフェストの確認と更新パッケージの取得に限る。更新提供元、マニフェスト / パッケージの配置、署名方式は未決定である。
- 現行 MVP の `/notes`、`/notes/new`、`/notes/[id]`、`/backup`、API、明示保存、確認付き物理削除、復習、`CanvasDocumentV1`、旧形式の Markdown 互換を変更しない。
- アプリバンドルの更新、再インストール、通常のアンインストールで稼働 DB、管理用バックアップ、設定を暗黙に削除しない。
- 開発・検証用の Next.js Web 起動経路を維持する。開発 Web とパッケージ済み Tauri の実行環境で、保存先と DB を共有しない。

## 実装の順序

1. `ユーザーデータ / SQLite 初期化`: 保存先の決定、初回 DB、スキーマ状態、実行環境への絶対パスの受け渡し。
2. `単一ウィンドウのライフサイクル`: 単一インスタンス、二重起動時の表示、ウィンドウ状態、サイドカーの所有権、終了処理。
3. `Settings`: General、Updates、Data and Backup の入口と、現行 `/backup` からの段階移行。
4. `更新 / マイグレーション`: バックグラウンドでのダウンロード、明示的な再起動、マイグレーション前の安全確保用バックアップ、隔離環境でのマイグレーション、失敗時の現行版維持。
5. `バックアップ / 復元`: 手動 SQLite 書き出し、管理用バックアップと外部ファイルの別入口、検証、アトミックな切り替え、再オープン。
6. `削除 / 診断`: 完全なデータ削除、ローカルログの保持、診断 ZIP、起動失敗時の画面。
7. `パッケージ済み Desktop Alpha の品質確認`: Apple Silicon のパッケージ済みアプリで、現行 MVP と Desktop Alpha 契約を結合確認する。

この順序に Phase 2 の Canvas PNG、検索サジェスト、大規模一覧、自動保存、Undo、専用復習 task、NoteCard / D&D を追加しない。

## 発注者の承認が必要な項目

- 開発専用の識別子と製品の識別子を分ける命名方針。
- bundle ID またはユーザーデータのルートを将来変更する場合の移行対象、旧保存先の保持期間、失敗時の復旧方針。
- 次の実装 task で使う設定の保存形式と、保留中の復元メタデータの最小項目。

## 次のユーザーデータ / SQLite 初期化実装 task が受け取る入力

1. 承認済みの製品識別子と製品ソースディレクトリ。
2. PoC ディレクトリを参照しないパッケージ / リソースの境界。
3. 承認済みの Application Support ルートと相対レイアウト。
4. 稼働 DB の絶対パス、初回 DB 作成条件、既存 DB がない場合の復旧条件。
5. `DATABASE_URL` をサイドカーへ渡す境界。画面側にはパスを公開しない。
6. 管理用バックアップと保留中の復元を初期化 task で扱うか、後続 task に残すかという責務分担。

## 未決事項

| 項目 | 状態 | 次に必要な判断 |
|---|---|---|
| 製品 bundle ID | `APPROVED`: `com.cornellmethod.notebook` | 実装 task の入力とする |
| 製品実装ディレクトリ | `APPROVED`: `src-tauri/` | PoC と分離した製品配置として使う |
| Application Support 内の保存先 | `APPROVED`: 識別子の名前空間と `live` / `backups` / `settings` / `logs` / `pending-restore` | 保存形式とメタデータの詳細を実装 task で決める |
| 開発用識別子と保存先 | `UNDECIDED` | 製品と分離する命名規則の承認 |
| Node.js サイドカーの同梱方式 | `UNDECIDED` | パッケージ済み実行環境とネイティブ依存関係の配布設計 |
| 最低対応 macOS | `UNDECIDED` | Tauri の実行環境と Apple Silicon の結合確認 |
| 更新提供元、マニフェスト / パッケージの配置 | `UNDECIDED` | 更新設計。Desktop Alpha では独自ドメインを前提にしない |
| パッケージ署名、完全性検証、Developer ID、公証（notarization） | `UNDECIDED` | Desktop Alpha と Public Mac Release の判断範囲を分ける |
| 画面操作の自動化 | PoC `BLOCKED` | パッケージ済み画面の Alpha 品質確認で使う検証方法 |

## 次に読むファイル

- `doc/implementation/POST_MVP_IMPLEMENTATION_PLAN.md` §7〜§8
- `doc/technical/TARGET_ARCHITECTURE.md` の Desktop shell / ローカル実行環境 / 保存領域の境界
- `doc/requirements/MVP_CONTRACT.md`
- `HANDOFF_2026-08-17.md`
