# MVP システム仕様書

確認日: 2026-07-18

## 文書の位置づけ

このドキュメントは、Cornell Method Notebook の MVP 開発で参照するシステム仕様書です。

`AGENTS.md` は将来構想を含むアプリ全体仕様の正本です。一方、MVP 開発中の実装判断は、この `doc/requirements/MVP_SYSTEM_SPEC.md` と以下の関連 MVP 設計書を起点にします。

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

`AGENTS.md` と MVP 設計書の内容が異なる場合、MVP 実装では MVP 設計書を優先します。ただし、MVP 設計書で未定義の将来要件や全体方針は `AGENTS.md` を参照します。

この文書は、要件定義の観点で「何を実現するか」「どこまでを MVP とするか」「実装しないものは何か」を明確にするためのものです。詳細な DB カラム、API request / response、画面項目の完全な定義は、各個別設計書を参照します。

MVP 仕様書群の役割分担は以下です。

| 文書 | 主な役割 |
| --- | --- |
| `doc/requirements/MVP_SYSTEM_SPEC.md` | MVP の目的、スコープ、Phase 2 境界、主要要件の入口 |
| `doc/workflows/MVP_WORKFLOW_DESIGN.md` | 利用者の業務フロー、操作順序、判断分岐、運用ルール |
| `doc/screens/MVP_SCREEN_INVENTORY.md` | 画面単位の棚卸し、Action / Data、画面と API の対応 |
| `doc/diagrams/MVP_UML_DESIGN.md` | 図別設計書への index / 目次 |
| `doc/diagrams/MVP_BUSINESS_FLOW_DIAGRAMS.md` | 学習記録作成、検索・閲覧、復習、削除、バックアップの業務フロー図 |
| `doc/diagrams/MVP_SEQUENCE_DIAGRAMS.md` | ノート作成、検索、編集、復習済み更新、バックアップ作成のシーケンス図 |
| `doc/diagrams/MVP_STATE_DIAGRAMS.md` | 詳細画面モード、ノート復習状態の状態遷移図 |
| `doc/diagrams/MVP_ER_DIAGRAM.md` | Notebook / Cue / Tag / NotebookTag のデータ関係図 |
| `doc/diagrams/MVP_SCREEN_TRANSITION_DIAGRAM.md` | `/notes`, `/notes/new`, `/notes/[id]`, `/backup` の画面遷移図 |
| `doc/data/MVP_DATA_DESIGN.md` | MVP データモデル、採用 / 非採用エンティティ |
| `doc/api/MVP_API_DESIGN.md` | MVP API の request / response、エラー、MVP 外 API |
| `doc/screens/MVP_SCREEN_DESIGN.md` | 画面構成、表示要素、主要アクション、遷移 |
| `doc/technical/MVP_TECHNICAL_DESIGN.md` | 技術構成、実装方針、検証方針 |
| `doc/technical/MVP_DESIGN_TOOLING_GUIDE.md` | 外部ツール / 参考リソースの使いどころ、成果物受け渡し、レビュー時の注意 |
| `doc/implementation/MVP_IMPLEMENTATION_TASKS.md` | Worker タスク分割、実装順序、完了条件 |

## システム概要

Cornell Method Notebook は、ローカル個人利用向けの学習ノートアプリです。

将来の製品主経路は Mac のデスクトップアプリとして配布し、ユーザーがダウンロード・起動して使う形とします。ただし、開発・検証用の Next.js Web 起動形態は維持します。デスクトップ版でもクラウド DB は必須ではなく、現行 MVP と同じく各ユーザーの Mac 内 SQLite を local-first の運用 DB とします。

保存境界は次のとおりです。

| 境界 | 要件 |
| --- | --- |
| `app bundle` | 実行コード、Next.js 資産、Prisma Client / migration、必要な runtime / driver を含む。インストールされた `.app` 内に SQLite の live file やユーザーデータを置かない |
| `user data directory` | SQLite DB、DB backup、アプリ設定、ログ等の書き込み可能データを置く。OS のユーザーデータ領域を基本とし、初回起動時に作成・初期化する。`Downloads` を既定にしない |
| `optional note workspace / export directory` | ユーザーが明示的に選ぶ Markdown、Canvas JSON、metadata 等の可搬ファイル領域。既定の DB 保存先とは分ける |

