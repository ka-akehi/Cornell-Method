# MVP システム仕様書

確認日: 2026-08-24

## 文書の位置づけ

本書は、Cornell Method Notebook の現行 MVP の業務要件と機能要件を定義します。

製品全体の方針とロードマップの正本は `doc/requirements/PRODUCT_SPEC.md` です。現行 MVP の実装と受け入れの判断では、`doc/implementation/MVP_CONTRACT.md` を正本とします。MVP の詳細は、本書と次の関連設計書を参照します。

- `doc/requirements/PRODUCT_SPEC.md`
- `doc/data/MVP_DATA_DESIGN.md`
- `doc/api/MVP_API_DESIGN.md`
- `doc/screens/MVP_SCREEN_DESIGN.md`
- `doc/workflows/MVP_WORKFLOW_DESIGN.md`
- `doc/screens/MVP_SCREEN_INVENTORY.md`
- `doc/diagrams/MVP_UML_DESIGN.md`
- `doc/diagrams/MVP_BUSINESS_FLOW_DIAGRAMS.md`
- `doc/diagrams/MVP_SEQUENCE_DIAGRAMS.md`
- `doc/diagrams/MVP_STATE_DIAGRAMS.md`
- `doc/diagrams/MVP_ER_DIAGRAM.md`
- `doc/diagrams/MVP_SCREEN_TRANSITION_DIAGRAM.md`
- `doc/technical/MVP_TECHNICAL_DESIGN.md`
- `doc/technical/MVP_DESIGN_TOOLING_GUIDE.md`
- `doc/implementation/MVP_IMPLEMENTATION_TASKS.md`
- `doc/implementation/MVP_CONTRACT.md`

参照先は、製品全体の方針が `PRODUCT_SPEC.md`、現行 MVP の要件が本書、現行 MVP の実装・受け入れ契約が `MVP_CONTRACT.md` です。内容が異なる場合、MVP の実装・受け入れでは `MVP_CONTRACT.md` を優先し、将来要件や製品全体方針は `PRODUCT_SPEC.md` を参照します。

本書では、MVP で実現する内容、MVP の範囲、対象外の機能を定義します。詳細な DB カラム、API request / response、画面項目は、各設計書で定義します。

MVP 仕様書群の役割分担は以下です。

| 文書 | 主な役割 |
| --- | --- |
| `doc/requirements/PRODUCT_SPEC.md` | 製品全体の方針、対象ユーザー、MVP / Phase 2 / 将来ロードマップ、配布・保存方針 |
| `doc/requirements/MVP_SYSTEM_SPEC.md` | MVP の目的、スコープ、Phase 2 境界、主要要件の入口 |
| `doc/workflows/MVP_WORKFLOW_DESIGN.md` | 利用者の業務フロー、操作順序、判断分岐、運用ルール |
| `doc/screens/MVP_SCREEN_INVENTORY.md` | 画面単位の棚卸し、Action / Data、画面と API の対応 |
| `doc/diagrams/MVP_UML_DESIGN.md` | 図別設計書への index / 目次 |
| `doc/diagrams/MVP_BUSINESS_FLOW_DIAGRAMS.md` | 学習記録作成、検索・閲覧、復習、削除、バックアップの業務フロー図 |
| `doc/diagrams/MVP_SEQUENCE_DIAGRAMS.md` | ノート作成、検索、編集、復習済み更新、バックアップ作成のシーケンス図 |
| `doc/diagrams/MVP_STATE_DIAGRAMS.md` | 詳細画面モード、ノート復習状態の状態遷移図 |
| `doc/diagrams/MVP_ER_DIAGRAM.md` | Notebook / NotebookCanvas / Cue / Tag / NotebookTag のデータ関係図 |
| `doc/diagrams/MVP_SCREEN_TRANSITION_DIAGRAM.md` | `/notes`, `/notes/new`, `/notes/[id]`, `/backup` の画面遷移図 |
| `doc/data/MVP_DATA_DESIGN.md` | MVP データモデル、採用 / 非採用エンティティ |
| `doc/api/MVP_API_DESIGN.md` | MVP API の request / response、エラー、MVP 外 API |
| `doc/screens/MVP_SCREEN_DESIGN.md` | 画面構成、表示要素、主要アクション、遷移 |
| `doc/technical/MVP_TECHNICAL_DESIGN.md` | 技術構成、実装方針、検証方針 |
| `doc/technical/MVP_DESIGN_TOOLING_GUIDE.md` | 外部ツール / 参考リソースの使いどころ、成果物受け渡し、レビュー時の注意 |
| `doc/implementation/MVP_CONTRACT.md` | 現行 MVP の実装・受け入れ契約、canonical route、保存・削除・復習方式 |
| `doc/implementation/MVP_IMPLEMENTATION_TASKS.md` | Worker タスク分割、実装順序、完了条件 |

## システム概要

Cornell Method Notebook は、ローカル個人利用向けの学習ノートアプリです。

将来は Mac デスクトップアプリを主な配布形態とします。開発と検証には Next.js Web 起動形態も維持します。現行 MVP、Phase 2、将来のデスクトップ版のいずれでも、ノートデータの唯一の正本は各ユーザーの Mac 内 SQLite です。クラウド DB、クラウド同期、オンラインサービスは製品スコープ外とします。

保存境界は次のとおりです。

| 境界 | 要件 |
| --- | --- |
| `app bundle` | 実行コード、Next.js 資産、Prisma Client / migration、必要な runtime / driver を含む。インストールされた `.app` 内に SQLite の live file やユーザーデータを置かない |
| `user data directory` | SQLite DB、DB backup、アプリ設定、ログ等の書き込み可能データを置く。OS のユーザーデータ領域を基本とし、初回起動時に作成・初期化する。`Downloads` を既定にしない |
| `Canvas PNG output destination` | Desktop Alpha 後に実装する Canvas PNG の外部出力領域。具体的な保存先は未決定で、この文書では固定しない |

アプリ更新では app bundle の更新と user data の migration を分離し、ユーザーデータを保持します。アンインストールとデータ削除も別の操作とします。Desktop PoC の比較を経て、Desktop Alpha の shell は 2026-08-17 に Tauri + Node.js sidecar を選定済みです。

ユーザーは、コーネルメソッドの形式に沿って、学習内容を以下の単位で記録します。

- タイトル、学習日、学習元
- Markdown 形式の Cue
- `CanvasDocumentV1` の自由配置 Canvas 本文
- Markdown 形式の Summary
- タグ
- 次回復習日と復習済み日時

