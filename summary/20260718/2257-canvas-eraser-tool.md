# Canvas 消しゴムツール実装

## Task

Canvas の「消去」を、ポインタでクリックまたはドラッグして触れた Fabric オブジェクト全体を削除する「消しゴム」へ変更。

## Changes

- `note-canvas-toolbar.tsx`
  - 表示名を「消しゴム」へ変更。
  - aria-label / title / description をクリックまたはなぞり操作の説明へ更新。
- `note-canvas-editor.tsx`
  - Fabric の `event.target` を利用して、mouse down / move 中の対象を除去。
  - 1 回の操作で削除した対象を `Set` で重複排除し、mouse up 時に 1 回だけ既存 commit / history 経路へ渡す。
  - 対象がない操作では履歴を追加しない。
  - 消しゴム中の選択解除と、テキスト編集終了イベントによる履歴分割を抑制。
- `globals.css`
  - 消しゴム選択中の Canvas カーソルを crosshair に変更。

CanvasDocument の型、schemaVersion、保存 API、DB、依存関係は変更していない。既存のページスクロール修正も保持した。

## Verification

- `npm run lint`: PASS
- `npx tsc --noEmit --pretty false`: PASS
- `npm run build`: PASS
- `git diff --check`: PASS
- 実ブラウザ確認: 未実施。browser runtime の利用可能ブラウザ一覧が空で、接続できなかった。

## Next Read

- `src/app/notes/_components/note-canvas-editor.tsx`
- `src/app/notes/_components/note-canvas-toolbar.tsx`
- `src/app/globals.css` の `.note-canvas-*`
