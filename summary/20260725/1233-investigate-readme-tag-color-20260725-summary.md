# README 掲載タグ色差分調査 Summary

## Objective

README に掲載した検証画像に実際のタグ色が写っているかを確認し、現行の編集・一覧・詳細画面で `tag.color` の表示が一致しない理由を切り分ける。実装 task に渡せる最小の修正方針を整理する。

## Scope

| 項目 | 内容 |
|---|---|
| 対象領域 | README 検証画像、タグ表示、MVP のタグ契約 |
| 対象ファイル / ディレクトリ | `README.md`、`doc/assets/screenshots/`、`src/modules/notes/ui/components/editor/tags.tsx`、`src/modules/notes/ui/components/list/card.tsx`、`src/modules/notes/ui/components/detail/display.tsx`、`doc/implementation/MVP_CONTRACT.md`、`AGENTS.md` |
| 対象外 | コード、設定、依存関係、DB、画像、README、生成物の変更 |

## Inputs Read

| 種別 | パス | 確認内容 |
|---|---|---|
| README | `README.md:83-114` | README が参照する9枚の画像と検証時期の記述 |
| 画像 | `doc/assets/screenshots/*.png` | 9枚を目視確認。サイズと Git 上の最終更新日も確認 |
| UI | 対象の3コンポーネント | 3画面の `tag.color` の利用方法と null 時の固定色 |
| 契約 | `doc/implementation/MVP_CONTRACT.md:100-145, 202-232` | `tags[].color` の payload、Tag API、nullable データ、Phase 2 境界 |
| 製品仕様 | `AGENTS.md:84-89, 153-160, 180-192` | タグ色の既定値、Tag の保存項目、API の位置づけ |
| 保存実装 / 型 | `src/modules/notes/contracts/tag.schema.ts`、`src/modules/notes/model/note-editor-form.payload.ts`、`src/server/notes/infrastructure/relations.repository.ts`、`prisma/schema.prisma` | color が nullable で、未指定の新規タグは null 保存されること。既存タグの color は更新しないこと |
| ローカル DB | `dev.db`（sqlite read-only） | 現在の保存値の例。README 画像の fixture とは別物として扱った |

## Changes Made

| パス | 変更内容 | 理由 |
|---|---|---|
| `summary/20260725/1233-investigate-readme-tag-color-20260725-summary.md` | 本調査の要約を新規作成 | Worker の完了条件として事実・推定・未確認事項を残すため |
| 対象コード・設定・DB・画像・README | 変更なし | 調査 task の制約 |

## Findings

| ID | fact / assumption / unknown | 内容 | 根拠 |
|---|---|---|---|
| F-01 | fact | README の `/notes` 画像は保存済みタグではなく `タグなし` のプレースホルダーだけを表示する。`/notes/[id]` の閲覧・復習画像も `タグなし`、新規作成4枚と編集画像もタグ欄が空で、色付きタグ chip は写っていない。バックアップ画像にタグはない。 | README の画像リンク `README.md:85-90` と9枚の目視確認 |
| F-02 | fact | README 画像は主に 2026-07-14〜15 の検証 fixture で、現在日付 2026-07-25 より古い。画像自体には色付きタグがないため、現行の色差を画像から検証できない。 | 画像の Git 上の最終更新日、`doc/testing/TEST_SCENARIOS.md` の記録、画像内容 |
| F-03 | fact | 編集欄は `tag.color` を style に使わず、`border-amber-200 bg-amber-50 text-amber-900` 固定。既存候補の color は state / payload には残るが、chip 表示には反映されない。自由入力の新規タグは `{ color: null }` で追加される。 | `src/modules/notes/ui/components/editor/tags.tsx:49-69, 86-103` |
| F-04 | fact | 一覧カードは `backgroundColor: tag.color ?? "#fef3c7"` として保存値を直接背景に使い、文字色は `text-stone-800` 固定。 | `src/modules/notes/ui/components/list/card.tsx:43-55` |
| F-05 | fact | 詳細画面は non-null color を枠色に使い、背景を `${color}1A` に変換する。文字色と null 時の枠は amber 固定で、一覧の全面色とは異なる。`${color}1A` は6桁 hex など特定の color 形式を前提にするが、現行 schema は color 形式を検証していない。 | `src/modules/notes/ui/components/detail/display.tsx:28-51`、`src/modules/notes/contracts/tag.schema.ts:9-18` |
| F-06 | fact | MVP 契約は `tags[].color` を nullable な値として保存・返却することを定めるが、画面間での表示方法までは定めていない。Tag API は `id/name/color` を返し、タグ管理 UI と高度な色管理は Phase 2。 | `doc/implementation/MVP_CONTRACT.md:100-145, 202-232` |
| F-07 | fact | AGENTS.md はタグ色の既定値を `#f59e0b` と記載する一方、現行 schema は color を任意の string/null とし、自由入力タグは null を保存する。一覧の null fallback は `#fef3c7`、編集欄は amber の Tailwind token、詳細は透明背景なので、null でも3画面の見た目は統一されていない。 | `AGENTS.md:89`、`tag.schema.ts`、`tags.tsx:68,91`、`card.tsx:49`、`display.tsx:47`、保存 repository |
| F-08 | fact | 現在の workspace の `dev.db` には、ノート `test` に `README検証` (`#2563eb`) と color null のタグが保存されている。ただしこれは README 画像の fixture ではない。 | `sqlite3 -readonly dev.db` の `tags` / `notebook_tags` 照合 |
| F-09 | assumption | 同じ保存済み `#2563eb` タグを3画面で表示した場合の差分は、保存値そのものより F-03〜F-05 の画面別実装差で説明できる。README 画像の問題は、古い／タグなし fixture のため色差を示していないこと。 | F-01〜F-08 の組み合わせによる切り分け |
| F-10 | unknown | 最終表示を「保存色の全面背景」にするか、「保存色を基準にした共通の淡色背景＋枠」にするかは現行 MVP 契約にない。暗い任意色への文字コントラストと、6桁 hex 以外の color 入力の扱いも未決定。 | 契約・schema に表示規則／color format の記載なし |