MVP では、ノート作成、検索、閲覧、編集、復習、バックアップまでの学習サイクルを最小構成で成立させます。MVP Gate 0 と人力結合テストは完了済みです。次の実装段階は Desktop Alpha であり、Desktop Alpha の完成後に Canvas PNG と検索・一覧の規模対応を実装します。autosave、Undo、専用復習タスク、NoteCard / D&D 等は未採用候補です。PDF export は未実装で、現在は採用していません。

## 利用者 / 利用シーン

### 利用者

想定利用者は、このアプリをローカル PC で個人利用する 1 名です。

MVP では以下の利用者を想定しません。

- 複数ユーザー
- 共有利用者
- 管理者
- 閲覧専用ユーザー
- 外部サービス利用者

### 利用シーン

主な利用シーンは以下です。

| 利用シーン | 内容 |
| --- | --- |
| 学習直後の記録 | 書籍、講義、動画、記事などの内容をコーネル形式で記録する |
| 後日の検索 | タイトル、本文、Cue、サマリー、タグ、日付で過去ノートを探す |
| 想起練習 | Cue を手がかりに本文を想起し、本文を表示して確認した後に Summary を開く |
| 復習管理 | 次回復習日をもとに復習対象を確認し、復習済みにする |
| ローカル保全 | SQLite DB ファイルのバックアップを作成し、破損や誤操作に備える |

## 業務目的 / 成功条件

### 業務目的

MVP の業務目的は、ユーザーが日々の学習を「記録、整理、要約、想起、復習」の流れで継続できることです。

この目的に合わせ、ノート管理機能はコーネルメソッドの学習サイクルに必要な範囲へ絞ります。

### 成功条件

MVP は以下を満たしたとき成功とみなします。

- ノートを新規作成できる。
- 作成したノートを一覧で確認できる。
- ノートをタイトル、日付、タグ、復習対象で絞り込める。
- ノートを詳細画面で閲覧できる。
- ノートを編集して保存できる。
- Cue、Canvas 本文、Summary をコーネルメソッドに沿った構造で扱える。
- 新規ノートの Canvas 本文を Canvas editor で入力・保存し、Canvas viewer で再表示できる。
- Cue と Summary を Markdown として編集・保存し、安全に表示できる。
- `bodyMode=markdown` の既存ノートを互換表示でき、Canvas へ自動変換しない。
- 復習モードの開始時は Cue を表示し、本文と Summary の内容を初期非表示にできる。
- 本文を表示して確認した後にだけ Summary を開ける。
- 復習済みとして `reviewedAt` と `nextReviewDate` を更新できる。
- SQLite DB のバックアップを作成し、最新 3 世代を保持できる。
- デスクトップ配布を行う場合、SQLite の live file が `.app` 外の user data directory にあり、アプリ更新で既存データが失われない境界を確認できる。
- `npm run lint`、`npm run build`、Prisma 関連コマンドで基本検証できる。

## 業務範囲

### MVP の業務範囲

MVP で扱う業務範囲は以下です。

| 業務 | MVP で扱う内容 |
| --- | --- |
| ノート記録 | コーネル形式で学習ノートを作成する |
| ノート整理 | タグ、学習元、Cue、サマリーを登録する |
| ノート検索 | フリーワード、日付範囲、タグ、復習対象で絞り込む |
| ノート閲覧 | Canvas 本文を viewer で表示する。既存 Markdown 本文は互換表示し、Cue / Summary は Markdown として安全に表示する |
| ノート編集 | 保存済みノートを更新する |
| ノート削除 | 確認後に物理削除する |
| 復習 | Cue で想起し、本文を表示して確認した後に Summary を開き、復習済みにする |
| バックアップ | DB ファイルを `backup/` 配下へコピーし、最新 3 世代を保持する |
| 保存場所 | 現行 MVP はローカル SQLite。Desktop 配布時も user data directory に live DB を置き、SQLite を唯一の正本とする |

### MVP で扱わない業務範囲

以下は MVP では扱いません。

- ユーザー管理、認証、権限管理
- ノート共有、コメント、共同編集
- 画像、ファイル添付
- PDF 出力、HTML エクスポート
- バックアップからの自動復元
- 復習スケジュールの自動生成
- 専用の復習タスク画面
- タグ管理専用画面
- オンライン同期、外部 API 連携
- クラウド DB、クラウド同期、オンラインサービスへの接続や本番デプロイ。過去の Vercel / Supabase 等の検討は採用しない履歴であり、将来実装予定にはしない
- ノートファイルを正本にした file-only / hybrid 運用。現行 MVP は外部出力を持たず、Desktop Alpha 後の最初の外部出力には Canvas PNG を採用する。PDF export は現在未採用とする

## MVP スコープ

MVP スコープは、既存 MVP 設計書で発注者承認済みの判断に合わせます。

| 領域 | MVP で実装すること | 判断基準 |
| --- | --- | --- |
| ノート構造 | 新規本文は `bodyMode=canvas` とし、`NotebookCanvas.documentJson` に `CanvasDocumentV1` を保存する。`Notebook.body` は空文字とする | 自由配置 Canvas を現行本文の正本にするため |
| 既存本文互換 | `bodyMode=markdown` と `Notebook.body` を既存ノートの互換モードとして保持する | 既存データを壊さず、Canvas へ自動変換しないため |
| Cue | キーワード / 質問のリストとして保存する | 想起の手がかりを残すため |
| Cue と本文の関連 | 厳密リンクは持たない | 厳密リンクがなくても Cue を手がかりに想起でき、実装コストを抑えられるため |
| タグ | 正規化して `Tag` / `NotebookTag` で扱う | 検索・分類の基本機能として必要なため |
| 復習 | `nextReviewDate` と `reviewedAt` で管理する | 自動間隔反復なしでも復習サイクルを回せるため |
| 本文 UI | `bodyMode=canvas` は Canvas editor / viewer で扱う | Canvas 本文を Markdown textarea / preview の対象にしないため |
| Cue / Summary | 編集画面では Markdown の textarea / Markdown Preview で編集・表示し、詳細画面の Summary は操作可能な読み取り領域で表示する | Cue と Summary の既存 Markdown 契約と、編集 Preview・詳細表示の責務を分けるため |
| API | Next.js Route Handler で JSON API を実装する | UI / API / Prisma を TypeScript で揃えるため |
| DB | Prisma + SQLite を採用する | ローカル個人利用に適しているため |
| バックアップ | DB ファイルコピーと最新 3 世代保持 | 個人利用で最低限のデータ保全を行うため |