アプリ更新は app bundle の更新と user data の migration を分離し、更新でユーザーデータを失わない。アンインストールとデータ削除は別操作とする。Electron を最短経路候補、Tauri + Node.js sidecar を代替候補として比較するが、shell の採用・実装着手は Desktop PoC 後に決めます。

ユーザーは、コーネルメソッドの形式に沿って、学習内容を以下の単位で記録します。

- タイトル、学習日、学習元
- キーワード / 質問としての Cue
- Markdown 形式の本文
- Markdown 形式のサマリー
- タグ
- 次回復習日と復習済み日時

MVP では、ノート作成、検索、閲覧、編集、復習、バックアップまでの学習サイクルを最小構成で成立させます。高度な自動保存、カード分割、Undo、PDF 出力、専用復習タスク画面は Phase 2 に送ります。

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
| 想起練習 | Cue とサマリーを見て本文を思い出す |
| 復習管理 | 次回復習日をもとに復習対象を確認し、復習済みにする |
| ローカル保全 | SQLite DB ファイルのバックアップを作成し、破損や誤操作に備える |

## 業務目的 / 成功条件

### 業務目的

MVP の業務目的は、ユーザーが日々の学習を「記録、整理、要約、想起、復習」の流れで継続できる状態を作ることです。

この目的を満たすため、MVP ではノート管理機能そのものよりも、コーネルメソッドの学習サイクルを回せることを優先します。

### 成功条件

MVP は以下を満たしたとき成功とみなします。

- ノートを新規作成できる。
- 作成したノートを一覧で確認できる。
- ノートをタイトル、日付、タグ、復習対象で絞り込める。
- ノートを詳細画面で閲覧できる。
- ノートを編集して保存できる。
- Cue、本文、サマリーをコーネルメソッドに沿った構造で扱える。
- Markdown の入力と表示ができる。
- 復習モードで本文を隠し、必要に応じて表示できる。
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
| ノート閲覧 | Markdown 表示でノート内容を読む |
| ノート編集 | 保存済みノートを更新する |
| ノート削除 | 確認後に物理削除する |
| 復習 | Cue とサマリーを見て本文を想起し、復習済みにする |
| バックアップ | DB ファイルを `backup/` 配下へコピーし、最新 3 世代を保持する |
| 保存場所 | 現行 MVP はローカル SQLite。Desktop 配布時は user data directory に live DB を置く境界を採用候補とする |

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
- Vercel / Supabase などへのオンライン本番デプロイ（必要になった場合の任意の将来案）
- ノートファイルを正本にした file-only / hybrid 運用の確定実装

## MVP スコープ

MVP スコープは、既存 MVP 設計書で発注者承認済みの判断に合わせます。

| 領域 | MVP で実装すること | 判断基準 |
| --- | --- | --- |
| ノート構造 | 本文は 1 つの Markdown 文字列として保存する | コーネル学習サイクルを最小構成で回すため |
| Cue | キーワード / 質問のリストとして保存する | 想起の手がかりを残すため |
| Cue と本文の関連 | 厳密リンクは持たない | 実装コストに対して MVP 効果が限定的なため |
| タグ | 正規化して `Tag` / `NotebookTag` で扱う | 検索・分類の基本機能として必要なため |
| 復習 | `nextReviewDate` と `reviewedAt` で管理する | 自動間隔反復なしでも復習サイクルを回せるため |
| Markdown 入力 | `textarea + preview` から開始する | 依存と保守範囲を抑えるため |
| API | Next.js Route Handler で JSON API を実装する | UI / API / Prisma を TypeScript で揃えるため |
| DB | Prisma + SQLite を採用する | ローカル個人利用に適しているため |
| バックアップ | DB ファイルコピーと最新 3 世代保持 | 個人利用で最低限のデータ保全を行うため |

## Phase 2 送り

以下は Phase 2 以降で検討します。MVP 実装中に必要性を感じても、仕様変更として確定せず、別タスクで扱います。

