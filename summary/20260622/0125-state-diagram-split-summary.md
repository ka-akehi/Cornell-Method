# Task Summary: State Diagram Split

## Objective

`doc/diagrams/MVP_STATE_DIAGRAMS.md` の詳細画面モード状態図を、設計レビューで読みやすい複数SVGへ分割する。

## Scope

| 項目 | 内容 |
|---|---|
| 対象領域 | diagrams |
| 対象ファイル / ディレクトリ | `doc/diagrams/MVP_STATE_DIAGRAMS.md`, `doc/diagrams/assets/mmd/*state-diagrams*`, `doc/diagrams/assets/svg/*state-diagrams*`, `doc/diagrams/DIAGRAM_ASSETS.md`, `doc/diagrams/DIAGRAM_READABILITY_AUDIT.md` |
| 対象外 | SVG直接編集、図の意味を削る見た目だけの整理 |

## Inputs Read

| 種別 | パス | 確認内容 |
|---|---|---|
| 指示 | `doc/diagrams/DIAGRAM_READABILITY_AUDIT.md` | 対象SVGの `Split recommended` 理由 |
| 正本 | `doc/diagrams/MVP_STATE_DIAGRAMS.md` | 詳細画面モードの既存 Mermaid |
| 生成 | `scripts/extract-mermaid-diagrams.js`, `scripts/render-mermaid-diagrams.js` | 見出しから `.mmd` / `.svg` / 対応表が生成されること |

## Changes Made

| パス | 変更内容 | 理由 |
|---|---|---|
| `doc/diagrams/MVP_STATE_DIAGRAMS.md` | 詳細画面モードを通常モード遷移、削除遷移、エラー復帰遷移の3 Mermaid ブロックへ分割 | 旧1枚図の遷移線とラベル集中を解消するため |
| `doc/diagrams/assets/mmd/*state-diagrams*` | `npm run diagrams:build` で再生成 | 正本Markdownと生成物を一致させるため |
| `doc/diagrams/assets/svg/*state-diagrams*` | `npm run diagrams:build` で再生成 | 分割後SVGを生成するため |
| `doc/diagrams/DIAGRAM_ASSETS.md` | `npm run diagrams:build` で再生成 | Mermaid source / SVG 対応表を更新するため |
| `doc/diagrams/DIAGRAM_READABILITY_AUDIT.md` | 状態図の分類、件数、検証結果を更新 | `Split recommended` 解消を記録するため |

## Findings

| ID | fact / assumption / unknown | 内容 | 根拠 |
|---|---|---|---|
| F1 | fact | 詳細画面モードは3SVGへ分割された。 | `DIAGRAM_ASSETS.md` の `mvp-state-diagrams-01/02/03` |
| F2 | fact | 状態図SVG4件は白背景rectを持つ。 | `grep -L '<rect ... fill="#ffffff"/>' doc/diagrams/assets/svg/*state-diagrams*.svg` が空 |
| F3 | fact | `rsvg-convert` では Mermaid の `foreignObject` ラベルは描画されない。 | 一時PNG目視 |
| F4 | fact | Playwright のPNG化は macOS sandbox 制限で失敗したが、SVG生成は `npm run diagrams:build` 内で成功した。 | コマンド実行結果 |

## Verification

| 確認項目 | 結果 | 備考 |
|---|---|---|
| 作業前 `git status --short` | 実施 | 既存の未コミット変更多数。戻していない。 |
| `npm run diagrams:build` | 成功 | `Extracted 23 Mermaid diagrams.` / `Rendered 23 SVG diagrams.` |
| 一時PNG化 | 成功 | `rsvg-convert -w 1400 ... doc/diagrams/assets/svg/*state-diagrams*.svg`; 出力先 `/tmp/cornell-state-diagram-split-png/` |
| 白背景確認 | 成功 | 状態図SVG4件で白背景rectあり |
| 作業後 `git status --short` | 実施 | `doc/diagrams/` はGit上未追跡ディレクトリとして表示 |

## Remaining Unknowns

| ID | 未確認事項 | 次に必要な根拠 |
|---|---|---|
| U1 | ブラウザPNGでのラベル目視 | macOS sandbox 制限のない環境で Playwright screenshot を実行 |

## Next Read

次に読むべき最小ファイルだけを記載する。

- `doc/diagrams/MVP_STATE_DIAGRAMS.md`
- `doc/diagrams/DIAGRAM_ASSETS.md`
- `doc/diagrams/DIAGRAM_READABILITY_AUDIT.md`