## Desktop Alpha と後続機能の境界

現行 MVP の route、API、DB、Canvas、明示保存、物理削除、復習、手動 backup は変更しません。MVP Gate 0 の次は Desktop Alpha を実装し、追加機能は Desktop Alpha の完成後に扱います。実装順と依存関係の正本は `doc/implementation/POST_MVP_IMPLEMENTATION_PLAN.md` です。

| 段階 | 現在の判断 | 現行 MVP との境界 |
| --- | --- | --- |
| Desktop PoC | Electron と Tauri + Node.js sidecar の同条件比較・shell 選定は完了（2026-08-17）。現行の選定は Tauri + Node.js sidecar | 製品機能を追加せず、PDF / Playwright / Chromium を blocker や必須受け入れ条件にしない |
| Desktop Alpha | Tauri + Node.js sidecar を shell に採用済み。lifecycle、Settings、更新、migration、backup / restore、完全なデータ削除、診断、障害時挙動、privacy の契約を採用済み。更新 backend は provider / manifest / compatible selection / 公開 URL 境界 / download / signature・SHA-256 / archive・bundle validation / update state / pending verification、`apply_verified_update`（引数なしの明示 command）と `ApplyPreparation` / explicit restart handoff、staged migration / read-back / atomic DB switch、candidate health、bundle switch、rollback / SQLite restore / recovery、checkpoint、cleanup まで実装済み。実 provider / package runtime、macOS packaged app、packaged Apple Silicon GUI による runtime acceptance は未検証。Settings UI の更新接続、backup / restore、完全なデータ削除、診断の操作は未完了 | 現行 MVP を Mac アプリとして包み、route、API、明示保存等を維持する |
| Desktop Alpha 後 | Canvas PNG と検索サジェスト・大規模一覧対応を採用済み | 実装・検証は未着手。現行 MVP の検索 API と 1 ページ 50 件の契約はこの文書同期で変更しない |
| 採否未決 | autosave、Undo / soft delete、専用復習タスク、NoteCard / D&D、定期 backup、PDF export 等 | 発注者が採用するまで仕様・実装 task を開始しない |

### Desktop PoC と Desktop Alpha

- Desktop PoC は、同じ現行 MVP baseline、同じ deterministic な 10,000 note fixture、同じ Apple Silicon Mac で行います。起動速度、操作反応、shell の main / core、renderer / WebView、local runtime、Node.js sidecar、framework helper、関連子 process の合計メモリ、成立性、保守性、安全性、配布・更新、総コストを同じ測定条件で比較します。framework が必要とする内部 process を許容し、OS process が複数存在することだけを不合格理由にしません。
- Desktop Alpha は single application instance / 1 primary window とします。Settings modal、確認 dialog、OS file dialog は primary window に数えず、新しい独立 primary window を作りません。
- 二重起動時は新しい application instance / primary window を増やさず、既存 primary window を前面へ出します。最後の primary window を閉じると application instance を終了し、local runtime と app-owned child process をすべて停止して orphan process を残しません。
- dirty な状態で終了する場合は、保存して終了、保存せず終了、終了取消しの 3 結果を提供します。現行正本の取消し操作は「戻る」で、Escape と dialog 外操作も取消しとして扱います。更新適用時は、保存して更新、保存せず更新、更新取消しを別の操作契約として扱います。
- Desktop Alpha の Settings modal は General、Updates、Data and Backup で構成します。現行 MVP の `/backup` は、Settings modal の代替機能が完成して受け入れ確認を通るまで維持します。
- 初期配布は DMG とし、更新は起動後に最大 1 日 1 回だけ非同期確認します。手動確認も提供し、確認の ON / OFF 設定は設けません。package は background download し、ユーザーが明示した「再起動して更新」で適用します。
- 更新確認または download に失敗しても現行版を利用可能にし、次の定期確認または手動確認で更新処理全体を再試行します。更新 manifest の送受信は更新判定に必要な最小情報に限り、ノート本文、Cue、Summary、タイトル、タグ、学習元、SQLite、backup、診断 log を送りません。
- pending migration がある更新だけ、適用直前に app 管理 safety backup を作ります。migration は staging copy へ古い順に適用し、検証と reopen に成功した場合だけ live DB と新しい app へ切り替えます。失敗時は現行 app と live DB を維持します。
- migration 前と restore 前に作成する app 管理 safety backup は最新 3 世代を保持します。定期・日次・通常起動時の自動 backup は Desktop Alpha の必須要件にしません。
- Data and Backup では、手動 SQLite export、app 管理 backup からの復元、外部 backup file からの復元を別の操作として提供します。restore 前に live DB の safety backup を作り、SQLite integrity、foreign key、schema / migration compatibility、必須データ、Canvas、reopen の検証に失敗した file は適用しません。
- 現行 app より新しい schema の backup はその場で復元せず、compatible な更新後にユーザーが再開する pending restore とします。
- 完全なデータ削除は live DB、app 管理 backup、設定を対象とし、外部 SQLite export は削除しません。
- 起動時に DB を開けない場合は通常のノート UI を開かず、復旧導線を優先します。診断 bundle はユーザーの明示操作で local にだけ作成し、自動送信しません。ノート本文、Cue、Summary、タイトル、タグ、学習元、SQLite、backup、Canvas JSON、検索文字列を含めません。
- local SQLite は macOS の file permission と FileVault を前提とし、Desktop Alpha で独自 DB 暗号化を必須にしません。

### Desktop Alpha 後に採用済みの機能

Canvas PNG は、保存済み `CanvasDocumentV1.page.width` × `page.height` の用紙全体を同じ寸法で画像化します。対象は現在の paper 背景を含む Canvas の用紙だけで、アプリ UI、Cue、Summary を含めません。用紙外の要素部分は切り取り、legacy Markdown 本文は対象にしません。初期ファイル名は `[タイトル]_[学習日].png` とし、その文字列を画像内へ描画しません。使用不可文字、同名 file、保存先、失敗時 UI、色管理は未決定です。PDF export は現在未採用で、再検討するかも未決定です。

検索改善では、既存の tag 専用 filter を維持し、tag を検索対象 selector に含めません。検索対象は単一選択で、既定値をタイトルとし、タイトル、学習元、本文、Cue、すべてを基本候補にします。「すべて」はタイトル、学習元、本文、Cue を検索します。サジェストはノート card ではなく、選択範囲の local data に存在する語句候補です。1 文字目から最大 5 件を返し、前方一致を優先します。外部辞書 API と telemetry は使わず、debounce は 10,000 件での実測により必要な場合だけ導入します。

