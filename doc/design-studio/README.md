# Cornell Design Studio

確認日: 2026-06-21

## 目的

Cornell Design Studio は、Google Stitch / Claude Design のような「画面案を作り、比較し、実装へ渡す」流れを、このリポジトリ内で運用するためのローカル設計環境です。

外部サービスを直接代替するのではなく、Codex の plugin / skill、既存の設計書、Worker キュー、ブラウザ確認を組み合わせて、次の成果物を Git 管理できる形にします。

- 画面設計ブリーフ
- UI バリエーション案
- UX / アクセシビリティレビュー
- 実装ハンドオフ
- Worker タスク
- 設計書への反映記録

## 構成

| パス | 用途 |
| --- | --- |
| `.agents/plugins/marketplace.json` | このリポジトリ用の Codex plugin marketplace |
| `.agents/plugins/plugins/cornell-design-studio/` | Cornell Design Studio plugin |
| `doc/design-studio/templates/` | 設計依頼、比較レビュー、実装受け渡しのテンプレート |
| `doc/design-studio/intake/` | 画面設計依頼や検討開始時のブリーフ |
| `doc/design-studio/outputs/` | バリエーション比較、採用判断、レビュー結果 |

## Codex CLI での有効化

この marketplace は repo-local なので、初回のみ Codex CLI に marketplace を追加します。

```sh
codex plugin marketplace add /Users/kazuya/Desktop/自己学習/Cornell-Method
codex plugin add cornell-design-studio@cornell-method-local
```

plugin を追加した後は、新しい Codex セッションで反映を確認します。

## 基本フロー

1. 対象画面や業務フローを決める。
2. `templates/design-brief.md` を使って目的、制約、対象ユーザー、採用範囲を整理する。
3. Codex に 2〜3 案の UI バリエーションを作らせる。
4. `templates/variant-review.md` を使って、MVP 仕様、操作性、アクセシビリティ、実装コストで比較する。
5. 採用案を `templates/implementation-handoff.md` に落とし込む。
6. 必要に応じて `codex-queue/tasks-ui` へ Worker タスク化する。
7. 実装後にブラウザ確認、lint/build、設計書同期を行う。

## Stitch / Claude Design との対応

| Stitch / Claude Design 的な作業 | このリポジトリでの代替 |
| --- | --- |
| プロンプトから画面案を生成 | design brief から Codex がテキストワイヤー / 実装案を作成 |
| 複数デザイン案の比較 | variant review で比較表として管理 |
| デザインカンプ確認 | 実装プロトタイプを Browser / Playwright で確認 |
| 採用案をコード化 | implementation handoff から Worker タスク化 |
| 設計と実装の整合確認 | MVP 設計書、テスト観点、summary に反映 |

## セキュリティ

- 実 DB、バックアップファイル、API key、環境変数、個人データを外部ツールへ渡さない。
- 外部サービスを使う場合は、ダミーデータだけを投入する。
- 外部ツールの生成コードは、そのまま採用せず、依存、ライセンス、アクセシビリティ、既存設計との整合を確認する。

## 成果物命名

```text
doc/design-studio/intake/YYYYMMDD-<screen-or-flow>-brief.md
doc/design-studio/outputs/YYYYMMDD-<screen-or-flow>-variants.md
doc/design-studio/outputs/YYYYMMDD-<screen-or-flow>-handoff.md
```

例:

```text
doc/design-studio/intake/20260621-notes-list-brief.md
doc/design-studio/outputs/20260621-notes-list-variants.md
doc/design-studio/outputs/20260621-notes-list-handoff.md
```
