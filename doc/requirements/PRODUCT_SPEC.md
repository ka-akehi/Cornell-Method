# Cornell Method Notebook 製品仕様書

確認日: 2026-08-08

## 文書の位置づけと正本ルール

この文書は、Cornell Method Notebook の製品概要、製品原則、現行 MVP と将来ロードマップの境界を定めます。個別 API の request / response、Prisma の field、画面 selector、migration SQL、個別のテスト手順は、各詳細設計書で定義します。

文書の役割は次のとおりです。

| 文書 | 正本とする内容 |
| --- | --- |
| `AGENTS.md` | エージェントの作業指示、開発制約、Manager / Worker 運用、正本一覧、短い製品境界 |
| `doc/requirements/PRODUCT_SPEC.md` | 製品全体の方針、対象ユーザー、成功条件、MVP / Phase 2 / 将来ロードマップ、配布・保存方針 |
| `doc/requirements/MVP_SYSTEM_SPEC.md` | 現行 MVP の業務要件・機能要件 |
| `doc/implementation/MVP_CONTRACT.md` | 現行 MVP の canonical route、API、保存・削除・復習方式、実装・受け入れ契約 |
| `doc/technical/`、`doc/data/`、`doc/api/`、`doc/screens/`、`doc/workflows/`、`doc/testing/` | 各領域の詳細設計、検証観点、実装状態 |

製品全体の方針とロードマップについては本書を参照します。現行 MVP の実装と受け入れの判断では `MVP_CONTRACT.md` を優先し、業務要件は `MVP_SYSTEM_SPEC.md` を起点にします。製品ロードマップと現行 MVP の契約が異なる場合も、現行 MVP の契約は変更しません。変更が必要なら、別の仕様更新として扱います。

## 製品概要、対象ユーザー、利用目的、成功条件

Cornell Method Notebook は、学習者が Cornell Method の形式で学習記録を作成し、後から検索・閲覧・復習できるローカル個人利用向けのノートアプリです。

- 対象ユーザーは、自分の学習記録を自分の端末で管理する個人です。認証・ユーザー管理・共有を前提にしません。
- 利用目的は、学習内容を Cue で問いに整理し、中央の本文領域へ自由に記録し、Summary で要点を振り返れるようにすることです。
- 初期テンプレートは Cornell のみとし、将来テンプレートを追加できる構造にします。
- 成功条件は、ノートの作成・編集・閲覧、Cue / Summary の記録、Canvas 本文の保存と再表示、タグ・日付による検索、復習、手動バックアップまでの学習サイクルが一貫して利用できることです。
- 現行 MVP は明示保存を基本とし、将来のドラフト自動保存などは別の Phase として扱います。

## 製品原則

### Local-first と個人利用

- ノートデータの唯一の正本（canonical source of truth）は SQLite です。現行 MVP、Phase 2、将来のデスクトップ版のいずれでも、この境界を変更しません。
- クラウド DB、クラウド同期、オンラインサービス、外部 API、常時ネットワーク接続は製品スコープ外です。ローカル PC 上で完結することを基本とし、これらを将来実装予定の機能として扱いません。
- 認証、マルチユーザー、共有、コメントは製品の基本スコープに含めません。

### 配布経路と開発形態

- 将来の主な配布経路は、ユーザーがダウンロードして起動する Mac デスクトップアプリです。
- 開発・検証用の Next.js Web 起動形態は維持します。
- デスクトップ shell はまだ確定していません。Electron を最短経路候補、Tauri + Node.js sidecar を代替候補として比較し、Desktop PoC 後に採用と実装着手を判断します。

### 学習体験と保存

- Cornell の Cue と Summary（要約・次の行動）は Markdown を基本とし、本文は自由配置 Canvas を中心に扱います。
- Canvas の保存形式は共有 `CanvasDocumentV1` 契約を使い、描画ライブラリの内部形式を製品仕様そのものにしません。
- 既存の Markdown 本文データは互換表示のために保持し、Canvas 化を理由に既存データを自動変換しません。
- 内部データはユーザーデータディレクトリ内の SQLite に保存します。SQLite のバックアップはデータベースのコピーであり、ノートの外部出力とは別の保存単位です。
- アプリ外へノートを保存・持ち出す外部出力は、SQLite から生成する PDF を基本とします。PDF は編集用データ形式でも復元用の正本でもなく、PDF から SQLite へ戻すインポートや双方向同期は行いません。
- MVP で実装する保存、削除、復習、バックアップの範囲を契約で明示し、将来機能を現行 MVP に混ぜません。

## 現行 MVP / Phase 2 / 将来構想の境界

### 現行 MVP

現行 MVP は、ローカル個人利用で学習記録の基本サイクルを成立させる範囲です。