長期利用の最低目標は 5,000 件とし、deterministic な 10,000 note fixture で性能余裕を確認します。一覧は追加読み込み型の無限スクロールとし、virtualization または同等の windowing で DOM 要素数を制限します。Summary の検索対象分類、tokenization、同順位、API / index、取得単位、仮想化方式は未決定です。

### 採否未決の候補

autosave、draft、version・競合処理、Undo / soft delete、専用復習タスク、タグ管理 mutation、NoteCard、Cue と本文の ID link、hidden flag、D&D、定期 backup、暗号化 backup は未採用です。`NoteCard`、`CueCard`、`NoteCueLink` は現行 MVP に存在せず、legacy `Notebook.body` や `CanvasDocumentV1` をカードへ自動変換する判断もしていません。

## 主要業務フロー概要

業務フロー、判断分岐、運用ルールの正本は `doc/workflows/MVP_WORKFLOW_DESIGN.md` です。フロー図は `doc/diagrams/MVP_BUSINESS_FLOW_DIAGRAMS.md`、シーケンスは `doc/diagrams/MVP_SEQUENCE_DIAGRAMS.md`、状態遷移は `doc/diagrams/MVP_STATE_DIAGRAMS.md`、データ関係は `doc/diagrams/MVP_ER_DIAGRAM.md` を参照します。以下は主要フローの概要です。

### ノート作成フロー

1. ユーザーは `/notes/new` を開く。
2. タイトル、学習日、学習元、タグを入力する。
3. システムは `nextReviewDate` に `noteDate + 7日` を固定初期値として表示する。
4. ユーザーは Cue と Summary を Markdown で入力し、Canvas editor で本文を記録する。次回復習日は保存前に変更またはクリアできる。
5. 保存する。
6. システムは `bodyMode=canvas` と空文字の `Notebook.body`、`NotebookCanvas.documentJson`、Cue、Tag、NotebookTag をトランザクションで保存する。
7. 保存成功後、詳細画面 `/notes/[id]` へ遷移する。

### ノート検索 / 閲覧フロー

1. ユーザーは `/notes` を開く。
2. 必要に応じてフリーワード、日付範囲、タグ、復習対象を指定する。
3. システムは条件に一致するノート一覧を表示する。
4. ユーザーは対象ノートを選択する。
5. システムは `/notes/[id]` の閲覧モードを表示する。

### ノート編集フロー

1. ユーザーは詳細画面で編集モードへ切り替える。
2. システムは保存済みの `noteDate` を表示専用で表示し、保存済みの `nextReviewDate` を表示する。未設定の `nextReviewDate` は空欄のまま表示する。
3. ユーザーは Canvas editor または legacy Markdown 互換 UI で本文を変更し、Cue、Summary、タグ、次回復習日を変更する。保存後の通常編集画面では `noteDate` を変更できない。
4. 保存する。
5. システムは Notebook と、Canvas 本文では NotebookCanvas を更新し、Cue と Tag 関連をリクエスト内容で全置換する。
6. 保存成功後、閲覧モードへ戻る。

### 復習フロー

1. ユーザーは `/notes` で復習対象フィルタを使う。
2. 対象ノートの詳細画面を開く。
3. 復習モードへ切り替える。
4. システムは Cue を表示し、本文と Summary の内容を初期非表示にする。Summary の領域は維持し、本文を表示するまでは Summary を開けない状態にする。
5. システムは保存済みの `nextReviewDate` を再利用せず、画面を開いた時点の `Asia/Tokyo` の現在日付 + 7日を復習用の次回復習日の初期値として表示する。
6. ユーザーは Cue を手がかりに本文を想起する。
7. ユーザーは本文を表示して確認する。
8. ユーザーは Summary を開いて確認する。
9. ユーザーは次回復習日を必要に応じて変更またはクリアし、復習済みにする。
10. システムは `reviewedAt = now` とし、指定した `nextReviewDate` または null を保存する。成功後は API 応答の `nextReviewDate` を画面へ反映する。

### バックアップフロー

1. ユーザーは `/backup` を開く。
2. バックアップ作成を実行する。
3. システムは SQLite DB ファイルを `backup/` 配下へコピーする。
4. システムは最新 3 世代を残し、4 世代目以降を古い順に削除する。
5. 画面はバックアップ一覧を更新する。

この `backup/` は現行の開発用 Web 起動形態における MVP 契約です。Desktop Alpha では現行 `/backup` を、Settings の Data and Backup が代替して受け入れ確認を通るまで維持します。DB backup は SQLite の保全・復元用コピーであり、Desktop Alpha 後の Canvas PNG は Canvas 本文を画像として持ち出す外部出力です。両者を同じ復元単位として扱いません。

## 画面一覧概要

画面棚卸し、Action / Data、画面と API の対応は `doc/screens/MVP_SCREEN_INVENTORY.md` を参照します。画面構成、表示要素、主要アクション、遷移の正本は `doc/screens/MVP_SCREEN_DESIGN.md` です。以下は画面一覧の概要です。

| 画面ID | パス | 画面名 | MVP での役割 |
| --- | --- | --- | --- |
| COM-001 | 全画面 | 共通レイアウト | アプリ名、ナビゲーション、メイン領域を提供する |
| NTE-010 | `/notes` | ノート一覧 | 検索、復習対象確認、新規作成入口を提供する |
| NTE-020 | `/notes/new` | ノート作成 | Cornell 形式で新規ノートを作成する |
| NTE-030 | `/notes/[id]` | ノート詳細 | 閲覧、編集、復習モードを切り替える |
| BAK-010 | `/backup` | バックアップ | DB バックアップの作成と一覧確認を行う |

MVP では `/tasks/review` は作成しません。復習対象は `/notes` のフィルタで確認し、復習操作は `/notes/[id]` の復習モードで行います。

## 機能要件

### `nextReviewDate` の利用文脈

