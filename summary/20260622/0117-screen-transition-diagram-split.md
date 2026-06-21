# Task Summary: Screen Transition Diagram Split

## Objective

`doc/diagrams/MVP_SCREEN_TRANSITION_DIAGRAM.md` の1枚構成の画面遷移図を、設計レビューで読みやすい複数SVGへ分割する。

## Scope

| 項目 | 内容 |
|---|---|
| 対象領域 | 画面遷移図、Mermaid生成物、図対応表、可読性監査表 |
| 対象ファイル / ディレクトリ | `doc/diagrams/MVP_SCREEN_TRANSITION_DIAGRAM.md`, `doc/diagrams/assets/mmd/*screen-transition*`, `doc/diagrams/assets/svg/*screen-transition*`, `doc/diagrams/DIAGRAM_ASSETS.md`, `doc/diagrams/DIAGRAM_READABILITY_AUDIT.md` |
| 対象外 | アプリ実装、SVG直接編集、画面遷移の意味変更 |

## Inputs Read

| 種別 | パス | 確認内容 |
|---|---|---|
| 作業前状態 | `git status --short` | 既存の未コミット変更が多数あることを確認 |
| 監査表 | `doc/diagrams/DIAGRAM_READABILITY_AUDIT.md` | 対象SVGが `Split recommended` である理由を確認 |
| 正本 | `doc/diagrams/MVP_SCREEN_TRANSITION_DIAGRAM.md` | 現行1図の構成と遷移ラベルを確認 |
| 生成スクリプト | `scripts/extract-mermaid-diagrams.js`, `scripts/render-mermaid-diagrams.js` | 章見出しから `.mmd` / `.svg` 名が生成されること、SVGに白背景rectが挿入されることを確認 |

## Changes Made

| パス | 変更内容 | 理由 |
|---|---|---|
| `doc/diagrams/MVP_SCREEN_TRANSITION_DIAGRAM.md` | Mermaidブロックを `Main route`, `Detail modes`, `Support routes` の3図へ分割 | 主要導線、詳細内モード、補助導線の密度を下げるため |
| `doc/diagrams/assets/mmd/*screen-transition*` | `npm run diagrams:build` で3件へ再生成 | 正本Markdownから生成物を更新するため |
| `doc/diagrams/assets/svg/*screen-transition*` | `npm run diagrams:build` で3件へ再生成 | SVG直接編集を避け、白背景付きSVGを更新するため |
| `doc/diagrams/DIAGRAM_ASSETS.md` | 画面遷移図の対応表を3件へ更新 | 正本と生成物の対応を最新化するため |
| `doc/diagrams/DIAGRAM_READABILITY_AUDIT.md` | 対象分類を `OK` へ更新し、件数と生成後パスを更新 | `Split recommended` の解消を監査表へ反映するため |

## Findings

| ID | fact / assumption / unknown | 内容 | 根拠 |
|---|---|---|---|
| F1 | fact | 画面遷移SVGは3件に分割された | `DIAGRAM_ASSETS.md` と `ls doc/diagrams/assets/svg/*screen-transition*` |
| F2 | fact | 3件のSVGは白背景rectを保持している | SVG確認スクリプトで `white_background_missing=0` |
| F3 | fact | 詳細内モード図は戻り操作を操作ノード化するとラベル集中が軽減した | PNG目視確認 |
| F4 | fact | `npm run diagrams:build` は成功し、全体で22図を生成した | コマンド結果 `Extracted 22 Mermaid diagrams.` / `Rendered 22 SVG diagrams.` |

## Verification

| 確認項目 | 結果 | 備考 |
|---|---|---|
| `npm run diagrams:build` | 成功 | `.mmd` / `.svg` / `DIAGRAM_ASSETS.md` を再生成 |
| 一時PNG化 | 成功 | 出力先: `/tmp/cornell-screen-transition-png/` |
| 目視確認 | 成功 | 横幅、ラベル重なり、白背景を確認 |
| 作業後状態 | 確認済み | 既存の未コミット変更は戻していない |

## Remaining Unknowns

| ID | 未確認事項 | 次に必要な根拠 |
|---|---|---|
| なし | なし | なし |

## Next Read

- `doc/diagrams/MVP_SCREEN_TRANSITION_DIAGRAM.md`
- `doc/diagrams/DIAGRAM_READABILITY_AUDIT.md`
- `doc/diagrams/DIAGRAM_ASSETS.md`