- ノートの新規作成、一覧、詳細閲覧、編集、確認付き削除。
- Cornell の Cue リスト、CanvasDocumentV1 のフリー入力本文、Markdown の Summary、タイトル・学習日・学習元・タグ・次回復習日の記録。
- Canvas 本文の保存・復元と、Canvas 内テキストを含む検索。
- タイトル・本文・Summary・Cue、日付、タグを使った一覧検索と、手動で管理する復習対象の確認。
- 詳細画面内の閲覧・編集・復習モード。
- ユーザーが実行する明示保存、SQLite DB の手動バックアップ、最新 3 世代の確認。
- 削除確認後の物理削除。削除後の復元は保証しません。

現行 MVP の canonical route、API、データモデル、保存・削除・復習・バックアップの受け入れ条件は `doc/implementation/MVP_CONTRACT.md` を正本とします。自動保存、起動時自動バックアップ、Undo、soft delete、専用復習タスク画面は現行 MVP に含めません。

現行 MVP のノートデータは SQLite のみを正本とします。SQLite DB の手動バックアップは実装対象ですが、PDF 生成・外部出力はまだ実装せず、MVP の完了条件にも含めません。

### Phase 2

Phase 2 では、MVP の学習サイクルを維持したまま、編集の継続性、復習の自動化、コンテンツ整理、出力・運用を拡張します。

Phase 2 でもノートデータの唯一の正本は SQLite です。追加機能は SQLite の正本を読み書きし、PDF はそこから生成する派生出力として扱います。

- ドラフト、自動保存、差分保存、楽観ロック、競合時の再読み込み・再試行。
- soft delete、削除後の短時間 Undo、期限切れデータの purge。
- 1 日後 / 1 週間後の専用復習タスク、完了状態、未完了タスクの表示、spaced repetition の拡張。
- NoteCard、Cue と本文の関連付け、非表示状態、ドラッグ＆ドロップ並び替え。
- タグの名称変更・削除を含む管理 UI、タグ管理の拡張。
- SQLite のノートデータから PDF を生成する外部出力、バックアップ履歴・ログ・再試行、起動時自動バックアップ。PDF 出力は派生物であり、編集・復元・SQLite との双方向同期には使いません。具体的な出力先は未決定のまま、実装時に別途定義します。
- モバイル向けの編集最適化と、MVP で定義していない高度なキーボード操作。

これらは製品ロードマップです。実装着手の前提として、`MVP_CONTRACT.md` の Phase 2 境界と、影響する API・データ・画面・テスト設計の更新が必要です。

### 将来構想

- Desktop PoC で、Mac デスクトップ配布に用いる shell、ユーザーデータ領域、更新、署名、復元の方式を確定します。SQLite は唯一の正本としてアプリ本体から分離し、未決定の PDF 出力先は別途定義します。
- Local LLM を使った復習クイズや Cue / キーワード候補の提案を検討します。ユーザーの想起・判断を補助する機能として扱い、Cue の自動入力や外部 API 依存を前提にしません。
- 過去に検討したクラウド基盤・オンライン公開・端末間同期の案は採用しません。これらは製品ロードマップや実装予定として保持しません。

## 高レベル機能マップ

| 領域 | 製品上の役割 | 現在の位置づけ |
| --- | --- | --- |
| ノート作成・編集・閲覧 | 学習記録を作成し、保存済みノートを読み返す中心機能 | MVP |
| Cue / Summary | Cue で問いを整理し、Summary で要点と次の行動を振り返る | MVP。Markdown の詳細は MVP 設計書 |
| Canvas 本文 | 文字・図形・線・ストロークを自由配置し、学習内容を紙面のように記録する | MVP。`CanvasDocumentV1` の詳細は契約・Canvas 設計書 |
| タグ・検索 | タグ、日付、タイトル、本文、Cue、Summary 等からノートを見つける | MVP。詳細な検索条件は API / data 設計書 |
| 復習 | 手動の次回復習日と詳細画面内の想起モードで復習する | MVP。自動タスクは Phase 2 |
| バックアップ | SQLite データベースのコピーを作成し、データ保全を支える | MVP。自動履歴・retry は Phase 2 |
| 外部出力 | SQLite から生成する派生 PDF。PDF は編集用正本・復元用データではない | Phase 2。PDF 生成は未実装、出力先は未決定 |
| テンプレート | Cornell を初期テンプレートとし、追加テンプレートを将来受け入れる | Cornell は MVP、拡張は将来 |

## 配布・保存方針

将来のデスクトップ配布では、実行環境と書き込み可能なユーザーデータを分離します。全設計書で次の用語を使います。

| 境界 | 保存するもの | 方針 |
| --- | --- | --- |
| `app bundle` | 実行コード、Next.js 資産、Prisma Client / migration、必要な runtime / driver、配布資産 | `.app` 内は配布物として扱い、live SQLite DB やユーザー編集データを書き込まない |
| `user data directory` | SQLite の live DB、DB backup、アプリ設定、ログ等 | macOS の OS 管理ユーザーデータ領域を基本とし、初回起動時に作成・初期化する。`Downloads` は既定保存先にしない |
| `PDF output destination` | SQLite から生成した PDF | user data directory や app bundle とは別の外部出力境界。具体的な保存先は未決定で、既存仕様の確定前に固定しない |