| 文脈 | 初期表示または抽出条件 | ユーザー操作と保存後の扱い |
| --- | --- | --- |
| 新規ノート作成 | UI は `noteDate + 7日` を固定初期値として表示する | 保存前に変更またはクリアでき、指定値または未設定を保存する。この初期値は継続的な自動復習スケジューリングではない |
| 既存ノート編集 | 保存済みの `noteDate` を表示専用で表示する。`nextReviewDate` は保存済みの値を表示し、未設定なら空欄のまま表示する | `nextReviewDate` は `noteDate` と独立して変更またはクリアできる。保存後の通常編集では `noteDate` を変更できず、保存済みの値を学習日から自動再計算しない |
| 既存ノートの復習画面 | 画面を開いた時点の `Asia/Tokyo` の現在日付 + 7日を固定初期値として表示し、保存済み値は再利用しない | 保存前に変更またはクリアできる。復習完了後は API 応答の `nextReviewDate` を画面へ反映する |
| 一覧の `reviewDue` 絞り込み | `nextReviewDate` が設定済みで、かつ今日以前のノートだけを抽出する。未設定のノートは対象外とする | 参照だけを行い、保存データは更新しない |

### ノート作成

- タイトル、学習日、学習元タイプ、学習元タイトル、タグ、Cue、Canvas 本文、Summary、次回復習日を入力できる。作成画面の学習日は `noteDate` として保存する。
- タイトルと学習日は必須とする。
- 新規ノートは `bodyMode=canvas` とし、`Notebook.body` を空文字、Canvas 本文を `NotebookCanvas.documentJson` 内の `CanvasDocumentV1` として保存する。
- Cue と Summary は Markdown として編集・保存する。
- `bodyMode=markdown` と `Notebook.body` は既存ノートの互換モードとして保持し、新規ノートの標準本文や自動移行元にしない。
- 保存時、未登録タグは自動作成する。
- 保存成功後は詳細画面へ遷移する。

### ノート一覧 / 検索

- 保存済みノートを一覧表示できる。
- 一覧にはタイトル、学習日、学習元、タグ、Cue 件数、要約状態、復習履歴、次回復習状態を表示する。
- 復習履歴は `reviewedAt` だけで判定し、`null` を `未復習`、`null` 以外を `復習済み` と表示する。
- 次回復習状態は `nextReviewDate` だけで判定し、未来を `復習予定日`、今日以前を `復習期限到来`、未設定を `復習予定なし` と表示する。復習履歴と次回復習状態は独立して表示する。
- 復習履歴 2 通りと次回復習状態 3 通りの 6 組み合わせを受け入れ、一方の値から他方の表示を推定しない。
- 一覧カードでは、タグがある場合にタグ名と色を表示し、複数タグを折り返し、長いタグ名を省略表示する。タグがない場合は `タグなし` を表示しない。詳細画面など他のタグ表示箇所の既存 `タグなし` 表示はこの要件の対象外とする。
- 一覧の復習履歴・次回復習状態の表示は、未採用の専用復習タスク、`review status`、未完了タスクバッジとは別の表示契約とする。
- フリーワード検索は `title`、`summary`、`cue.text`、legacy `bodyMode=markdown` の `Notebook.body`、Canvas text 要素から生成した `NotebookCanvas.searchText` を対象とする。
- Canvas の用紙寸法だけを変更した場合は、text 要素が変わらないため `NotebookCanvas.searchText` も変更しない。
- タグ検索は OR 条件とする。
- 日付範囲は `noteDate` を対象とする。
- 復習対象フィルタは `nextReviewDate` が設定済みで、かつ今日以前のノートを対象とする。未設定のノートは対象外とする。
- 並び順は `noteDate desc, updatedAt desc` 固定とする。

### ノート閲覧

- 詳細画面の初期表示は閲覧モードとする。
- タイトル、学習日、学習元、タグ、Cue、本文、Summary、次回復習日、最終復習日を表示する。
- `bodyMode=canvas` の本文は Canvas viewer、`bodyMode=markdown` の既存本文は互換 Markdown 表示を使う。
- Cue、Summary、legacy Markdown 本文の表示には sanitize を適用する。Canvas 本文を Markdown preview で表示しない。
- 詳細画面の Summary は編集画面の Markdown Preview ではなく、閲覧・復習で使う操作可能な読み取り領域とする。Summary を表示した後は、checked / unchecked の GFM task-list checkbox を toggle できる。
- Summary checkbox の toggle は対応する task-list marker の状態だけを変更し、task の本文、Summary 内の順序、checkbox 以外の Markdown を変更しない。変更は画面上の未保存状態として扱い、toggle ごとに API を呼ばない。
- 詳細画面で Summary の保存を明示的に実行した場合だけ、既存の `PATCH /api/notes/:id` を使って Summary Markdown を保存する。成功時は表示中ノートを更新して dirty 状態を解除し、失敗時は未保存状態と error を保持する。破棄または保存せずにモードを離れる場合は元の Summary に戻し、DB を更新しない。

### ノート編集

- 詳細画面から編集モードへ切り替えられる。
- 作成画面の項目を表示し、タイトル、学習元、タグ、Cue、本文、Summary、次回復習日を編集できる。学習日は現在値を表示するだけで変更できない。Canvas 本文は Canvas editor、既存 Markdown 本文は互換 UI で扱う。
- 保存時、Cue と Tag 関連は全置換する。
- 編集画面の Markdown Preview に表示する GFM checkbox は表示専用とし、クリックしても Summary の入力値や保存データを変更しない。
- キャンセル時は変更を破棄して閲覧モードへ戻る。
- MVP では自動保存と楽観ロックは行わない。

### ノート削除

- 削除前に確認ダイアログを表示する。
- API は物理削除を行う。
- MVP では Undo を提供しない。

### 復習

- 詳細画面で復習モードへ切り替えられる。
- 復習モード初期状態では、想起に使う内容として Cue を表示し、本文と Summary の内容を非表示にする。
- Summary は領域の位置を維持し、本文を表示するまでは開く操作を利用不可にする。
- ユーザー操作で本文を表示 / 非表示にできる。
- 本文を表示して確認した後、ユーザー操作で Summary を開ける。
- Summary を開いた後の checkbox toggle と Summary の明示保存は、復習完了とは別に実行する。復習完了操作は `POST /api/notes/:id/review` で `reviewedAt` と `nextReviewDate` を更新するが、Summary を保存済みと扱ったり dirty 状態を解除したりしない。復習完了でモードを離れ、Summary を別途保存していない場合は、保存せずに離れるルールに従って変更を破棄する。
- 復習済みにした場合、`reviewedAt` を現在日時に更新する。
- 復習用の次回復習日は、復習モードへ入った時点の `Asia/Tokyo` の現在日付 + 7日を固定初期値とする。保存済みの `nextReviewDate` は初期値に再利用しない。
- 画面内に保存済みの次回復習日をメタ情報として残す場合は、保存済み値であることを示し、復習用の入力値と区別する。
- ユーザーは復習完了前に次回復習日を変更またはクリアできる。復習成功後は API 応答の `nextReviewDate` を画面へ反映する。
- 自動採点、正誤判定、`nextReviewDate` の保存後の追従更新、復習履歴に基づく継続的な間隔計算は行わない。新規作成画面と復習画面に固定初期値を表示する処理は、継続的な自動復習スケジューリングに当たらない。
- Summary の操作可能化のために新しい API、schema、migration は追加しない。Summary の autosave、draft、Undo も MVP には含めない。