| 領域 | Phase 2 候補 | MVP で送る理由 |
| --- | --- | --- |
| 自動保存 / 下書き | `NotebookDraftState`、楽観ロック、競合 UI | MVP では手動保存で十分に主要フローを確認できる |
| Undo | `SoftDeleteBuffer` と削除復元 | MVP は確認ダイアログ + 物理削除で代替する |
| カード分割本文 | `NoteCard`、`NoteCueLink`、D&D | まず本文 1 Markdown で学習サイクルを成立させる |
| 高度な復習 | 1 日後 / 7 日後タスク、進捗テーブル、バッジ | MVP は手動の `nextReviewDate` で復習対象を扱う |
| 専用復習画面 | `/tasks/review` | MVP は `/notes` の復習対象フィルタと詳細復習モードで扱う |
| PDF 出力 | `/api/notes/export`、Playwright PDF | 学習記録の中核ではないため |
| タグ管理 UI | タグ名変更、削除、右クリックメニュー | ノート保存時の自動作成と候補一覧で足りる |
| 高機能 Markdown エディタ | `@uiw/react-md-editor` など | textarea + preview で MVP を検証する |
| 外部デプロイ | Vercel、Supabase、Basic 認証相当 | 個人ローカル利用を先に完成させる |
| Desktop shell / 配布 PoC | Electron / Tauri + Node.js sidecar、署名・更新 | 現行 MVP の Web 起動を維持し、shell 選定と配布検証を別 task で行う |
| ノートファイル | `note.md`、`canvas.json`、`metadata.json` または package、export / import | 第一段階は SQLite 正本。ファイル正本 + local SQLite index は必要性確認後に検討する |
| Rust API | 別 API サーバー、補助プロセス | MVP の処理量では TypeScript API で十分 |

## 主要業務フロー概要

詳細な業務フロー、判断分岐、運用ルールは `doc/workflows/MVP_WORKFLOW_DESIGN.md` を正とします。主要フローの図は `doc/diagrams/MVP_BUSINESS_FLOW_DIAGRAMS.md`、シーケンスは `doc/diagrams/MVP_SEQUENCE_DIAGRAMS.md`、状態遷移は `doc/diagrams/MVP_STATE_DIAGRAMS.md`、データ関係は `doc/diagrams/MVP_ER_DIAGRAM.md` を参照します。本章では、MVP システム仕様の入口として主要フローの概要のみを示します。

### ノート作成フロー

1. ユーザーは `/notes/new` を開く。
2. タイトル、学習日、学習元、タグを入力する。
3. Cue、本文、サマリー、次回復習日を入力する。
4. 保存する。
5. システムは Notebook、Cue、Tag、NotebookTag をトランザクションで保存する。
6. 保存成功後、詳細画面 `/notes/[id]` へ遷移する。

### ノート検索 / 閲覧フロー

1. ユーザーは `/notes` を開く。
2. 必要に応じてフリーワード、日付範囲、タグ、復習対象を指定する。
3. システムは条件に一致するノート一覧を表示する。
4. ユーザーは対象ノートを選択する。
5. システムは `/notes/[id]` の閲覧モードを表示する。

### ノート編集フロー

1. ユーザーは詳細画面で編集モードへ切り替える。
2. ノート内容、Cue、タグ、次回復習日を変更する。
3. 保存する。
4. システムは Notebook を更新し、Cue と Tag 関連をリクエスト内容で全置換する。
5. 保存成功後、閲覧モードへ戻る。

### 復習フロー

1. ユーザーは `/notes` で復習対象フィルタを使う。
2. 対象ノートの詳細画面を開く。
3. 復習モードへ切り替える。
4. Cue とサマリーを見て本文を思い出す。
5. 必要に応じて本文を表示する。
6. 復習済みにする。
7. システムは `reviewedAt = now` とし、任意の `nextReviewDate` を保存する。

### バックアップフロー

1. ユーザーは `/backup` を開く。
2. バックアップ作成を実行する。
3. システムは SQLite DB ファイルを `backup/` 配下へコピーする。
4. システムは最新 3 世代を残し、4 世代目以降を古い順に削除する。
5. 画面はバックアップ一覧を更新する。

