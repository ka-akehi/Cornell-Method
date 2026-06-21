# MVP Design Tooling Guide

確認日: 2026-06-21

## 位置づけ

このドキュメントは、Cornell Method Notebook MVP の設計、レビュー、説明資料作成で使える外部ツールと参考リソースの運用ガイドです。

参照元は `/Users/kazuya/Downloads/prompts/docs/参考サイト一覧.md` の「参照元URLカタログ」です。外部サイトの内容は設計補助として扱い、仕様の正本はこのリポジトリ内の `AGENTS.md` と MVP 設計書群です。

このガイドは npm 依存追加、アプリ実装、API 実装、Prisma schema / migration 変更を目的としません。外部 AI UI ツールや外部プレビューサイトの成果物は、リポジトリへ持ち込んだうえでレビューし、採用範囲を明示してから実装タスク化します。

## ツール分類

| 分類 | 対象 | このプロジェクトでの用途 | 扱い |
| --- | --- | --- | --- |
| 図 / Markdown 確認 | DocBase Markdown 記法、DocBase Mermaid 記法、Mermaid ライブプレビュー | Markdown 設計書の記法確認、Mermaid 図の構文確認 | Codex で記述し、必要時のみ外部 preview で確認 |
| Markdown 設計書 / Docs-as-Code | Markdown で設計を書く実例、Markdown 画面設計、GitHub ドキュメント管理 | README / 設計書をリポジトリ管理し、差分レビューできる形に保つ | docs の構成、レビュー観点、記述粒度の参考 |
| 要件定義 / 基本設計テンプレート | 要件定義テンプレート、基本設計テンプレート、機能一覧レビュー | MVP / Phase 2 境界、受け入れ条件、機能一覧の抜け漏れ確認 | テンプレートをそのまま正本にせず、MVP 設計書へ必要分だけ反映 |
| DB / 画面設計テンプレート | DB 定義書、画面設計書テンプレート | DB 定義書追加検討、画面項目 / 状態 / validation の不足確認 | `doc/data/MVP_DATA_DESIGN.md`、`doc/screens/MVP_SCREEN_DESIGN.md` の補助 |
| UI プロトタイプ支援 | Google Stitch、Claude Design | 画面設計 / ワイヤーフレーム不足の補完、UI 案の比較 | 外部で生成し、採用部分だけリポジトリへ持ち込む |
| Codex 内デザインループ | Cornell Design Studio plugin、`doc/design-studio/` | Stitch / Claude Design 的な画面案作成、比較、実装受け渡し | repo-local plugin と Markdown テンプレートで運用 |
| 説明資料 / スライド化 | Marp、Marp ライブプレビュー | 設計説明資料、レビュー会用スライド作成 | Markdown から資料化する場合の補助 |
| AI 駆動開発 / 品質レビュー | Findy / SHIFT / Trainocate / Monstarlab 系記事 | AI 生成物レビュー、品質担保、AI governance 観点の補強 | review_rule や checklist 化するときの参考 |
| オーケストレーション概念 | Red Hat オーケストレーション | Manager / Worker 運用、タスク分割、制御方針の概念整理 | `codex-queue` 運用の説明補助 |

## このプロジェクトでの使いどころ

### Mermaid 図の構文確認

- `doc/diagrams/MVP_BUSINESS_FLOW_DIAGRAMS.md`
- `doc/diagrams/MVP_SEQUENCE_DIAGRAMS.md`
- `doc/diagrams/MVP_STATE_DIAGRAMS.md`
- `doc/diagrams/MVP_ER_DIAGRAM.md`
- `doc/diagrams/MVP_SCREEN_TRANSITION_DIAGRAM.md`

Codex 内で Mermaid を編集し、構文や表示崩れが疑わしい場合だけ Mermaid ライブプレビューで確認します。外部 preview の表示結果は最新仕様の根拠にせず、修正後の Mermaid 本文をリポジトリへ反映します。

### 画面設計 / ワイヤーフレーム不足の補完

`doc/screens/MVP_SCREEN_DESIGN.md` や `doc/screens/MVP_SCREEN_INVENTORY.md` に、画面項目、空状態、エラー状態、ボタン配置、遷移後状態が不足している場合に使います。

Google Stitch / Claude Design で UI 案を作った場合も、その出力は仕様確定済みとは扱いません。採用する画面構成、採用しない演出、MVP / Phase 2 の境界を明示してから、Markdown の画面設計または実装タスクへ落とします。

### Codex 内 Design Studio 運用

Google Stitch / Claude Design のような流れを Codex 内で回す場合は、repo-local plugin `cornell-design-studio` と `doc/design-studio/` を使います。

この運用では、外部ツールに画面案を作らせる代わりに、次の成果物をリポジトリ内で作成します。

- design brief
- UI バリエーション比較
- UX / アクセシビリティレビュー
- implementation handoff
- Worker task
- 設計書同期メモ

詳細は `doc/design-studio/README.md` を参照します。

初回のみ Codex CLI へ repo-local marketplace を追加します。

```sh
codex plugin marketplace add /Users/kazuya/Desktop/自己学習/Cornell-Method
codex plugin add cornell-design-studio@cornell-method-local
```

plugin 反映後は新しい Codex セッションで、`Cornell Design Studio` を使って画面案作成、レビュー、実装タスク化を行います。

### DB 定義書の追加検討

MVP の DB 正本は `doc/data/MVP_DATA_DESIGN.md` と Prisma schema です。DB 定義書テンプレートは、以下を追加で整理したくなった場合の参考にします。

- カラム単位の型、必須、default、unique、index
- 削除方針
- migration 時の注意
- Phase 2 エンティティとの差分

### 非機能要件 / AI governance レビュー観点の補強

