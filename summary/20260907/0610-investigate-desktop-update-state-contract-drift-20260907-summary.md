---
summary_type: task-summary
created_at: 2026-09-07 06:10 JST
task_kind: worker-task
task_status: done
---

## Objective

desktop update TypeScript suite の 76 PASS / 1 FAILについて、`src-tauri/src/main.rs` の source-text 契約不一致が TS 移行起因か、既存の Rust/test drift かを確定する。

## Scope

| 項目 | 内容 |
|---|---|
| 対象テスト | `test/desktop/desktop-update-*.test.ts` |
| 対象実装 | `src-tauri/src/main.rs` と startup command registration 周辺 |
| 比較 | 移行前 `HEAD:test/desktop/desktop-update-state.test.js`、Rust変更履歴 |
| 方針 | 読み取りのみ。コード・設定・既存test assertionは変更しない |

## Reproduction

実行コマンド:

```sh
node --import tsx/esm --test test/desktop/desktop-update-*.test.ts
```

結果:

- tests 77
- pass 76
- fail 1
- duration 約80.1秒

唯一の失敗:

- test name: `update state exposes daily/manual/retry/notification transitions without starting provider work`
- location: `test/desktop/desktop-update-state.test.ts:87`
- assertion:

```ts
assert.match(main, /let storage = resolve_storage_layout\(&root\)\.map_err\(boxed_error\)\?;/);
```

- expected: `let storage = resolve_storage_layout(&root).map_err(boxed_error)?;`
- actual:

```rust
let storage = resolve_storage_layout(&root)
    .map_err(|error| boxed_error(error.to_string()))?;
```

後続の同テストで要求される startup migration → recovery → bootstrap の順序、storage / update state の管理、`update_state` / `update_migration` の登録確認は、この assertion 到達前の static source-text 契約としては実装に存在する。今回の失敗原因はこの1行の形状不一致に限定される。

## Causality: TS migration or pre-existing drift

TS移行起因ではない。根拠は次のとおり。

1. 移行前JS（`git show HEAD:test/desktop/desktop-update-state.test.js`）にも、同じ test name と同じ assertion regex が存在する。
2. JS→TS差分は import形式、`readSource(relativePath: string)` の型注釈、`export {}`、および別の migration regex の `/s` flag除去だけで、失敗した `main` assertionの期待値は変更されていない。
3. 現行 `src-tauri/src/main.rs` の該当箇所は、TS移行前から存在する commit `c47ee261631de2bf9cd6db4c9bd0a01b7d3375f2`（`feat: harden desktop sidecar startup recovery`, 2026-08-31）で変更された。親commitでは1行の `.map_err(boxed_error)?`、同commit後は現在の2行形式と `error.to_string()` になっている。
4. `resolve_storage_layout` は `Result<StorageLayout, DesktopStorageBootstrapError>` を返すため、現行Rustの `error.to_string()` を経由して `boxed_error(String)` に渡す形が型契約に適合する。これは source formatting だけでなく、エラー型の変換を明示した現行実装である。

結論: 既存の source-text test 契約が、先行する production Rust変更に追随していない drift。TS移行はFAILを可視化しただけで、FAILを発生させた因果ではない。

## Current contract judgment

現行の正しい契約は、startup setup 内で次を満たすこと。

- `resolve_storage_layout(&root)` の結果を `DesktopStorageBootstrapError` から boxed error に変換する。
- 現行実装の具体形は `map_err(|error| boxed_error(error.to_string()))?`。
- storage resolve 後に `UpdateStateStore` を作成し、`run_startup_staged_migration(&root, &storage, &update_state)`、recovery、`run_bootstrap_with_storage(&root, &storage)` の順を維持する。
- `mod update_state;` / `mod update_migration;` と `app.manage(update_state)` を維持する。

したがって、後続修正は production registration や startup flow を戻すのではなく、`test/desktop/desktop-update-state.test.ts` の source-text assertion を現行Rust契約に同期するべきである。最小修正は multiline と `error.to_string()` を許容する regex への変更だが、可能なら source の表記揺れに過度に依存しない範囲で、resolve → error conversion の現行契約を検証する。

## Verification

- `git status --short`: 作業前後とも、既存の大量の未コミット変更・TS移行ファイル・summary等を検出。既存変更は戻していない。
- focused desktop-update suite: 上記の通り 76 PASS / 1 FAIL を再現。
- `git show HEAD:test/desktop/desktop-update-state.test.js`: 移行前 assertion を比較。
- `git show c47ee26^:src-tauri/src/main.rs` / `git show c47ee26:src-tauri/src/main.rs`: Rust変更時点を比較。
- 今回はコード・設定・依存関係・既存test assertionを変更していないため、lint/build/typecheckは追加実行していない。

## Follow-up coding task

### Objective

現行 `main.rs` の storage error conversion 契約に合わせ、desktop update state source-text test の stale assertion を更新する。

### Target

- `test/desktop/desktop-update-state.test.ts` の line 87 相当の assertion だけ。
- `src-tauri/src/main.rs`、startup registration、他のFAIL、他のテストは変更対象外。

### Completion criteria

- `node --import tsx/esm --test test/desktop/desktop-update-*.test.ts` が 77/77 PASS。
- storage resolve の error conversion、staged migration → recovery → bootstrap の順序、update state registration の既存契約を引き続き検証する。
- `npm run typecheck`、対象 ESLint、`git diff --check` がPASS。
- production Rust source は変更しない。

## Next Read

- `test/desktop/desktop-update-state.test.ts`（line 85-103）
- `src-tauri/src/main.rs`（line 390-408）
- `src-tauri/src/runtime.rs`（`resolve_storage_layout`）