この `backup/` は現行の開発用 Web 起動形態における MVP 契約です。Desktop 配布では、同じ手動 SQLite DB コピーを user data directory 内へ解決する adapter を検討します。DB backup と optional note workspace のバックアップ単位、export / import、復元、破損検出は追加候補であり、現行 MVP の機能契約にはしません。

## 画面一覧概要

詳細な画面棚卸し、Action / Data、画面と API の対応は `doc/screens/MVP_SCREEN_INVENTORY.md` を参照します。画面構成、表示要素、主要アクション、遷移の詳細は `doc/screens/MVP_SCREEN_DESIGN.md` を正とします。本章では、MVP システム仕様の入口として画面一覧の概要のみを示します。

| 画面ID | パス | 画面名 | MVP での役割 |
| --- | --- | --- | --- |
| COM-001 | 全画面 | 共通レイアウト | アプリ名、ナビゲーション、メイン領域を提供する |
| NTE-010 | `/notes` | ノート一覧 | 検索、復習対象確認、新規作成入口を提供する |
| NTE-020 | `/notes/new` | ノート作成 | Cornell 形式で新規ノートを作成する |
| NTE-030 | `/notes/[id]` | ノート詳細 | 閲覧、編集、復習モードを切り替える |
| BAK-010 | `/backup` | バックアップ | DB バックアップの作成と一覧確認を行う |

MVP では `/tasks/review` は作成しません。復習対象は `/notes` のフィルタで確認し、復習操作は `/notes/[id]` の復習モードで行います。

## 機能要件

### ノート作成

- タイトル、学習日、学習元タイプ、学習元タイトル、タグ、Cue、本文、サマリー、次回復習日を入力できる。
- タイトルと学習日は必須とする。
- 本文とサマリーは Markdown 文字列として保存する。
- 保存時、未登録タグは自動作成する。
- 保存成功後は詳細画面へ遷移する。

### ノート一覧 / 検索

- 保存済みノートを一覧表示できる。
- 一覧にはタイトル、学習日、学習元、タグ、Cue 件数、要約状態、復習状態を表示する。
- フリーワード検索は `title`, `body`, `summary`, `cue.text` を対象とする。
- タグ検索は OR 条件とする。
- 日付範囲は `noteDate` を対象とする。
- 復習対象フィルタは `nextReviewDate` が今日以前のノートを対象とする。
- 並び順は `noteDate desc, updatedAt desc` 固定とする。

### ノート閲覧

- 詳細画面の初期表示は閲覧モードとする。
- タイトル、学習日、学習元、タグ、Cue、本文、サマリー、次回復習日、最終復習日を表示する。
- Markdown 表示には sanitize を適用する。

### ノート編集

- 詳細画面から編集モードへ切り替えられる。
- 作成画面と同じ項目を編集できる。
- 保存時、Cue と Tag 関連は全置換する。
- キャンセル時は変更を破棄して閲覧モードへ戻る。
- MVP では自動保存と楽観ロックは行わない。

### ノート削除

- 削除前に確認ダイアログを表示する。
- API は物理削除を行う。
- MVP では Undo を提供しない。

### 復習

- 詳細画面で復習モードへ切り替えられる。
- 復習モード初期状態では本文を非表示にする。
- Cue とサマリーを表示する。
- ユーザー操作で本文を表示 / 非表示にできる。
- 復習済みにした場合、`reviewedAt` を現在日時に更新する。
- 次回復習日はユーザーが任意で設定する。
- 自動採点、正誤判定、復習間隔の自動計算は行わない。

### タグ

- ノート保存時に未登録タグを自動作成する。
- タグ候補一覧を取得できる。
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
| `Notebook` | ノート本体、本文、サマリー、復習予定、復習済み日時を保持する |
| `Cue` | キーワード / 質問 / 論点を保持する |
| `Tag` | タグマスタを保持する |
| `NotebookTag` | Notebook と Tag の多対多関連を保持する |

### MVP で持たないエンティティ

