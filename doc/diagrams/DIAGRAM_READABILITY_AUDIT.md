# Diagram Readability Audit

監査日: 2026-06-22

## Scope

- 起点: `doc/diagrams/DIAGRAM_ASSETS.md`
- 対象SVG総数: 23
- 対象ディレクトリ:
  - `doc/diagrams/assets/svg/*.svg`
  - `doc/workflows/assets/svg/*.svg`
  - `doc/screens/assets/svg/*.svg`
- 確認方法:
  - `npm run diagrams:build` で正本Markdownから `.mmd` / `.svg` を再生成。
  - Playwright Chromium で各SVGを生成し、ラベル欠け、線と文字の重なり、図の過密さ、白背景維持を確認。
  - 状態図は `rsvg-convert` で一時PNGへ変換し、線の集中が分散されていることを確認。ただし Mermaid の `foreignObject` ラベルは `rsvg-convert` では描画されないため、ラベル内容はSVG本文で確認。
  - 一時PNG出力先: `/tmp/cornell-state-diagram-split-png/`

## Classification Summary

| Classification | Count |
| --- | ---: |
| OK | 18 |
| Minor fix | 5 |
| Split recommended | 0 |
| Needs decision | 0 |

## Diagram Review Table

| Category | Source Markdown | SVG path | Classification | Finding | Action taken / Proposed follow-up |
| --- | --- | --- | --- | --- | --- |
| diagrams | `doc/diagrams/MVP_BUSINESS_FLOW_DIAGRAMS.md` | `doc/diagrams/assets/svg/mvp-business-flow-diagrams-01-diagram.svg` | OK | 縦長だが各ノードと分岐ラベルは読める。分岐後の戻り線が長いが、意味は追跡可能。 | 修正なし。未修正理由: 可読性上の阻害は軽微で、正本の構造変更は不要。 |
| diagrams | `doc/diagrams/MVP_BUSINESS_FLOW_DIAGRAMS.md` | `doc/diagrams/assets/svg/mvp-business-flow-diagrams-02-diagram.svg` | OK | 検索フローは適度な密度。分岐ラベルも判読可能。 | 修正なし。 |
| diagrams | `doc/diagrams/MVP_BUSINESS_FLOW_DIAGRAMS.md` | `doc/diagrams/assets/svg/mvp-business-flow-diagrams-03-diagram.svg` | OK | 縦長だが、復習開始から更新までの流れは一方向に追える。 | 修正なし。 |
| diagrams | `doc/diagrams/MVP_BUSINESS_FLOW_DIAGRAMS.md` | `doc/diagrams/assets/svg/mvp-business-flow-diagrams-04-diagram.svg` | OK | 削除確認からバックアップ要否までの分岐は読める。分岐ラベルが線に近い箇所はあるが判読可能。 | 修正なし。未修正理由: ラベル位置の微調整だけを目的に意味を変える必要はない。 |
| diagrams | `doc/diagrams/MVP_BUSINESS_FLOW_DIAGRAMS.md` | `doc/diagrams/assets/svg/mvp-business-flow-diagrams-05-diagram.svg` | OK | バックアップ確認フローはノード間隔が十分で読める。 | 修正なし。 |
| diagrams | `doc/diagrams/MVP_ER_DIAGRAM.md` | `doc/diagrams/assets/svg/mvp-er-diagram-01-notebook-cue-tag-notebooktag.svg` | OK | テーブル列とリレーション線は判読可能。Notebook と Cue の接続部は近いが、関係ラベルは読める。 | 修正なし。 |
| diagrams | `doc/diagrams/MVP_SCREEN_TRANSITION_DIAGRAM.md` | `doc/diagrams/assets/svg/mvp-screen-transition-diagram-01-main-route-root-nav-notes-new-detail.svg` | OK | 主要導線だけに分割され、起点、共通ナビ、一覧、新規、詳細の流れを横方向に追える。横幅は約1430pxで、元の1枚図より縮小時のラベル負担が下がった。 | 正本Markdownを `Main route: root nav notes new detail` として分割し、SVG再生成済み。 |
| diagrams | `doc/diagrams/MVP_SCREEN_TRANSITION_DIAGRAM.md` | `doc/diagrams/assets/svg/mvp-screen-transition-diagram-02-detail-modes-view-edit-review.svg` | OK | 詳細閲覧、編集、復習のモード遷移だけに分割され、保存成功、キャンセル、閲覧へ戻る、復習済みの戻り操作も判読可能。 | 正本Markdownを `Detail modes: view edit review` として分割し、戻り操作はラベル集中を避けるため操作ノードとして表現。SVG再生成済み。 |
| diagrams | `doc/diagrams/MVP_SCREEN_TRANSITION_DIAGRAM.md` | `doc/diagrams/assets/svg/mvp-screen-transition-diagram-03-support-routes-backup-cancel-delete-return.svg` | OK | バックアップ確認、キャンセル、削除成功後の戻りなど補助導線だけに分割され、主要導線図と詳細モード図から補助線を分離できている。 | 正本Markdownを `Support routes: backup cancel delete return` として分割し、SVG再生成済み。 |
| diagrams | `doc/diagrams/MVP_SEQUENCE_DIAGRAMS.md` | `doc/diagrams/assets/svg/mvp-sequence-diagrams-01-diagram.svg` | Minor fix | API参加者名にHTTPメソッドとパスを入れると見出しが長くなりやすい。 | 正本Markdownで参加者名を `Notes API` に短縮し、`POST /api/notes` はメッセージ側へ移動。SVG再生成済み。 |
| diagrams | `doc/diagrams/MVP_SEQUENCE_DIAGRAMS.md` | `doc/diagrams/assets/svg/mvp-sequence-diagrams-02-diagram.svg` | Minor fix | API参加者名と検索パラメータ表現が横方向に長くなりやすい。 | 正本Markdownで参加者名を `Notes API` に短縮し、リクエストメッセージを `GET /api/notes?query/tag/from/to` に整理。SVG再生成済み。 |
| diagrams | `doc/diagrams/MVP_SEQUENCE_DIAGRAMS.md` | `doc/diagrams/assets/svg/mvp-sequence-diagrams-03-diagram.svg` | Minor fix | `PATCH /api/notes/:id` の参加者見出しが枠に詰まっていた。 | 正本Markdownで参加者名を `Notes API` に短縮し、`PATCH /api/notes/:id` はメッセージ側へ移動。SVG再生成済み。 |
| diagrams | `doc/diagrams/MVP_SEQUENCE_DIAGRAMS.md` | `doc/diagrams/assets/svg/mvp-sequence-diagrams-04-diagram.svg` | Minor fix | `POST /api/notes/:id/review` の参加者見出しが長く、枠内余白が不足していた。 | 正本Markdownで参加者名を `Review API` に短縮し、エンドポイントはメッセージ側へ移動。SVG再生成済み。 |
| diagrams | `doc/diagrams/MVP_SEQUENCE_DIAGRAMS.md` | `doc/diagrams/assets/svg/mvp-sequence-diagrams-05-diagram.svg` | Minor fix | API参加者名がHTTP操作名になっており、他の修正後シーケンス図と表記粒度が揃っていなかった。 | 正本Markdownで参加者名を `Backup API` に短縮し、`POST /api/backups` はメッセージ側へ移動。SVG再生成済み。 |
| diagrams | `doc/diagrams/MVP_STATE_DIAGRAMS.md` | `doc/diagrams/assets/svg/mvp-state-diagrams-01-normal-mode-transitions.svg` | OK | 通常モード遷移は flowchart 化され、編集終了、復習終了、閲覧へ戻るの操作ノードで戻り線とラベル密集が整理されている。 | 正本Markdownを更新し、SVG再生成済み。 |
| diagrams | `doc/diagrams/MVP_STATE_DIAGRAMS.md` | `doc/diagrams/assets/svg/mvp-state-diagrams-02-delete-transitions.svg` | OK | 削除遷移は左から右に読み進められ、キャンセル、削除成功、削除失敗の分岐が削除確認から明確に分かれる。 | 正本Markdownを更新し、SVG再生成済み。 |
| diagrams | `doc/diagrams/MVP_STATE_DIAGRAMS.md` | `doc/diagrams/assets/svg/mvp-state-diagrams-03-error-recovery-transitions.svg` | OK | エラー復帰遷移は正常ロード、操作中、エラー、再取得の流れに整理され、失敗元ラベルは操作中ノードから集約されている。 | 正本Markdownを更新し、SVG再生成済み。 |
| diagrams | `doc/diagrams/MVP_STATE_DIAGRAMS.md` | `doc/diagrams/assets/svg/mvp-state-diagrams-04-diagram.svg` | OK | 復習状態は左から右に、復習予定なし、復習予定あり、復習期限到来、復習済みの関係を追える。 | 正本Markdownを flowchart 化し、SVG再生成済み。 |
| workflows | `doc/workflows/MVP_WORKFLOW_DESIGN.md` | `doc/workflows/assets/svg/mvp-workflow-design-01-diagram.svg` | OK | 縦長だが、作成から保存までの流れは上から下へ追える。 | 修正なし。 |
| workflows | `doc/workflows/MVP_WORKFLOW_DESIGN.md` | `doc/workflows/assets/svg/mvp-workflow-design-02-diagram.svg` | OK | 対象確認から復習済み更新までの縦方向フローは長いが、分岐ラベルとノードは読める。 | 修正なし。 |
| workflows | `doc/workflows/MVP_WORKFLOW_DESIGN.md` | `doc/workflows/assets/svg/mvp-workflow-design-03-diagram.svg` | OK | 削除前確認フローは分岐が明確で読める。 | 修正なし。 |
| screens | `doc/screens/MVP_SCREEN_DESIGN.md` | `doc/screens/assets/svg/mvp-screen-design-01-diagram.svg` | OK | 画面遷移の概要図として十分に簡潔。 | 修正なし。 |
| screens | `doc/screens/MVP_SCREEN_INVENTORY.md` | `doc/screens/assets/svg/mvp-screen-inventory-01-diagram.svg` | OK | 線の交差はあるが、画面IDと主要遷移ラベルは読める。詳細な画面説明は同一Markdown本文にあるため、図は補助として成立している。 | 修正なし。未修正理由: 現状は補助図として許容範囲。 |