## Recommended Next Coding Task

### Objective

保存済み `tag.color` を変更せず、編集・一覧・詳細のタグ chip を共通の表示規則へ統一する。

### Scope

- `src/modules/notes/ui/components/editor/tags.tsx`
- `src/modules/notes/ui/components/list/card.tsx`
- `src/modules/notes/ui/components/detail/display.tsx`
- 3画面で同じ規則を再利用する小さな共有表示 helper / component（必要な場合のみ追加）

### Completion Conditions

- 同じ fixture（例: `#2563eb`）が3画面で同じ視覚ルールで表示される。
- color null のタグにも1つの fallback 規則が適用される。
- payload、API、Prisma schema、既存保存値、README 画像は変更しない。
- non-null / null の両方を対象に静的確認または最小の UI 確認を残す。

### Color rule decision

| 選択肢 | 影響 |
|---|---|
| A. 全画面で保存色を全面背景にする | 色の一致は最も明確。ただし暗い保存色では固定文字色のコントラストが不足する可能性がある。 |
| B. 全画面で保存色を基準にした共通の淡色背景・枠・文字色にする | 可読性と画面間の一貫性を両立しやすいが、color の形式とコントラスト規則を helper で定義する必要がある。 |

Manager 推奨は B。保存値をそのまま変えず、`tag.color` を色相の唯一の入力にして共通 helper で表示し、null は仕様記載の `#f59e0b` を fallback として扱う。A を採用する場合は、暗色タグの文字色切替を同じ coding task の完了条件に含める。

## Verification

| 確認項目 | 結果 | 備考 |
|---|---|---|
| 作業前 `git status --short` | 完了 | 既存の未コミット UI 変更8件と summary 4件を確認し、保持した |
| README リンクと画像実体 | 完了 | 9枚すべて存在し、画像内容を目視確認 |
| 3画面の静的比較 | 完了 | 対象3ファイルの行番号と CSS / inline style を確認 |
| 契約・保存値の照合 | 完了 | MVP 契約、AGENTS、schema、保存 repository、read-only `dev.db` を確認 |
| コード・画像・README の変更 | なし | 調査中に対象ファイルは変更していない |
| 作業後 `git status --short` | 完了 | 既存の8件の UI 変更と4件の既存 summary を保持し、新規 summary 1件だけを追加した |

## Remaining Unknowns

| ID | 未確認事項 | 次に必要な根拠 |
|---|---|---|
| U-01 | Manager が A / B のどちらの表示ルールを採用するか | 発注者判断 |
| U-02 | color に許可する形式（hex 限定か、CSS color string 全般か） | 契約更新または実装方針の明示 |
| U-03 | README に色付きタグを含む最新検証画像を再取得する必要があるか | 表示規則を実装した後の UI task として判断 |

## Next Read

次の coding task では、まずこの summary と次の最小ファイルだけを読む。

- `src/modules/notes/ui/components/editor/tags.tsx`
- `src/modules/notes/ui/components/list/card.tsx`
- `src/modules/notes/ui/components/detail/display.tsx`
- `src/modules/notes/contracts/tag.schema.ts`
- `doc/implementation/MVP_CONTRACT.md:100-145`
