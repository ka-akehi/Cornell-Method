# Task Summary

## Objective

restore 前に生成される safety backup を内部 recovery 用に保持し、通常の Settings managed restore 一覧から除外する。通常一覧には recovery-only でない最新の user backup 1 件だけを表示・選択させる。

## Scope

| 項目 | 内容 |
|---|---|
| 対象領域 | managed backup catalog、sidecar/Tauri/bridge DTO、Settings restore 選択、recovery 回帰検証 |
| 対象ファイル / ディレクトリ | `src/server/infrastructure/desktop-storage.js`、`src-tauri/sidecar/launcher.cjs`、`src-tauri/src/runtime.rs`、`src/shared/desktop/desktop-settings-bridge.ts`、Settings/recovery UI、desktop backup/recovery tests |
| 対象外 | safety backup の削除、内部 recovery/rollback の非表示、renderer request の権限拡張、export publish semantics |

## Changes Made

| パス | 変更内容 | 理由 |
|---|---|---|
| `src/server/infrastructure/desktop-storage.js` / `.d.ts` | catalog entry に `recoveryOnly` を追加し、既存の `restore-<safe operationId>.sqlite.bak` 規則で分類 | safety backup を user-facing catalog と区別するため |
| `src-tauri/sidecar/launcher.cjs` | catalog envelope/entry の strict validation と deterministic ordering を追加 | 不正・分類不能 entry を fail-closed にするため |
| `src-tauri/src/runtime.rs` / `src/shared/desktop/desktop-settings-bridge.ts` | typed DTO と strict allowlist に `recoveryOnly` を追加 | sidecar/Tauri/bridge 間の契約を同期するため |
| `src/app/_components/settings/settings-modal.tsx` | `recoveryOnly` を除外後、最新 user backup 1 件のみ表示。空なら保存済みなし扱い | 通常 restore の誤選択を防ぐため |
| `src-tauri/ui/recovery.js` | internal recovery の validation のみ `recoveryOnly` に対応し、entry はフィルタしない | safety-only catalog を内部 recovery で利用可能に保つため |
| `test/desktop/*` | catalog metadata、sidecar/bridge、Settings、選択された backupId、live DB の title/body/Cue/Tag/Canvas/searchText、startup/internal recovery を検証 | 回帰条件を disposable fixture で固定するため |

## Findings

| ID | fact / assumption / unknown | 内容 | 根拠 |
|---|---|---|---|
| F1 | fact | safety backup の物理ファイル、catalog、recovery availability、rollback/resume semantics は削除・変更していない | targeted tests と実装差分 |
| F2 | fact | renderer から path や任意の backupId を追加で受け付ける変更はない | bridge request DTO と sidecar request validation |
| F3 | unknown | 実 packaged app の GUI/sidecar runtime での表示確認は未実施 | Worker host に実 GUI 実行環境がない |

## Verification

| 確認項目 | 結果 | 備考 |
|---|---|---|
| targeted desktop backup/recovery/catalog/UI tests | PASS | 74 tests, 74 pass |
| `git diff --check` | PASS | |
| targeted ESLint | PASS | 変更対象の JS/TS/TSX を確認 |
| `npx tsc --noEmit --pretty false` | PASS | |
| `cargo fmt --manifest-path src-tauri/Cargo.toml -- --check` | PASS | |
| `npm run build` | PASS | Prisma generate、TypeScript、static generation を含む |
| `npm run lint` | 未達 | build 生成 `.desktop-runtime/.next` と既存問題を含む 11,619 problems のため失敗。targeted lint は PASS |
| `cargo check --manifest-path src-tauri/Cargo.toml` | 未達 | 既存の Tauri custom build/resource layout が `Not a directory (os error 20)` で停止 |

## Remaining Unknowns

| ID | 未確認事項 | 次に必要な根拠 |
|---|---|---|
| U1 | 実 GUI で safety backup が通常一覧に表示されず、user backup の最新 1 件だけ表示されること | packaged app/sidecar を起動できる環境での GUI 確認 |

## Next Read

- `src/server/infrastructure/desktop-storage.js`
- `src/shared/desktop/desktop-settings-bridge.ts`
- `src/app/_components/settings/settings-modal.tsx`
- `test/desktop/desktop-data-backup-restore.test.js`

