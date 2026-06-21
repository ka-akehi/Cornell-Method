# Diagram Outputs

このディレクトリは、UML、業務フロー、画面遷移、ER 図などの視覚確認用成果物を管理します。

## Structure

```text
doc/diagrams/
  *.md
  DIAGRAM_ASSETS.md
  assets/mmd/
    *.mmd
  assets/svg/
    *.svg
```

`doc/workflows/` と `doc/screens/` に含まれる Mermaid 図は、それぞれの分類内に出力します。

```text
doc/workflows/assets/mmd/
doc/workflows/assets/svg/
doc/screens/assets/mmd/
doc/screens/assets/svg/
```

## Rules

- 図を含む設計書は Markdown だけで終わらせず、`.mmd` と `.svg` も生成します。
- `assets/mmd/` は Mermaid source です。
- `assets/svg/` は Mermaid から生成した視覚確認用成果物です。
- `assets/svg/` は直接編集しません。元の Mermaid を修正して再生成します。
- `assets/svg/` はプレビュー時に背景が透過しないよう、白背景を明示して生成します。
- 図の正本は、該当する設計書内の Mermaid または `mmd/` の Mermaid source です。

## Generate

```bash
npm run diagrams:build
```

個別に実行する場合:

```bash
npm run diagrams:extract
npm run diagrams:svg
```

`diagrams:extract` は `doc/diagrams`, `doc/workflows`, `doc/screens` の Markdown から Mermaid ブロックを抽出します。

`diagrams:svg` は各分類の `assets/mmd/*.mmd` を `assets/svg/*.svg` に変換します。

## Dependency

SVG 生成には `mermaid` と Playwright Chromium を使います。追加の Chromium ダウンロードは行いません。
