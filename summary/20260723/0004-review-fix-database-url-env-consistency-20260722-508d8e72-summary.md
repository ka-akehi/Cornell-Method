---
summary_type: task-summary
created_at: 2026-07-23 00:04 JST
task_kind: worker-task
task_status: done
---

## Objective

Prisma CLI、Next runtime、backup CLI が project `.env` の同じ `DATABASE_URL` を使い、未指定時のみ `file:./dev.db` を使うようにする。

## Scope

- shared project env loader
- Prisma / Next / backup CLI integration
- direct `dotenv` dependency and README contract

## Inputs Read

- `prisma.config.ts`
- `scripts/backup-copy.js`
- `src/server/infrastructure/prisma.ts`
- `README.md`

## Changes Made

- `config/project-env.js` / `.d.ts` を共有 loader として追加。
- Prisma config・Next Prisma adapter・backup CLI を project root 基準の同一設定へ接続。
- `dotenv` を production direct dependency として追加。
- README に shell precedence、default、custom path を明記。

## Findings

- fact: `.env` custom path は Prisma CLI と backup path resolver の両方で project root 基準になる。
- fact: shell `DATABASE_URL` は `.env` より優先される。
- fact: `.env` と shell の両方がない場合のみ default を使う。

## Verification

- disposable Prisma `db push` custom path / shell precedence: PASS
- `npm run lint`: PASS
- `npx tsc --noEmit --pretty false`: PASS
- `npm run build`: PASS
- `npx prisma validate`: PASS

## Remaining Unknowns

- `.env` read failure と invalid value は後続 correction task で fail-closed 化した。

## Next Read

- `config/project-env.js`
- `prisma.config.ts`
- `scripts/backup-copy.js`
- `src/server/infrastructure/prisma.ts`
