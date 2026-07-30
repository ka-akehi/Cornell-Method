# Manager Next Work Organization Summary

## Objective

`HANDOFF_2026-07-30.md` を起点に、次に実施する Worker task の候補、依存関係、発注者判断が必要な事項を整理する。

## Scope

| 項目 | 内容 |
|---|---|
| 対象 | 最新 handoff、MVP 契約、実装状況、テスト観点、queue、現行 worktree の検証状態 |
| 対象外 | アプリ実装、設定/依存関係変更、DB/hosted 環境変更、既存 task の移動・削除、PR 操作 |

## Inputs Read

- `HANDOFF_2026-07-30.md`
- `AGENTS.md`
- `doc/implementation/MVP_CONTRACT.md`
- `doc/implementation/IMPLEMENTATION_STATUS.md`
- `doc/testing/TEST_SCENARIOS.md`
- `codex-queue/README.md`
- `summary/README.md`
- `summary/20260730/manager-next-work-organization-20260730.md`
- `summary/20260730/manager-verify-current-editor-browser-qa-20260730.md`
- `summary/20260730/manager-diagnose-route-404-20260730.md`

## Changes Made

- アプリコード、設定、依存関係、Prisma、DB、既存 task の状態は変更していない。
- この summary のみを追加した。
- 依存関係と発注者判断が未確定のため、新しい Worker task は投入していない。

## Findings

| ID | 判定 | 内容 |
|---|---|---|
| F-001 | fact | 最新 handoff は `HANDOFF_2026-07-30.md`。AGENTS.md の最新引き継ぎ参照も一致している。 |
| F-002 | fact | 2026-07-31 00:32 JST の queue は Common 218/218、UI 152/152、API 26/26、Overall 396/396。待機・実行中は 0。 |
| F-003 | fact | 現在の worktree には既存の未コミット変更があり、UI/API/設定/E2E 成果物が混在している。変更を戻してはいけない。 |
| F-004 | fact | `npm run lint`、`node --test test/notes/*.test.js test/postgres/*.test.js`（64件）、`git diff --check` は現行 worktree で成功した。 |
| F-005 | fact | Browser runtime QA は前回 backend 不在で BLOCKED。静的テスト結果を runtime PASS に繰り上げてはいけない。 |
| F-006 | fact | Postgres native fallback は synthetic failure の契約テストまで確認済みだが、実 native load failure と isolated operator import は未確認。 |
| F-007 | fact | hosted の migration、再デプロイ永続性、backup/restore drill は未実施。実環境変更には発注者の対象・接続情報・明示許可が必要。 |
| F-008 | fact | `codex-queue/tasks-ui/move-shape-text-session-out-of-hooks-20260723.task.md` は queue root に重複して残っているが、同名 task は `tasks-ui/done/` にも存在する。Worker status の待機 task には含まれない。 |
| A-001 | assumption | 現在の未コミット変更を安定化・変更単位確認するまで、同じ UI/API ファイルへ触れる coding task は投入しない。 |

## Recommended Order

1. 発注者が現在の worktree の変更群（UI polish、E2E、Postgres fallback、docs/summary）を保持・分離・PR 化する範囲を決める。
2. その範囲を確定した後、必要なら Common の read-only diff / scope review task を投入する。
3. Browser backend または許可済みの Manager fallback 環境が利用可能になった時点で、直近 UI の実ブラウザ QA を再投入する。
4. hosted migration の前に、実 native failure を含む isolated operator smoke を行う。Production/Supabase/Vercel 変更はその後に別 task とする。
5. CI E2E workflow の追加は、現行 local lint/E2E の受け入れと混ぜず、発注者が CI を必須化するか決めた後に別の Common task とする。

## Verification

| 確認項目 | 結果 |
|---|---|
| `codex-queue/bin/worker-status.sh` | 待機 0、実行中 0 |
| `npm run lint` | PASS |
| `node --test test/notes/*.test.js test/postgres/*.test.js` | 64 tests PASS |
| `git diff --check` | PASS |
| summary format check | 初回は必須見出し不足。補正後に再実行予定 |

## Remaining Unknowns

- 現在の未コミット変更をどの単位で保持・分離・PR 化するか。
- Browser backend 復旧後の直近 UI runtime QA の結果。
- 実 native load failure を含む isolated operator smoke の再現性。
- hosted migration / backup-restore / redeploy persistence を実環境で実施する時期と対象。
- CI E2E workflow を MVP の必須検証にするか。

## Decision Needed

- UI runtime QA を先に進めるか、現行 worktree の変更範囲整理を先に行うか。
- hosted migration の前に native fallback operator smoke を必須にするか。
- CI 上の E2E workflow を MVP 受け入れ条件に含めるか。

## Next Read

- `HANDOFF_2026-07-30.md`
- この summary
- 発注者が変更範囲を決めた後: `git diff --stat`、関連 summary、対象 branch の PR 状態
- UI runtime 継続時: `summary/20260730/manager-verify-current-editor-browser-qa-20260730.md`、`src/app/styles/note-paper.css`、`src/shared/markdown/markdown-field.tsx`
- migration 継続時: `README.md`、`scripts/postgres-migration-common.js`、`scripts/postgres-import.js`、`scripts/postgres-reconcile.js`