AI 駆動開発や品質レビュー記事は、次の観点を設計レビューへ足すときに使います。

- AI 出力をそのまま採用していないか
- 外部ツールへ個人データを渡していないか
- 依存追加や外部連携が MVP 範囲を超えていないか
- セキュリティ、プライバシー、運用、バックアップの確認が残っていないか

### README / 設計書の Docs-as-Code 運用

README と `doc/` 配下は、設計判断、実装タスク、検証結果を Git の差分で追える形にします。外部記事やテンプレートから得た観点は、長文転載ではなく、このリポジトリ向けの判断基準、チェック項目、タスクに変換して記録します。

### UI プロトタイプを外部生成した場合の Codex への受け渡し

外部生成した画面案は、スクリーンショットや生成コードをそのまま実装へ流さず、まずレビュー対象の成果物として扱います。

Codex に渡すときは、対象画面、目的、採用範囲、MVP / Phase 2 区分、セキュリティ上の注意を明示します。Codex は既存の Next.js / React / Tailwind 構成と MVP 設計書に合わせて、必要な部分だけ実装タスクへ変換します。

### 設計説明資料を Marp で作る場合の運用

Marp は、設計レビュー会や発注者説明用のスライドを Markdown から作る場合に使います。資料の元情報は `doc/` 配下の設計書とし、スライドは説明用の派生成果物として扱います。

## Codex 内で使えるもの / 外部で使うもの

### Codex 内

- Markdown 編集
- Mermaid 記述
- 設計書レビュー
- Cornell Design Studio による UI 案作成 / 比較 / 実装ハンドオフ
- タスク化
- 実装への反映
- README / `doc/` / `summary/` への記録

### 外部

- Mermaid live preview
- Marp live preview
- Google Stitch
- Claude Design
- 参考記事やテンプレートサイトの閲覧

外部でしか使えないツールの結果は、必ず Markdown、Mermaid、画像、HTML、コード、またはテキスト仕様としてリポジトリへ持ち込みます。

## 成果物の受け渡し

外部ツールで作ったものは、以下のいずれかでリポジトリへ持ち込みます。

- Markdown
- Mermaid
- 画像 / スクリーンショット
- HTML
- React / Tailwind コード
- テキスト仕様

Codex へ渡す際に必要な情報:

| 項目 | 内容 |
| --- | --- |
| 目的 | 何を改善、確認、説明するための成果物か |
| 反映先 | どの画面、設計書、タスクへ反映するか |
| 採用する部分 | レイアウト、文言、画面項目、図、コンポーネントなど採用対象 |
| 採用しない部分 | MVP 範囲外、過剰な演出、未採用の依存、不要な機能 |
| フェーズ | MVP に入れるか、Phase 2 に送るか |
| セキュリティ上の注意 | サンプルデータ化、個人情報なし、秘密情報なし、外部送信なし |

受け渡し例:

```text
目的: /notes の検索 UI の不足確認
反映先: doc/screens/MVP_SCREEN_DESIGN.md と mvp-notes-list タスク
採用する部分: 日付範囲、タグ、復習対象フィルタの並び
採用しない部分: AI が追加した共有ボタン、グラフ表示、外部同期
フェーズ: MVP
セキュリティ上の注意: 実データではなくダミータイトルとダミータグのみ使用
```

## 使用しない場面

- 外部ツールの出力を根拠なくそのまま実装しない。
- AI UI 生成結果を仕様確定済みとして扱わない。
- snapshot 情報を最新事実として断定しない。
- MVP 実装中に npm 依存を増やす口実にしない。
- 外部記事の一般論を、MVP の承認済みスコープより優先しない。
- 外部 preview の見た目だけを根拠に、設計書の責務やデータ構造を変更しない。

## セキュリティ / 依存追加方針

- 外部ツールへ個人データや実 DB 内容を渡さない。
- Claude Design / Google Stitch へ投入する場合はサンプルデータ化する。
- API key、環境変数、ローカル DB パス、バックアップファイル名などの秘密情報や環境固有情報を外部ツールへ渡さない。
- npm 依存追加が必要な場合は別タスク化し、`npm audit`、署名確認、exact version を前提にする。
- 外部サイトは設計補助であり、正本はリポジトリ内 docs とする。
- 外部 AI ツールの生成コードは、ライセンス、依存、セキュリティ、アクセシビリティ、既存設計との整合性をレビューしてから採用する。

## 参照元 URL カタログの扱い

参照元 URL は、根拠確認、再要約、snapshot 更新時の入口です。レビュー時は URL 一覧そのものではなく、プロジェクト内の設計書、review_rule、fix_pattern、cross-cutting rule に変換された知識を優先します。

| 対象 | URL | 用途 |
| --- | --- | --- |
| DocBase Markdown 記法 | https://help.docbase.io/posts/13697 | Markdown 記法確認 |
| DocBase Mermaid 記法 | https://help.docbase.io/posts/3719897 | Mermaid 記法確認 |
| Mermaid 記法ライブプレビュー | https://creative-garagebox.com/tools/mermaid_live_preview.html | Mermaid 表示確認 |
| Marp ライブプレビュー | https://creative-garagebox.com/tools/marp_markdown_preview.html | Marp 表示確認 |
| Google Stitch | https://stitch.withgoogle.com/ | UI プロトタイプ支援 |
| Claude Design | https://claude.ai/design | UI / デザイン生成支援 |
| Red Hat オーケストレーション | https://www.redhat.com/ja/topics/automation/what-is-orchestration | Manager / Worker 運用概念の補助 |

その他の要件定義、基本設計、DB 定義書、画面設計、Docs-as-Code、AI 駆動開発の記事は、設計レビュー観点の補強に使います。外部サイトの内容を長文転載せず、このリポジトリの文脈に合わせてチェック項目やタスクへ変換します。
