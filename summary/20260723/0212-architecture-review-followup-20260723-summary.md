# Architecture Review Follow-up Summary

## Scope

- 2026-07-23、現在の worktree と MVP 契約を基準に、過去の PASS 記録や handoff を結論として扱わず再監査。
- 対象は責務境界、ファイル配置、依存方向、非同期状態、Canvas 分割候補。
- この監査では実装変更を行っていない。

## Current state

- ブランチ: `agent/fix-backup-filename-collision-20260723`
- 未コミット変更はバックアップの同一ミリ秒衝突対策と、その focused test、および既存の summary 群。
- `node --test test/backup/filename-collision.test.js`: 10/10 PASS
- `npm run lint`: PASS
- `npx tsc --noEmit --pretty false`: PASS
- `git diff --check`: PASS
- 直近の `npm run build` も PASS。Canvas のブラウザ QA は handoff 記載どおり未完了。

## Findings

### Highest priority

1. `src/modules/notes/ui/components/notes-list.tsx` が、入力変更による `useEffect` の自動検索と検索フォーム送信を併用している。リクエストのキャンセルまたは世代管理がなく、古いレスポンスが新しい検索結果を上書きし得る。明示検索を採用するなら draft filter と applied filter を分けるのが第一候補。
2. DB URL の解決が Prisma runtime、Prisma config、backup provider、plain Node CLI に分散している。`.env` の読み込みと default path の差異により、`npm run backup:copy` がアプリの使用 DB と別ファイルを対象にするリスクがある。隣接ブランチの database-url consistency 修正を統合する前提で再確認する。

### Architecture debt

1. `src/app/backup/page.tsx` に UI state と表示責務が残り、target architecture の `modules/backup/ui` と不一致。まず UI を移し、app page を thin adapter にする。
2. `src/shared/canvas/canvas-surface.ts` は Fabric と DOM を直接操作する renderer adapter だが、`src/shared/canvas/index.ts` の generic barrel から公開され、server code も同じ barrel を利用する。pure Canvas document API と Fabric surface adapter を分離する。
3. `src/modules/notes/lib/canvas-editor-document.ts` と `canvas-editor-style.ts` は、純粋な document/style policy と Fabric object/event bridge を同居させている。pure policy と renderer bridge を分離する候補。
4. date-only helper が contract、server query、command repository に重複している。`shared/date` を canonical source とし、日付文字列 policy と DB 用 UTC conversion の境界を明示する。
5. backup application wrapper は薄く、`src/lib/backup` は互換 re-export。削除は急がず、canonical entrypoint と外部 consumer を確定してから整理する。

### Do not split mechanically

- `use-note-canvas-runtime.ts` と `shape-text-editor-session.ts` は大きいが、Fabric lifecycle / cleanup / state machine がまとまっている。ブラウザ characterization と回帰テストなしの機械的分割は、現在確認されていない pointer / touch / responsive 回帰を増やす可能性がある。
- `relations.repository.ts` は cue/tag/canvas の変更理由が異なるため将来分割候補だが、Prisma transaction の原子性を command orchestrator に残す。

## Recommended order

1. database-url consistency の統合可否と、backup filename の `.SSS` / suffix が契約の timestamp 表記に与える影響を決める。
2. NotesList の request race を修正し、out-of-order response のテストを追加する。
3. `shared/date` の重複を整理する。
4. Backup UI を `modules/backup/ui` へ移す。
5. Canvas は先に browser QA / characterization、次に pure policy・Fabric adapter の分離、最後に runtime hook の分割。

## Next Read

- `src/modules/notes/ui/components/notes-list.tsx`
- `src/modules/notes/remote/note-operations.ts`
- `src/server/infrastructure/prisma.ts`
- `prisma.config.ts`
- `src/server/backup/infrastructure/local-sqlite-backup-provider.js`
- `src/shared/canvas/canvas-surface.ts`
- `src/modules/notes/lib/canvas-editor-document.ts`
- `src/modules/notes/lib/canvas-editor-style.ts`