| エンティティ | 理由 |
| --- | --- |
| `NoteCard` | 本文は 1 つの Markdown 文字列として扱うため |
| `NoteCueLink` | Cue と本文の厳密リンクは Phase 2 で扱うため |
| `NotebookDraftState` | 自動保存とドラフト管理は Phase 2 のため |
| `NotebookReviewProgress` | MVP は `nextReviewDate` と `reviewedAt` で足りるため |
| `SoftDeleteBuffer` | Undo は Phase 2 のため |
| `BackupLog` | MVP はバックアップファイル作成と保持だけで足りるため |

### 主なバリデーション

| 対象 | ルール |
| --- | --- |
| `title` | 1〜120 文字 |
| `noteDate` | 今日以前 |
| `sourceType` | `book`, `lecture`, `video`, `article`, `other`, 未指定 |
| `sourceTitle` | 0〜120 文字 |
| `body` | 文字列。空でも保存可 |
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
- ノート作成 / 更新では Notebook、Cue、Tag を 1 リクエストで保存する。
- ノート更新時、Cue と Tag 関連は全置換する。
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
| GET | `/api/tags` | タグ候補一覧 |
| GET | `/api/backups` | バックアップ一覧 |
| POST | `/api/backups` | バックアップ作成 |

### MVP から外す API

| API | 理由 |
| --- | --- |
| `/api/undo` | Undo は Phase 2 |
| `/api/review-tasks` | 復習専用画面は MVP では作らない |
| `/api/notes/export` | PDF 出力は Phase 2 |
| `/api/tags/:id` | タグ管理 UI は Phase 2 |
| `/api/backups/retry` | MVP は `POST /api/backups` に統一 |
| Cue / Tag 差分更新 API | MVP では全置換で扱う |

## 非機能要件

### 性能

- ローカル個人利用で快適に操作できることを優先する。
- ノート作成、編集、削除、検索、復習済み更新は通常利用の件数で体感上待たされないことを目標にする。
- 一覧 API はページングを行い、1 ページ 50 件固定とする。
- データ量増加で検索が遅くなった場合、インデックスや全文検索は Phase 2 で検討する。

### 可用性 / データ保全

- 外部サービスに依存せず、ローカルで動作する。
- SQLite DB ファイルをバックアップできる。
- 最新 3 世代を保持する。
- バックアップからの自動復元は MVP 範囲外とし、必要な場合は手動復元手順を README 等へ記載する。
- デスクトップ配布時は `.app` の app bundle と user data directory を分離し、live DB は user data directory に置く。
- 初回起動時の user data directory 作成・migration、アプリ更新と DB 更新の分離、アンインストールとデータ削除の分離を要件とする。具体的な実装は Desktop PoC 後に決める。
- `Downloads` を既定の保存先にしない。可搬性が必要な場合は明示的な note workspace / export directory を選べる設計を検討する。
- SQLite の live DB を iCloud / Dropbox 等の同期フォルダへ直接置かない。同期・可搬性は note file export / import を優先する。

### セキュリティ

- MVP はローカル個人利用を前提とし、認証は実装しない。
- Markdown 表示では XSS 対策として sanitize を適用する。
- 外部 API 連携は行わない。
- Vercel 等へ公開 URL を持つ形でデプロイする場合は、オンライン経路を選んだ場合の任意の将来案として、Phase 2 で Basic 認証相当または別のアクセス制御を実装する。Desktop 版の前提ではない。

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

MVP 実装では少なくとも以下を実行対象とします。

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

将来の Mac デスクトップ配布では、shell が local Next.js runtime を起動する構成を候補とする。Electron は最短経路候補、Tauri + Node.js sidecar は代替候補であり、いずれも採用・実装済みとは扱わない。Apple Silicon / Intel の配布差、SQLite / Prisma native runtime、Playwright / Chromium、署名・更新、local runtime の lifecycle を Desktop PoC で確認する。

### バックアップ運用

- バックアップ対象は SQLite DB ファイルとする。
- バックアップ先は `backup/` 配下とする。
- ファイル名は日時が識別できる形式とする。
- 最新 3 世代を保持し、4 世代目以降は古いものから削除する。
- MVP ではバックアップログを DB 管理しない。

