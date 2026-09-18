---
summary_type: task-summary
created_at: 2026-08-16 19:50 JST
task_kind: worker-task
task_status: done
---

## Objective

`reconcile-electron-poc-git-baseline-current-vm-20260816-418894f4.task.md` の完了状態、変更ファイル、後続で読む最小ファイルを固定し、raw log の再読を避ける。

## Scope

| 項目 | 内容 |
|---|---|
| task kind | `worker-task` |
| worker | `Worker-common` |
| status | `done` |
| task file | `codex-queue/tasks/done/reconcile-electron-poc-git-baseline-current-vm-20260816-418894f4.task.md` |
| raw log | out of scope |

## Inputs Read

| 種別 | パス | 確認内容 |
|---|---|---|
| task | `codex-queue/tasks/done/reconcile-electron-poc-git-baseline-current-vm-20260816-418894f4.task.md` | task 完了状態の起点 |
| changed files | worker timestamp | task 実行中に更新された成果物の確認 |

## Changes Made

| パス | 変更内容 | 理由 |
|---|---|---|
| none | 変更ファイルなし | worker timestamp 以降の成果物更新なし |

## Findings

| ID | fact / assumption / unknown | 内容 | 根拠 |
|---|---|---|---|
| F-001 | fact | task は `done` として完了処理された。 | `codex-queue/tasks/done/reconcile-electron-poc-git-baseline-current-vm-20260816-418894f4.task.md` |
| F-002 | fact | worker timestamp 以降の成果物更新は検出されなかった。 | Changes Made |
| A-001 | assumption | 後続作業ではこの summary の Next Read を起点にすれば raw log 再読を避けられる。 | summary 運用ルール |

## Worker Report

調査を完了しました。結論として、fixture とアプリ本体は静的には互換ですが、測定契約全体の同一性はまだ証明できません。`git_head` 検証は現時点では外さず、VM validation は BLOCKED のまま扱うのが安全です。

## 差分の影響

| commit | 影響 |
|---|---|
| `1482e2e` | Electron/Tauri PoC、fixture generator、PoC用 build 経路、Desktop測定契約を追加 |
| `f12d528` | handoff と summary の更新のみ |
| `3cb2fd4` | PoC `.cjs` lint設定とsummaryのみ |

合計は96ファイル、`+17,876/-1,115`です。

- `src/` と `prisma/` の差分はゼロ。
- root lockfile の差分もゼロ。
- `package.json` はfixture用script追加、`next.config.ts` はPoC/fixture build用の出力先設定追加。
- PoC本体とfixture generatorは `366c0eb` より後に追加されており、`366c0eb` 単独には存在しません。
- 現在の `3cb2fd4` commit内のtarget値は旧値ですが、開始前からの未コミット変更8ファイルで macOS `26.6.1` / Node `v26.7.0` / npm `11.19.0` に更新されています。これはcommit差分には含まれません。

## 固定入力の確認

外部manifestは以下を固定しています。

- `git_head`: `366c0eb…`
- `baseline_scope_sha256`: `dcc057d8…`
- fixture: 10,000件、seed `cornell-method-fixture-v1`
- fixture SHA-256: `bdb9d999…`
- content hash: `f01c4044…`

fixture本体とVM転送コピーは `cmp` / SHA-256 とも一致しました。固定fixtureやmanifestは変更していません。

## BLOCKEDの原因

両PoCのvalidationは実行環境の `git rev-parse HEAD` とmanifestの `git_head`を比較します。

- 現在のHEAD: `3cb2fd4…`
- manifest: `366c0eb…`

そのため、fixtureが同一でも [Electron validation](</Users/kazuya/Desktop/自己学習/Cornell-Method/tools/desktop-poc/electron/scripts/common.cjs:201>) と [Tauri validation](</Users/kazuya/Desktop/自己学習/Cornell-Method/tools/desktop-poc/tauri/scripts/common.cjs:230>) はBLOCKEDになります。

また、`git_head` はdirty worktreeの内容やPoC overlayを検証しません。単にHEADを一致させるだけでは、実際に使ったsource/configの完全一致までは保証できません。

