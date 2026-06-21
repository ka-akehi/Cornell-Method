# Task Summary: mvp-final-verification

## Objective

MVP 全体について Prisma / lint / typecheck / build / audit / 主要フローの最終検証を行い、旧 Phase 2 実装や環境依存による阻害要因を整理する。

## Scope

| 項目 | 内容 |
|---|---|
| 対象領域 | MVP final verification |
| 対象ファイル / ディレクトリ | `src/app/layout.tsx`, `src/app/globals.css`, `package.json`, `tsconfig.json`, 旧 Phase 2 route/page, `README.md`, `doc/MVP_IMPLEMENTATION_TASKS.md` |
| 対象外 | Phase 2 機能実装、新規依存追加、依存更新、Prisma schema / migration 再設計 |

## Inputs Read

| 種別 | パス | 確認内容 |
|---|---|---|
| Status | `git status --short` | 作業前から多数の未コミット変更あり |
| Docs | `README.md` | MVP 主要画面、検証、既知の注意 |
| Docs | `doc/MVP_SYSTEM_SPEC.md` | MVP では PDF export / Undo / 専用復習タスク画面を扱わない |
| Docs | `doc/MVP_IMPLEMENTATION_TASKS.md` | final verification の位置づけ |
| Docs | `doc/TEST_SCENARIOS.md` | MVP / Phase 2 の確認項目分離 |
| Summary | `summary/20260621/1755-mvp-note-detail-modes.md` | 旧 Phase 2 ファイルと Google Fonts が検証阻害していた事実 |
| Summary | `summary/20260621/1800-mvp-backup-screen-summary.md` | `/backup` 画面実装済み |
| Summary | `summary/20260621/1803-mvp-readme-update-summary.md` | README 更新済み |
| Summary | `summary/20260621/1804-mvp-test-scenarios-update-summary.md` | TEST_SCENARIOS 更新済み |
| Summary | `summary/20260621/1819-mvp-design-tooling-guide-summary.md` | tooling guide 更新済み |
| Source | `src/app/layout.tsx` | Google Fonts import と MVP ナビ |
| Source | `package.json` | npm scripts / 依存 |
| Source | `prisma/schema.prisma` | MVP Prisma モデル |

## Changes Made

| パス | 変更内容 | 理由 |
|---|---|---|
| `src/app/api/notes/export/route.ts` | 削除 | MVP 外の PDF export route で、存在しない旧モデルを参照して検証を阻害していたため |
| `src/app/api/review-tasks/route.ts` | 削除 | MVP 外の専用復習タスク API で、存在しない旧モデルを参照して検証を阻害していたため |
| `src/app/api/undo/route.ts` | 削除 | MVP 外の Undo API で、存在しない旧モデルを参照して検証を阻害していたため |
| `src/app/notes/backup/page.tsx` | 削除 | MVP のバックアップ画面は `/backup` に統一済みのため |
| `src/app/tasks/review/page.tsx` | 削除 | MVP では専用復習タスク画面を作らないため |
| `src/app/layout.tsx` | `next/font/google` を削除し、body class から font variables を削除 | network restricted build で Google Fonts 取得に依存しないため |
| `src/app/globals.css` | Tailwind font token と body を system font stack に変更 | 外部 font 取得なしで見た目を大きく変えずに build するため |
| `package.json` | `build` script を `next build --webpack` に変更 | Turbopack が sandbox の port bind 制限で失敗するため |
| `tsconfig.json` | `moduleResolution` を `bundler` に変更 | Next.js 16 webpack build が要求した必須設定 |
| `README.md` | build / font / audit 既知事項を追記 | final verification 結果との同期 |
| `doc/MVP_IMPLEMENTATION_TASKS.md` | final verification 実施メモを追記 | 完了判定に必要な結果を残すため |

## Findings

| ID | fact / assumption / unknown | 内容 | 根拠 |
|---|---|---|---|
| F-001 | fact | MVP 仕様では `/api/notes/export`, `/api/review-tasks`, `/api/undo`, `/notes/backup`, `/tasks/review` は対象外。 | `doc/MVP_SYSTEM_SPEC.md`, `doc/MVP_API_DESIGN.md`, `doc/MVP_SCREEN_TRANSITION_DIAGRAM.md` |
| F-002 | fact | `next/font/google` は削除済みで、build は Google Fonts 取得に依存しない。 | `src/app/layout.tsx`, `src/app/globals.css` |
| F-003 | fact | `next build` の Turbopack 経路は `binding to a port / Operation not permitted` で失敗した。 | `npm run build` 初回実行 |
| F-004 | fact | `next build --webpack` は成功したため、`npm run build` を webpack 経路へ固定した。 | `package.json`, `npm run build` 再実行 |
| F-005 | fact | dev server は `listen EPERM 127.0.0.1:3000` で起動できなかった。 | `npm run dev -- --hostname 127.0.0.1 --port 3000` |
| F-006 | fact | `npm audit --audit-level=moderate` は moderate 3 件で失敗した。 | audit output |

## Verification

| 確認項目 | 結果 | 備考 |
|---|---|---|
| `npm run prisma:generate` | success | Prisma Client v7.8.0 generated |
| `npx prisma validate` | success | schema valid |
| `npm run lint` | success | ESLint success |
| `npx tsc --noEmit --pretty false` | success | stale `.next/types` を退避後に成功 |
| `npm run build` 初回 | failed | Turbopack が CSS 処理中に port bind 制限で失敗。Google Fonts 起因ではない |
| `npx next build --webpack` | success | route 生成まで完了 |
| `npm run build` 再実行 | success | script を `next build --webpack` に変更後に成功 |
| `npm audit signatures` | success | 631 packages verified signatures, 120 attestations |
| `npm audit --audit-level=moderate` | failed | `brace-expansion` moderate, Next.js 経由 `postcss` moderate。依存更新は未実施 |
| `node scripts/backup-copy.js` | success | `backup/2026-06-21T09-27-07.db` を作成し最新 3 世代保持 |
| `/notes` | build route success | HTTP 手動確認は dev server EPERM のため未実施 |
| `/notes/new` | build route success | HTTP 手動確認は dev server EPERM のため未実施 |
| `/notes/[id]` | build route success | HTTP 手動確認は dev server EPERM のため未実施 |
| `/backup` | build route success | HTTP 手動確認は dev server EPERM のため未実施 |
| `GET /api/notes` | build route success | HTTP 簡易確認は dev server EPERM のため未実施 |
| `GET /api/tags` | build route success | HTTP 簡易確認は dev server EPERM のため未実施 |
| `GET /api/backups` | build route success | HTTP 簡易確認は dev server EPERM のため未実施 |

## Remaining Unknowns

| ID | 未確認事項 | 次に必要な根拠 |
|---|---|---|
| U-001 | ブラウザ上の主要操作フロー | port bind 可能な通常ローカル環境で `npm run dev` を起動して手動確認 |
| U-002 | moderate audit 3 件の採否判断 | 依存更新方針、Next.js / transitive dependency の更新可否 |

## Next Read

- `summary/20260621/1827-mvp-final-verification.md`
- `README.md`
- `doc/MVP_IMPLEMENTATION_TASKS.md`
- `package.json`
- `src/app/layout.tsx`
- `src/app/globals.css`