### タグ

- ノート保存時に未登録タグを自動作成する。
- タグ候補一覧を取得できる。
- ノートに付いたタグは、保存時の `tags` 配列の index をノート内の追加順として `NotebookTag.order` に 0 始まりで保存し、作成・編集後の一覧・詳細 response と各画面でその順序を維持する。
- `GET /api/tags` の候補一覧はタグ名昇順で返す。候補の並び順は、ノートに付いたタグの保存・表示順とは別の契約とする。
- 過去の順序を持たない既存 `NotebookTag` 行は migration で、Notebook ごとに Tag 名昇順、同名は `tagId` 昇順の 0 始まりで初期化する。過去の追加順は推測しない。
- 1 ノートにつきタグは最大 12 個とする。
- 重複タグは保存しない。
- MVP ではタグ専用の作成、編集、削除 API と管理 UI は作らない。

### バックアップ

- バックアップ画面で DB ファイルのバックアップを作成できる。
- 最新 3 世代を保持する。
- バックアップ一覧を表示できる。
- バックアップからの自動復元は MVP では行わない。

## データ要件

MVP のデータモデルは `doc/data/MVP_DATA_DESIGN.md` を正とします。

### 採用エンティティ

| エンティティ | 役割 |
| --- | --- |
| `Notebook` | ノート本体、`bodyMode`、legacy Markdown 本文、Summary、復習予定、復習済み日時を保持する |
| `NotebookCanvas` | `CanvasDocumentV1` の JSON、schema version、Canvas text 要素由来の `searchText` を保持する |
| `Cue` | キーワード / 質問 / 論点を保持する |
| `Tag` | タグマスタを保持する |
| `NotebookTag` | Notebook と Tag の多対多関連を保持する |

### MVP で持たないエンティティ

| エンティティ | 理由 |
| --- | --- |
| `CueCard` | 現行の左欄は `Cue` リストで扱い、カードモデルと D&D は未採用候補であるため |
| `NoteCard` | 現行本文は `CanvasDocumentV1` であり、カードとの併用または移行を決定していないため |
| `NoteCueLink` | Cue と本文の厳密リンクは未採用候補であるため |
| `NotebookDraftState` | 自動保存とドラフト管理は未採用候補であるため |
| `NotebookReviewProgress` | MVP は `nextReviewDate` と `reviewedAt` で足りるため |
| `SoftDeleteBuffer` | Undo は未採用候補であるため |
| `BackupLog` | MVP はバックアップファイル作成と保持だけで足りるため |

### 主なバリデーション

| 対象 | ルール |
| --- | --- |
| `title` | 1〜120 文字 |
| `noteDate` | 作成時に入力する今日以前の `noteDate`。保存後の通常編集では表示専用 |
| `sourceType` | `book`, `lecture`, `video`, `article`, `other`, 未指定 |
| `sourceTitle` | 0〜120 文字 |
| `bodyMode` | 新規ノートは `canvas`。`markdown` は既存ノートの互換モード |
| `body` | `bodyMode=canvas` では空文字。`bodyMode=markdown` では既存本文 Markdown |
| `canvas` | `bodyMode=canvas` では `CanvasDocumentV1` が必須。用紙寸法は 320〜4000px の整数 |
| `summary` | 文字列。空でも保存可 |
| `nextReviewDate` | `noteDate` 以降、または未指定 |
| `cue.text` | 1〜120 文字 |
| `tag.name` | 1〜30 文字 |
| `tags` | 最大 12 件、重複不可 |

## API 要件

MVP の API 詳細は `doc/api/MVP_API_DESIGN.md` を正とします。

### API 方針

- 認証は行わない。
- JSON API とする。
- エラー形式は `{ code, message, errors? }` に統一する。
- ノート作成 / 更新では Notebook、Canvas 本文の場合の NotebookCanvas、Cue、Tag、NotebookTag を 1 リクエストで保存する。
- ノート更新時、Cue と Tag 関連は全置換する。
- `POST /api/notes` は、今日以前で必須の `noteDate` を作成したノートへ保存する。保存後の通常編集画面では学習日を変更できない。
- `PATCH /api/notes/:id` は保存済みの現在値と同じ `noteDate` の送信を許可する。同値でも `noteDate` は更新しない。現在値と異なる `noteDate` は、他の値を更新せず 400 `invalid_body` とし、`errors` に `field: "noteDate"`、`message: "保存後の学習日は編集できません"` のフィールドエラーを返す。
- 復習済み更新は専用 API に分ける。

### エンドポイント

| Method | URL | 用途 |
| --- | --- | --- |
| GET | `/api/notes` | ノート一覧取得 |
| POST | `/api/notes` | ノート作成 |
| GET | `/api/notes/:id` | ノート詳細取得 |
| PATCH | `/api/notes/:id` | ノート更新 |
| DELETE | `/api/notes/:id` | ノート削除 |
| POST | `/api/notes/:id/review` | 復習済み更新 |
| GET | `/api/tags` | タグ候補一覧。名前昇順。ノート内タグの表示順とは別 |
| GET | `/api/backups` | バックアップ一覧 |
| POST | `/api/backups` | バックアップ作成 |

### MVP から外す API

| API | 理由 |
| --- | --- |
| `/api/undo` | Undo は未採用候補 |
| `/api/review-tasks` | 復習専用画面は MVP では作らない |
| `/api/notes/export` | 外部出力は現行 MVP 外。Canvas PNG の API 境界は未決定で、PDF export は現在未採用 |
| `/api/tags/:id` | タグ管理 mutation は未採用候補 |
| `/api/backups/retry` | MVP は `POST /api/backups` に統一 |
| Cue / Tag 差分更新 API | MVP では全置換で扱う |

## 非機能要件

### 性能

- ローカル個人利用で、操作を妨げない応答性を優先する。
- ノート作成、編集、削除、検索、復習済み更新は、通常利用の件数で操作を中断させる待ち時間を生じさせないことを目標にする。
- 一覧 API はページングを行い、1 ページ 50 件固定とする。
- 現行 MVP の 1 ページ 50 件と検索 API は、この文書同期では変更しない。
- Desktop Alpha 後は 5,000 件を長期利用の最低目標とし、10,000 note fixture で検索と一覧の性能余裕を確認する。追加読み込み型の無限スクロールと DOM windowing を採用するが、API、index、取得単位、仮想化方式は後続仕様 task で決める。

