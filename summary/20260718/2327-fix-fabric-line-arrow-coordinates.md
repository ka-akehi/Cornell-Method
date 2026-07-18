# Canvas 直線・矢印の Fabric 座標修正

## Objective

CanvasDocument の絶対座標契約を維持したまま、Fabric の直線・矢印を任意の位置と方向へ描画・保存・再読込できるようにする。選択ツールでの移動や、描画ツールで既存オブジェクトを押した際の余計な描画も防ぐ。

## Scope

| 項目 | 内容 |
|---|---|
| 対象領域 | Fabric Canvas の座標変換と描画イベント |
| 対象ファイル / ディレクトリ | `src/app/spikes/canvas/_lib/fabric-adapter.ts`、`src/app/notes/_components/note-canvas-editor.tsx`、`src/app/spikes/canvas/_components/fabric-canvas-panel.tsx` |
| 対象外 | Canvas JSON、Prisma/API、DB migration、消しゴム仕様、対象外リファクタリング |

## Inputs Read

| 種別 | パス | 確認内容 |
|---|---|---|
| handoff | `HANDOFF_2026-07-17.md` | 現行の未コミット方針と Canvas の後続作業状況 |
| implementation | `src/app/spikes/canvas/_lib/fabric-adapter.ts` | Fabric オブジェクト生成と保存変換 |
| implementation | `src/app/notes/_components/note-canvas-editor.tsx` | Note Canvas の pointer event と履歴 commit |
| library source | `node_modules/fabric/src/shapes/Line.ts`、`Polyline.ts`、`Group.ts` | Fabric 7.4.0 の原点・layout 挙動 |

## Changes Made

| パス | 変更内容 | 理由 |
|---|---|---|
| `src/app/spikes/canvas/_lib/fabric-adapter.ts` | 点列をローカル座標化し、用紙上の bounds と runtime の基準位置をメタデータ化。保存時は Group 外接矩形ではなく点列と移動量から復元し、矢印 Group は内部 Polyline の実座標へ補正。Arrow の strokeWidth も内部線から保持。 | 原点吸着、矢印先端側の Group layout ずれ、保存時の先端変形を防ぐため |
| `src/app/notes/_components/note-canvas-editor.tsx` | 選択ツール中は描画 drag を解除し、line/arrow/shape は既存 object 上の mouse:down で新規 drag を開始しない。Freehand Path に Fabric 原点を保持。 | 移動時の余計な線生成とフリーハンドの座標ずれを防ぐため |
| `src/app/spikes/canvas/_components/fabric-canvas-panel.tsx` | Spike 側にも同じ描画開始ガードと Path 原点保持を適用。 | アダプター利用箇所の挙動を一致させるため |
| `summary/20260718/2327-fix-fabric-line-arrow-coordinates.md` | 完了要約を追加。 | 次回作業の再開情報を残すため |

## Findings

| ID | fact / assumption / unknown | 内容 | 根拠 |
|---|---|---|---|
| F-001 | fact | Fabric 7 の Polyline は内部 points/pathOffset、Line は中心基準、Arrow Group は先端の外接矩形を含む。 | Fabric 7.4.0 の local source と実体スモークテスト |
| F-002 | fact | 1920x1080 の前方・逆方向の line/arrow で、初期表示と保存点列、移動後の点列が一致した。 | Fabric coordinate smoke test |
| U-001 | unknown | ブラウザ実機での pointer 操作確認は未実施。sandbox が `listen EPERM` で Next server 起動を拒否した。 | `npm run start -- --hostname 127.0.0.1 --port 3100` |

## Verification

| 確認項目 | 結果 | 備考 |
|---|---|---|
| `npm run lint` | PASS | ESLint 成功 |
| `npx tsc --noEmit --pretty false` | PASS | TypeScript 成功 |
| `npm run build` | PASS | Next.js webpack build 成功 |
| `git diff --check` | PASS | whitespace error なし |
| Fabric coordinate smoke test | PASS | 1920x1080、前後方向、Group 移動、stroke round-trip を確認 |
| ブラウザ実機確認 | 未実施 | sandbox の server listen 制約 |

## Remaining Unknowns

| ID | 未確認事項 | 次に必要な根拠 |
|---|---|---|
| U-001 | ブラウザ上の実 pointer 操作、保存 API 経由の再読込、ページスクロールとの組み合わせ | listen 可能な開発環境で `/notes/new` または fixture 付き E2E を実行 |

## Next Read

次に読むべき最小ファイルだけを記載する。

- `summary/20260718/2327-fix-fabric-line-arrow-coordinates.md`
- `src/app/spikes/canvas/_lib/fabric-adapter.ts`
- `src/app/notes/_components/note-canvas-editor.tsx`