## Fixed Items

- `doc/diagrams/MVP_SCREEN_TRANSITION_DIAGRAM.md`
  - 1枚に集中していた画面遷移図を「主要導線」「詳細内モード」「補助導線」の3図へ分割。
  - 詳細内モード図では戻り操作を操作ノードとして表現し、同一ノード間のラベル集中を緩和。
- `doc/diagrams/MVP_SEQUENCE_DIAGRAMS.md`
  - ノート作成シーケンス: `POST /api/notes` を参加者名からメッセージへ移動し、参加者名を `Notes API` に短縮。
  - ノート検索シーケンス: 参加者名を `Notes API` に短縮し、検索リクエスト表現を整理。
  - ノート編集シーケンス: `PATCH /api/notes/:id` を参加者名からメッセージへ移動し、参加者名を `Notes API` に短縮。
  - 復習済み更新シーケンス: `POST /api/notes/:id/review` を参加者名からメッセージへ移動し、参加者名を `Review API` に短縮。
  - バックアップ作成シーケンス: `POST /api/backups` を参加者名からメッセージへ移動し、参加者名を `Backup API` に短縮。
- `doc/diagrams/MVP_STATE_DIAGRAMS.md`
  - 詳細画面モードを「通常モード遷移」「削除遷移」「エラー復帰遷移」の3図へ分割。
  - 状態遷移図4件を flowchart 化し、戻り操作と失敗元を中間ノードで整理。
