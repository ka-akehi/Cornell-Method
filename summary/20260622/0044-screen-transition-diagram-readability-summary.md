# Screen Transition Diagram Readability Summary

## Objective

`doc/diagrams/assets/svg/mvp-screen-transition-diagram-01-notes-notesnew-notesid-backup.svg` の可読性を、正本 Mermaid からの再生成運用を守って改善する。

## Scope

| 項目 | 内容 |
|---|---|
| 対象領域 | MVP 画面遷移図 |
| 対象ファイル / ディレクトリ | `doc/diagrams/MVP_SCREEN_TRANSITION_DIAGRAM.md`, `doc/diagrams/assets/mmd/`, `doc/diagrams/assets/svg/` |
| 対象外 | SVG の手作業編集、追加依存関係導入 |

## Inputs Read

| 種別 | パス | 確認内容 |
|---|---|---|
| 正本 | `doc/diagrams/MVP_SCREEN_TRANSITION_DIAGRAM.md` | 対象 Mermaid の現状構成 |
| 生成元 | `doc/diagrams/assets/mmd/mvp-screen-transition-diagram-01-notes-notesnew-notesid-backup.mmd` | 抽出済み Mermaid |
| 生成処理 | `scripts/extract-mermaid-diagrams.js`, `scripts/render-mermaid-diagrams.js` | 抽出・SVG生成・白背景挿入の流れ |

## Changes Made

| パス | 変更内容 | 理由 |
|---|---|---|
| `doc/diagrams/MVP_SCREEN_TRANSITION_DIAGRAM.md` | 対象 Mermaid を主要導線、詳細内モード、補助導線の subgraph 構成へ整理し、ラベルを短縮。HTML 改行を除去し、クラス色を追加。 | 主要導線、戻り導線、編集/復習モードを判別しやすくし、SVG/XML変換時の `<br>` 問題を避けるため。 |
| `doc/diagrams/assets/mmd/mvp-screen-transition-diagram-01-notes-notesnew-notesid-backup.mmd` | `npm run diagrams:build` により正本から再抽出。 | 正本と生成元を同期するため。 |
| `doc/diagrams/assets/svg/mvp-screen-transition-diagram-01-notes-notesnew-notesid-backup.svg` | `npm run diagrams:build` により再生成。 | 正本 Mermaid から生成物を更新するため。 |
| `doc/diagrams/DIAGRAM_ASSETS.md` | `npm run diagrams:build` により再生成。 | Mermaid source / SVG 対応表を同期するため。 |

## Findings

| ID | fact / assumption / unknown | 内容 | 根拠 |
|---|---|---|---|
| F1 | fact | 変更前の対象SVGは `<br>` 由来で `rsvg-convert` / `xmllint` がXMLとして読めなかった。 | `rsvg-convert` と `xmllint --noout` のエラー。 |
| F2 | fact | SVG生成スクリプトは白背景 `<rect ... fill="#ffffff"/>` を挿入する。 | `scripts/render-mermaid-diagrams.js` の `withWhiteBackground`。 |
| F3 | fact | 更新後SVGは `xmllint --noout` と `rsvg-convert` に通る。 | 検証コマンド結果。 |
| F4 | fact | `rsvg-convert` は Mermaid の `foreignObject` ノード文字をPNG上で表示しないため、視認確認はPlaywright/Chromiumスクリーンショットでも実施した。 | `/tmp/cornell-diagram-check/updated.png` と `/tmp/cornell-diagram-check/updated-browser.png` の確認。 |

## Verification

| 確認項目 | 結果 | 備考 |
|---|---|---|
| `npm run diagrams:build` | 成功 | 19 diagrams extracted/rendered。 |
| SVG XML妥当性 | 成功 | `xmllint --noout` 成功。 |
| PNG変換 | 成功 | `rsvg-convert` で `/tmp/cornell-diagram-check/updated.png` を生成。 |
| ブラウザ視認 | 成功 | Playwright screenshot `/tmp/cornell-diagram-check/updated-browser.png` で文字、ラベル、白背景、主要導線の分離を確認。 |
| 作業後 status | 確認済み | 既存の大量未コミット変更があり、対象 `doc/diagrams/` は未追跡配下。 |

## Remaining Unknowns

| ID | 未確認事項 | 次に必要な根拠 |
|---|---|---|
| U1 | Mermaid が `htmlLabels: false` 指定後も一部ノードラベルを `foreignObject` として出す理由。 | Mermaid v11 のレンダリング仕様確認。現タスクの完了条件には影響なし。 |

## Next Read

- `doc/diagrams/MVP_SCREEN_TRANSITION_DIAGRAM.md`
- `doc/diagrams/assets/svg/mvp-screen-transition-diagram-01-notes-notesnew-notesid-backup.svg`