### 可用性 / データ保全

- 外部サービスに依存せず、ローカルで動作する。
- SQLite DB ファイルをバックアップできる。
- 最新 3 世代を保持する。
- バックアップからの自動復元は MVP 範囲外とし、必要な場合は手動復元手順を README 等へ記載する。
- デスクトップ配布時は `.app` の app bundle と user data directory を分離し、live DB は user data directory に置く。
- Desktop Alpha では user data directory の初期化、app bundle と DB migration の分離、migration / restore 前 safety backup、staging validation、失敗時の現行版・live DB 維持、アンインストールと完全なデータ削除の分離を要件とする。Tauri + Node.js sidecar は選定済みで、初期 provider は GitHub Releases、取得側は provider-neutral manifest とする。具体的な path、provider adapter の詳細、artifact 方式は実装契約で定める。
- `Downloads` を既定の DB / backup 保存先にしない。Canvas PNG の保存先も未決定のため、この文書で固定しない。
- SQLite の live DB を iCloud / Dropbox 等の同期フォルダへ置かない。クラウド同期やオンラインサービスは製品スコープ外とする。

### セキュリティ

- MVP はローカル個人利用を前提とし、認証は実装しない。
- Markdown 表示では XSS 対策として sanitize を適用する。
- 外部 API 連携は行わない。
- オンライン公開 URL、クラウド DB、クラウド同期のアクセス制御は設計しない。これらは製品スコープ外であり、Desktop 版の前提でもない。

### アクセシビリティ

- 主要操作はキーボードで到達できるようにする。
- 入力、ボタン、モード切替には識別可能なラベルを付与する。
- MVP では D&D 操作を必須にしないため、D&D のキーボード代替は対象外とする。

### 保守性

- UI から Prisma を直接呼ばず、Route Handler API 経由で保存する。
- DB アクセスは `src/lib/prisma` または DB 関連モジュールへ集約する。
- validation は API と UI で共有しやすい形にする。
- 実装は Worker タスク単位で小さく分割する。

### 検証

MVP 実装では、少なくとも次のコマンドを実行します。

```bash
npm run lint
npm run build
npm run prisma:generate
npm run prisma:migrate
```

必要に応じて、作成、閲覧、編集、復習、検索、バックアップの主要フローを手動または Playwright で確認します。

## 運用要件

### 起動 / 開発運用

- ローカル開発環境で Next.js アプリとして起動する。
- DB は SQLite を使用する。
- Prisma schema と migration で DB 構造を管理する。
- 実装タスクでは作業前後に `git status --short` を確認する。

Desktop PoC では、Electron と Tauri + Node.js sidecar を、同じ現行 MVP baseline、同じ deterministic な 10,000 note fixture、同じ Apple Silicon Mac で比較しました。起動速度、操作反応、shell の main / core、renderer / WebView、local runtime、Node.js sidecar、framework helper、関連子 process の合計メモリ、成果物サイズ、SQLite / Prisma / migration / lifecycle の成立性、保守性、安全性、DMG・更新の成立見通し、総コストを同じ条件で記録し、2026-08-17 に Tauri + Node.js sidecar を選定済みです。framework が必要とする内部 process を許容し、OS process が複数存在することだけを blocker や不合格理由にしません。PDF / Playwright / Chromium、Intel、未検証の古い macOS も blocker や必須受け入れ条件にしません。製品側の update backend は、provider / manifest / compatible selection / 公開 URL 境界 / download / signature・SHA-256 / archive・bundle validation / update state / pending verification、`apply_verified_update`（引数なしの明示 command）、`ApplyPreparation` / explicit restart handoff、staged migration / read-back / atomic DB switch、candidate health、bundle switch、checkpoint、rollback / SQLite restore / recovery、cleanup まで実装済みです。実 provider / package runtime、macOS packaged app による candidate health / bundle switch / rollback / cleanup、packaged Apple Silicon GUI、browser runtime の DB read-back は未検証です。自動 check、startup check、download 完了、pending notification だけでは apply / restart しません。

### バックアップ運用

- バックアップ対象は SQLite DB ファイルとする。
- バックアップ先は `backup/` 配下とする。
- ファイル名は日時が識別できる形式とする。
- 最新 3 世代を保持し、4 世代目以降は古いものから削除する。
- MVP ではバックアップログを DB 管理しない。

上記は現行の開発用 Web 起動形態における手動 SQLite DB backup の契約です。Desktop Alpha では Data and Backup に、手動 SQLite export、app 管理 backup からの復元、外部 backup file からの復元を分けて配置します。restore 前に現行 DB の safety backup を作り、schema、integrity、semantic validation、reopen に成功した file だけを適用します。現行 app より新しい schema の backup は更新後に復元を再開する pending restore とします。これらは承認済みの将来契約で、Settings UI からの backup / restore 操作はまだ実装していません。update apply backend では、verified artifact の再検証、`ApplyPreparation` の atomic state transition、explicit restart handoff、pending migration がある場合の migration 前 safety backup、DB staging copy 上の migration / read-back / reopen、atomic DB switch、candidate health、bundle switch、rollback / SQLite restore / recovery、checkpoint、cleanup を実装済みです。実 provider / package runtime と packaged app による health / switch / rollback / cleanup の runtime acceptance は未検証です。

### 障害時運用

- API エラーは画面でユーザーに分かる形で表示する。
- バックアップ作成に失敗した場合、失敗メッセージを表示する。
- DB 破損やバックアップ復元は MVP では自動化せず、手動対応とする。
- Desktop Alpha で起動時に DB を開けない場合は通常のノート UI を開かず、診断情報の local 書き出しと backup 復元への導線を優先する。診断 bundle は自動送信せず、ノート本文、Cue、Summary、タイトル、タグ、学習元、SQLite、backup、Canvas JSON、検索文字列を含めない。

## 例外 / エラー方針

### 共通方針

- API エラーは JSON 形式 `{ code, message, errors? }` に統一する。
- 入力不正は 400 を返す。
- 対象データが存在しない場合は 404 を返す。
- 削除成功は 204 を返す。
- 予期しないエラーは 500 を返す。

### 入力エラー