- `npm run diagrams:build` により `.mmd` / `.svg` / `DIAGRAM_ASSETS.md` を再生成済み。

## Unfixed Items And Reasons

| Item | Reason |
| --- | --- |
| なし | 今回の監査表上の `Split recommended` は解消済み。 |

## Follow-Up Task Candidates

1. 今後、画面遷移や状態遷移に Phase 2 画面を追加する場合は、既存図へ集約せず導線単位で図を追加する。

## Verification Commands And Results

| Command | Result |
| --- | --- |
| `git status --short` | 作業前に確認済み。既存の未コミット変更が多数あり、今回の作業では戻していない。 |
| `rsvg-convert -w 1400 ... doc/diagrams/assets/svg/*state-diagrams*.svg` | 成功。状態図4件を `/tmp/cornell-state-diagram-split-png/` へ一時PNG化。MermaidのHTMLラベルは描画されないため、線配置確認用として使用。 |
| `node ... Playwright Chromium ...` | 状態図PNG化は macOS sandbox 制限で失敗。SVG生成自体は `npm run diagrams:build` 内の Playwright Chromium で成功。 |
| `npm run diagrams:build` | 成功。`Extracted 23 Mermaid diagrams.` / `Rendered 23 SVG diagrams.` |
| 白背景確認スクリプト | 成功。状態図4件すべてのSVGに `<rect x="0" y="0" width="100%" height="100%" fill="#ffffff"/>` が存在。 |