上記は現行の開発用 Web 起動形態における手動 SQLite DB backup の契約です。Desktop 配布では `backup/` の論理役割を user data directory 内へ解決する案を検討します。DB backup と note workspace backup の単位、export / import、復元、破損検出、起動時 migration / 初期化は追加候補であり、実装済みとは記述しません。

### 障害時運用

- API エラーは画面でユーザーに分かる形で表示する。
- バックアップ作成に失敗した場合、失敗メッセージを表示する。
- DB 破損やバックアップ復元は MVP では自動化せず、手動対応とする。
- 想定外エラーの詳細ログ管理は Phase 2 で検討する。

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
- 競合検知や 409 応答は Phase 2 の自動保存 / ドラフト管理で扱う。

### Markdown 表示エラー

- Markdown の構文誤りは保存エラーにしない。
- 表示時に解釈できない記法があっても、可能な範囲でテキストとして表示する。
- XSS につながる HTML や危険な属性は sanitize で除去する。

## 制約

- ローカル個人利用を前提とする。
- 認証、ユーザー管理、権限管理は実装しない。
- 外部 API とは連携しない。
- 画像、ファイル添付は扱わない。
- 本文は MVP では 1 つの Markdown 文字列とする。
- Cue と本文の厳密リンクは持たない。
- ノート削除は物理削除とし、Undo は実装しない。
- 復習間隔の自動計算は行わない。
- PDF 出力は実装しない。
- `.app` の app bundle 内に SQLite の live DB を置かない。user data directory 初期化・migration・更新・復元の詳細は Desktop PoC / 別 task で決める。
- クラウド DB は必須にしない。Vercel / Supabase / Postgres はオンライン公開・同期が必要な場合の任意の将来案であり、デスクトップ版の local SQLite 方針を上書きしない。
- `Downloads` を既定の DB / backup 保存先にしない。SQLite を同期フォルダへ直接置かず、可搬性が必要な場合は明示的な note workspace / export / import を優先する。
- ノートファイルを正本にした file-only / hybrid への変更は MVP 完了条件に含めない。
- 実装ファイルや既存仕様を変更する場合は、対象タスクで明示する。

## 未決事項

MVP 関連設計書上、主要なスコープ判断は発注者承認済みです。業務フローと画面棚卸しは `doc/workflows/MVP_WORKFLOW_DESIGN.md`、`doc/screens/MVP_SCREEN_INVENTORY.md` に整理済みです。この文書更新時点で未決として残す事項は以下です。

| ID | 未決事項 | 判断が必要になるタイミング |
| --- | --- | --- |
| U-001 | バックアップ復元の手動手順を README にどこまで書くか | `mvp-readme-update` タスク実施時 |
| U-002 | Playwright による MVP 主要フロー確認を必須にするか | `mvp-final-verification` タスク実施時 |
| U-003 | 作成・編集キャンセル時に未保存変更の確認ダイアログを出すか | `mvp-note-form` タスク実施時 |
| U-004 | Cue の空行を UI で自動除外するか、validation エラーにするか | `mvp-note-form` タスク実施時 |
| U-005 | Desktop shell を Electron と Tauri + Node.js sidecar のどちらにするか | Desktop PoC 実施時 |
| U-006 | user data / workspace path をどう分けるか | Desktop shell の path resolver / export 設計時 |
| U-007 | SQLite-only と hybrid（file 正本 + local SQLite index）の境界をいつ変えるか | ファイル可搬性の必要性を確認した Phase 2 以降 |
| U-008 | `note.md` / `canvas.json` / `metadata.json` または package の export / import 契約をどうするか | schema version、atomic write、整合性検査、復元設計時 |
| U-009 | Apple Silicon / Intel の配布・署名・更新をどう検証するか | Desktop 配布・署名・更新 PoC 実施時 |

## 参照ドキュメント

### リポジトリ内

- `AGENTS.md`
- `doc/data/MVP_DATA_DESIGN.md`
- `doc/api/MVP_API_DESIGN.md`
- `doc/screens/MVP_SCREEN_DESIGN.md`
- `doc/technical/MVP_TECHNICAL_DESIGN.md`
- `doc/technical/TARGET_ARCHITECTURE.md`
- `doc/implementation/MVP_IMPLEMENTATION_TASKS.md`
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