追加の契約差として、Tauriは `baseline_scope_sha256` を検証しますが、Electronはevidenceへ記録するだけでvalidation対象にしていません。

## 選択肢

### 1. `366c0eb` に合わせる

前提:

- 現在のVM checkoutは戻さず、別のisolated worktree/VMで実施する。
- `366c0eb`にはPoC sourceとgeneratorがないため、current PoCを明示的なoverlayとして配置する。
- [PoC prepare/build](</Users/kazuya/Desktop/自己学習/Cornell-Method/tools/desktop-poc/electron/scripts/prepare.cjs:92>) が使うpost-baselineの `next.config.ts` もoverlay対象になる。
- overlayのsource hashを別途証跡へ記録する。

fixtureと既存baselineは維持できますが、`git_head=366c0eb`だけではoverlayを表現できないため、再現性の説明が複雑になります。

### 2. `3cb2fd4` を新baselineにする

必要作業:

- target metadataの未コミット変更をcommitまたはimmutable snapshotに固定する。
- 新しいbaseline ID、scope hash、fixtureをcurrent sourceから再生成する。
- fixtureが同じbytesになっても、再生成・read-back・Canvas・relation・integrityを再確認する。
- manifest、Electron/Tauriの期待値、README、engines、lock metadata、transfer bundleを更新する。
- 既存evidenceは旧baselineの履歴として分離し、両PoCのevidenceを全て取り直す。

契約は明快になりますが、旧evidenceとの直接比較は失われます。

### 3. baselineとPoC revisionを分離する（推奨）

推奨案です。ただし、今すぐ `git_head` 比較を削除するのではなく、専用taskで以下を実施します。

- アプリbaselineは `366c0eb`、fixture・scope hashは固定のまま維持。
- `src/`、`prisma/`、runtime依存、build設定をbaseline scopeとして明示的にhashする。
- Electron/Tauri PoC sourceとharnessは、current candidate revisionとして別hashで記録する。
- Electron/Tauri双方で `baseline_scope_sha256` を同じ規則で検証する。
- `git_head` は削除せず、baseline revisionとcandidate revisionを別フィールドとしてevidenceに残す。
- target metadataの未コミット状態を固定し、VMでproduction build/runtime smokeを再確認する。
- 旧evidenceと新evidenceを混在させない。

現在確認できているのは「`src/prisma`不変」「fixture bytes一致」という静的互換性までです。native runtime、build、GUI、lifecycle、測定値の同一性は未確認です。

## 次に投入するtask

1. Common: `separate-desktop-poc-baseline-and-candidate-revision`  
   baseline scope、candidate revision、target metadata、Electron/Tauri共通validationを確定。

2. Common: target VMでElectron/Tauri双方の `poc:validate` とproduction build前提を確認。

3. Electron/Tauri各候補のnative measurement taskを実行。

4. 両候補のfresh evidenceを比較するtaskを投入。

発注者に必要な判断は、「旧fixture/evidenceの比較可能性を優先して案3を採るか」「完全一致を優先して案2で再baselineするか」です。

## 検証結果

作業前後のstatusは同一です。変更ファイルはありません。checkout/reset、fixture再生成、manifest書換え、lockfile更新、PoC source変更は実行していません。

## Verification

| 確認項目 | 結果 | 備考 |
|---|---|---|
| summary file created | 完了 | `summary/20260816/1950-reconcile-electron-poc-git-baseline-current-vm-20260816-418894f4-summary.md` |
| required headings | 完了 | template 必須見出しを含む |
| raw log suppression | 完了 | raw log 本文は転記していない |
| `tools/check-summary.sh` | 完了 | writer script により終了コード 0 で通過 |

## Remaining Unknowns

| ID | 未確認事項 | 次に必要な根拠 |
|---|---|---|
| U-001 | 生成物の内容妥当性はこの summary ではレビューしていない | Next Read の対象成果物 |

## Next Read

次の作業では、まずこの summary を読む。

- `summary/20260816/1950-reconcile-electron-poc-git-baseline-current-vm-20260816-418894f4-summary.md`