SQLite の live file は `.app` 内に置きません。初回起動時に `user data directory` を作成して bundled migration を適用し、app bundle の更新と user data の migration を分離します。アプリ更新でユーザーデータを消さず、アンインストールとユーザーデータ削除は別操作として扱います。

SQLite の live DB は `user data directory` 内の唯一の正本です。DB backup はこの SQLite のコピーとして同じデータを保全し、PDF output は SQLite から一方向に生成する派生出力です。PDF を編集して SQLite を更新する運用、PDF からの復元、双方向同期は対象外です。PDF の具体的な出力先は未決定です。

## 非目標・制約

- 認証、ユーザー管理、マルチユーザー、共有、コメント、共同編集は対象外です。
- 画像やファイルの添付は対象外とし、基本はテキストと Canvas 要素を扱います。
- クラウド DB、クラウド同期、オンラインサービス、外部 API、常時ネットワーク接続は製品スコープ外です。
- 現行 MVP に Phase 2 の自動保存、Undo / soft delete、専用復習タスク、NoteCard / D&D、PDF export、起動時自動バックアップを持ち込みません。
- `.app` 内へ live SQLite やユーザー編集データを書き込みません。SQLite を同期フォルダへ置く設計は採用しません。
- PDF は SQLite から生成する派生出力に限り、編集用データ形式、復元用正本、SQLite との双方向同期対象にはしません。
- 製品全体の方針書で API payload、DB field、CSS selector、migration、個別テスト手順を再定義しません。詳細は対応する正本へリンクします。

## 製品レベルの未決事項・ロードマップ

以下は現時点で決定していない製品レベルの事項です。発注者の判断なしに実装方針を推測しません。

| ID | 未決事項 | 判断のタイミング |
| --- | --- | --- |
| U-001 | Desktop shell を Electron と Tauri + Node.js sidecar のどちらにするか | Desktop PoC |
| U-002 | `user data directory` の具体的な path と PDF output destination をどう定義するか | Desktop shell の path resolver / PDF export 設計 |
| U-003 | PDF のレイアウト、生成 provider、失敗時の扱いをどう定義するか | Phase 2 の PDF export 設計 |
| U-004 | Apple Silicon / Intel の配布、署名、更新と、SQLite / Prisma native runtime、Playwright / Chromium の同梱をどう検証するか | Desktop 配布・署名・更新 PoC |

将来の学習支援機能は、Local LLM による復習クイズを復習時の想起支援、Cue 候補提案をノート整理時の補助として分けて検討します。どちらもユーザーの判断を必須とし、現時点の MVP / Phase 2 実装タスクには含めません。

- 復習クイズは、ユーザーが生成操作を明示したときに解くオンデマンド機能を初期案とし、初期段階では生成結果を必ずしも保存しません。採点よりも答え合わせ・根拠・解説を重視します。
- Cue 候補は、ユーザーが先に自分の Cue を書いた後に不足候補を提示する補助とし、自動採用しません。ユーザーが追加、編集して追加、無視を選べることを前提にします。

## 詳細設計書へのリンク

### 現行 MVP の要件・契約

- [MVP システム仕様](MVP_SYSTEM_SPEC.md)
- [現行 MVP 契約](../implementation/MVP_CONTRACT.md)
- [実装状況](../implementation/IMPLEMENTATION_STATUS.md)
- [MVP テストシナリオ](../testing/TEST_SCENARIOS.md)

### 領域別の詳細設計

- [データ設計](../data/MVP_DATA_DESIGN.md)
- [API 設計](../api/MVP_API_DESIGN.md)
- [画面設計](../screens/MVP_SCREEN_DESIGN.md)
- [NTE-020 新規ノートレイアウト方針](../screens/NTE_020_NEW_NOTE_LAYOUT_POLICY.md)
- [業務フロー](../workflows/MVP_WORKFLOW_DESIGN.md)
- [MVP 技術設計](../technical/MVP_TECHNICAL_DESIGN.md)
- [ターゲットアーキテクチャ](../technical/TARGET_ARCHITECTURE.md)
- [設計ツール運用ガイド](../technical/MVP_DESIGN_TOOLING_GUIDE.md)

### 履歴・レビュー資料

- [MVP / Phase 2 分類案](MVP_CLASSIFICATION_DRAFT.md)
- [設計レビュー計画](../review/DESIGN_REVIEW_PLAN.md)
- [As-Is 設計棚卸し](../review/AS_IS_DESIGN_INVENTORY.md)

これらのレビュー・分類資料は、作成時点の判断や棚卸し結果を保持する履歴資料です。現在の製品全体方針の正本は本書、現行 MVP の実装と受け入れの判断の正本は `MVP_CONTRACT.md` です。