- 必須項目不足、文字数超過、未来日の `noteDate`、不正な `sourceType` は保存しない。
- フィールド単位で表現できるエラーは `errors` に `field` と `message` を含める。

### 削除エラー

- 削除対象が存在しない場合は 404 とする。
- MVP では削除後の Undo は提供しない。
- 削除前確認は UI 側の責務とする。

### 競合エラー

- MVP では楽観ロックを行わない。
- 同一ノートを複数タブで編集した場合、後から保存した内容が最終状態になる可能性がある。
- 競合検知や `409` 応答は、未採用候補である自動保存 / ドラフト管理を採用する場合に改めて契約を決める。

### Markdown 表示エラー

- Cue、Summary、legacy Markdown 本文の構文誤りは保存エラーにしない。
- 表示時に解釈できない記法があっても、可能な範囲でテキストとして表示する。
- XSS につながる HTML や危険な属性は sanitize で除去する。Canvas 本文はこの Markdown 表示処理の対象にしない。

## 制約

- ローカル個人利用を前提とする。
- 認証、ユーザー管理、権限管理は実装しない。
- 外部 API とは連携しない。
- 画像、ファイル添付は扱わない。
- 新規ノートの本文は `bodyMode=canvas` の `CanvasDocumentV1` とし、`Notebook.body` は空文字にする。
- `bodyMode=markdown` と `Notebook.body` は既存ノートの互換表示に限り、自動変換しない。
- Cue と Summary は Markdown として編集・保存し、安全に表示する。Canvas 本文は Markdown editor / preview の対象にしない。
- Cue と本文の厳密リンクは持たない。
- ノート削除は物理削除とし、Undo は実装しない。
- 学習日と `nextReviewDate` は独立して扱う。`nextReviewDate` は独立して変更でき、保存済みの値を学習日から自動再計算しない。保存後の通常編集では学習日は表示専用とする。復習履歴に基づく間隔も継続計算せず、新規作成画面と復習画面の固定初期値は表示する。
- PDF export は実装せず、現在は採用しない。再検討するかも未決定とする。
- `.app` の app bundle 内に SQLite の live DB を置かない。Desktop Alpha の migration、更新、restore の安全境界は承認済みで、具体的な path、provider adapter の詳細、artifact 方式は別 task で決める。
- SQLite はノートデータの唯一の正本とする。クラウド DB、クラウド同期、オンラインサービスは製品スコープ外であり、Vercel / Supabase / Postgres を将来実装予定として扱わない。
- `Downloads` を既定の DB / backup 保存先にしない。Desktop Alpha 後の Canvas PNG の保存先も未決定のまま残す。
- Canvas PNG は保存済み Canvas の用紙を画像として持ち出す派生出力であり、編集用データ形式や復元用正本には使わない。PNG 生成は未実装である。
- 実装ファイルや既存仕様を変更する場合は、対象タスクで明示する。

## 未決事項

MVP 関連設計書上、主要なスコープ判断は発注者承認済みです。業務フローと画面棚卸しは `doc/workflows/MVP_WORKFLOW_DESIGN.md`、`doc/screens/MVP_SCREEN_INVENTORY.md` に整理済みです。この文書更新時点で未決として残す事項は以下です。

| ID | 未決事項 | 判断が必要になるタイミング |
| --- | --- | --- |
| U-001 | Desktop shell を Electron と Tauri + Node.js sidecar のどちらにするか | 解決済み（2026-08-17）。Tauri + Node.js sidecar を選定 |
| U-002 | bundle ID、user data、backup、設定、log の具体的な path、provider adapter の詳細、manifest / package の配置、承認済み境界以外の署名・完全性検証方式 | Tauri 選定済み。初期 provider は GitHub Releases、provider-neutral manifest、公開鍵署名と SHA-256 の境界を承認済み。具体的な path、URL、archive 方式、署名 wire-level details は Desktop Alpha 実装 task で決める |
| U-003 | Canvas PNG の使用不可文字、同名 file、保存先、失敗時 UI、色管理。PDF を将来再検討するか | Desktop Alpha 後の PNG 仕様 task |
| U-004 | 検索の Summary 分類、tokenization、同順位、API / index、取得単位、仮想化方式 | Desktop Alpha 後の検索・一覧仕様 task |
| U-005 | 定期 backup、暗号化 backup、autosave、Undo、専用復習タスク、NoteCard / D&D の採否と詳細 | Desktop Alpha 後の個別仕様 task |

## 参照ドキュメント

### リポジトリ内

- `AGENTS.md`
- `doc/requirements/PRODUCT_SPEC.md`
- `doc/data/MVP_DATA_DESIGN.md`
- `doc/api/MVP_API_DESIGN.md`
- `doc/screens/MVP_SCREEN_DESIGN.md`
- `doc/technical/MVP_TECHNICAL_DESIGN.md`
- `doc/technical/TARGET_ARCHITECTURE.md`
- `doc/implementation/MVP_IMPLEMENTATION_TASKS.md`
- `doc/implementation/MVP_CONTRACT.md`
- `doc/implementation/POST_MVP_IMPLEMENTATION_PLAN.md`
- `doc/workflows/MVP_WORKFLOW_DESIGN.md`
- `doc/screens/MVP_SCREEN_INVENTORY.md`
- `doc/diagrams/MVP_UML_DESIGN.md`
- `doc/diagrams/MVP_BUSINESS_FLOW_DIAGRAMS.md`
- `doc/diagrams/MVP_SEQUENCE_DIAGRAMS.md`
- `doc/diagrams/MVP_STATE_DIAGRAMS.md`
- `doc/diagrams/MVP_ER_DIAGRAM.md`
- `doc/diagrams/MVP_SCREEN_TRANSITION_DIAGRAM.md`
- `doc/technical/MVP_DESIGN_TOOLING_GUIDE.md`
- `doc/implementation/IMPLEMENTATION_STATUS.md`
- `doc/testing/TEST_SCENARIOS.md`
- `codex-queue/README.md`
- `summary/README.md`

### 要件定義 / 設計観点の参照資料

以下の資料は、目的、範囲、業務フロー、画面棚卸し、例外、運用、非機能要件を漏れなく扱うための観点として参照しました。本文への長文転載は行いません。

- `/Users/kazuya/Downloads/prompts/docs/miscellaneous/doc/要件定義の基本と実践.md`
- `/Users/kazuya/Downloads/prompts/docs/miscellaneous/doc/初めての設計をやり抜くための本.md`
- `/Users/kazuya/Downloads/prompts/docs/miscellaneous/doc/業務フローチャートの作り方.md`
