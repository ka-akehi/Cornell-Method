---
summary_type: task-summary
created_at: 2026-08-21 05:32 JST
task_kind: worker-task
task_status: done
---

## Objective

`specify-desktop-settings-contract-64cccd32.task.md` の完了状態、変更ファイル、後続で読む最小ファイルを固定し、raw log の再読を避ける。

## Scope

| 項目 | 内容 |
|---|---|
| task kind | `worker-task` |
| worker | `Worker-common` |
| status | `done` |
| task file | `codex-queue/tasks/done/specify-desktop-settings-contract-64cccd32.task.md` |
| raw log | out of scope |

## Inputs Read

| 種別 | パス | 確認内容 |
|---|---|---|
| task | `codex-queue/tasks/done/specify-desktop-settings-contract-64cccd32.task.md` | task 完了状態の起点 |
| changed files | worker timestamp | task 実行中に更新された成果物の確認 |

## Changes Made

| パス | 変更内容 | 理由 |
|---|---|---|
| none | 変更ファイルなし | worker timestamp 以降の成果物更新なし |

## Findings

| ID | fact / assumption / unknown | 内容 | 根拠 |
|---|---|---|---|
| F-001 | fact | task は `done` として完了処理された。 | `codex-queue/tasks/done/specify-desktop-settings-contract-64cccd32.task.md` |
| F-002 | fact | worker timestamp 以降の成果物更新は検出されなかった。 | Changes Made |
| A-001 | assumption | 後続作業ではこの summary の Next Read を起点にすれば raw log 再読を避けられる。 | summary 運用ルール |

## Worker Report

完了しました。コード、設定、依存関係、生成物、tracked docs、Worker task は変更していません。

## Worker Report

### 目的と最小契約

Settings v1 は、既存 primary window 内の modal として提供します。

```text
Mac: Settings menu
Web: app chrome の gear
        ↓
primary WebView 内の Settings modal
  General
  Updates
  Data and Backup
```

Settings modal、確認 dialog、OS file dialog は新しい primary window を作りません。カテゴリの配置（左ナビ、タブ等）、modal サイズ、gear の位置は未決です。

- General：v1 は未承認の変更設定を追加せず、読み取り専用または空のカテゴリとする。
- Updates：provider 非依存の状態表示、手動確認、pending update 表示、失敗時の再試行だけを扱う。
- Data and Backup：手動 SQLite export、app 管理 backup restore、外部 backup file restore を分離する。
- UI から Prisma、SQLite、filesystem を直接操作しない。

### Dirty state 連携

既存 close bridge の契約は維持します。

| 操作 | 契約 |
|---|---|
| close | 保存して終了、保存せず終了、戻る |
| update | 保存して更新、保存せず更新、戻る |
| 保存失敗 | close / update を実行せず、編集内容と dirty state を保持 |
| clean state | 確認なしで処理を継続 |
| Escape / dialog 外操作 | close / update を取消し |

update は close と別の decision event として扱います。同じ dirty controller を参照できますが、文言・処理結果は混同しません。

### UI state / acceptance

#### General

| State | Loading / error | Disabled | Accessibility / acceptance |
|---|---|---|---|
| ready | loading なし。未承認の設定項目を表示しない | 操作項目なし | `General` 見出しと modal の accessible name を持つ。開閉・カテゴリ移動をキーボードで操作できる |
| app metadata loading（表示する場合のみ） | `aria-busy` と status 表示 | metadata 依存操作を無効化 | modal 全体は操作可能。loading で primary window を増やさない |
| metadata error | 非 blocking alert。他カテゴリは利用可能 | retry を置くかは未決 | 色だけでなく文言で通知 |
| close | modal を閉じ、起点の gear / menu に focus を戻す | 実行中の処理があれば close 可否は未決 | Escape、close button、focus return を確認 |

General に言語、テーマ、telemetry、認証、起動時 backup などの設定を追加しないことを推奨します。

#### Updates

| State | Loading / error | Disabled | Accessibility / acceptance |
|---|---|---|---|
| idle / current | 現行版を利用可能。手動確認を提供 | 確認中以外は手動確認を有効化 | `aria-live="polite"` 等で状態を通知。ON/OFF toggle は置かない |
| checking | 非同期確認中 | 手動確認を disabled | `aria-busy`。ノート画面を block しない |
| available / downloading | package を background download。自動適用しない | 再起動適用は package 検証完了まで disabled | target version と状態を文言で示す。provider 詳細は UI 契約に含めない |
| ready to restart | 検証済み pending update を表示 | 「再起動して更新」以外の適用操作は置かない | 同じ pending update の modal 通知を繰り返さず Settings で確認できる |
| check / download failure | 現行版を維持。更新ありとは通知しない | retry は手動確認へ集約 | エラー文言は TBD。次回確認または手動確認で再試行できる |
| signature / integrity failure | package を破棄し、現行版を維持 | 再起動適用を disabled | 失敗理由を安全な範囲で表示。package 内容を表示・保存しない |
| dirty update | 保存して更新、保存せず更新、戻る | 保存中は全 decision button disabled | 保存失敗時は編集内容と dirty state を保持 |
| applying / restarting | 適用中は状態表示 | update 操作を disabled | 適用失敗時は現行版を利用可能にする |

更新確認の最大 1 日 1 回、手動確認、toggle 不在、background download、明示的再起動適用は固定です。provider、manifest URL、package 署名方式は未決です。

#### Data and Backup

| State | Loading / error | Disabled | Accessibility / acceptance |
|---|---|---|---|
| managed backup list loading | 一覧 loading | restore disabled | list に loading status を関連付ける |
| managed backup empty / ready | 最新 3 世代を表示。空なら empty state | backup 未選択時は restore disabled | 各 backup を選択可能にし、選択状態を accessible にする |
| manual export | OS save dialog → 平文 SQLite export | export 中は export button disabled。retention は適用しない | 「手動 SQLite export」であることと平文であることを説明 |
| managed restore selected | 選択 backup を明示表示して確認 | 未選択、別操作中は disabled | restore 入口は外部 file restore と別ボタン・別説明 |
| external restore selected | OS open dialog で file を選択し staging | file 未選択時は restore disabled | file picker cancel はエラー扱いにしない。選択 file 名を確認できる |
| restoring / validating | staging、integrity、foreign key、schema / migration、必須データ、Canvas、reopen を順に検証 | export、別 restore、削除を disabled | `aria-busy` と status を表示。live DB を直接変更しない |
| restore failure | validation、safety backup、atomic switch、reopen の失敗を表示。live DB は維持 | failed source の再実行条件は TBD | alert と再試行または閉じる操作を提供 |
| newer schema | 自動 restore せず pending restore として更新後の再開を案内 | compatible update 前は適用 disabled | 更新後も明示確認なしに自動復元しない |
| complete data deletion | live DB、app 管理 backup、設定だけを対象に入力確認 | 正確な確認入力まで disabled | 外部 SQLite export を削除しないことを明示 |

復元入口は必ず次の二つに分けます。

1. app 管理 backup 一覧から復元
2. 外部 backup file を選択して復元

両者は同じ staging validation → 明示確認 → atomic switch → restart / reopen pipeline を使います。

### `/backup` 維持条件

現行 `/backup` と `GET/POST /api/backups` は、次を満たすまで維持します。

- Settings から手動 SQLite export が実行できる。
- app 管理 backup の一覧と restore が実行できる。
- 外部 backup file の restore が別入口で実行できる。
- restore 前 safety backup、全 validation、atomic switch、reopen が確認できる。
- 失敗時に live DB が変更されない。
- Mac menu、Web gear、single primary window、dirty close / update が確認できる。
- 現行 MVP の手動 backup 作成・最新 3 世代確認が回帰していない。

受け入れ後も、現行 route の削除は別判断とし、Desktop UI だけを段階的に廃止します。

### MVP との境界

変更しない契約：

- `/notes`、`/notes/new`、`/notes/[id]`、`/backup`
- 現行 API、Prisma / SQLite、手動 backup
- `CanvasDocumentV1` と legacy Markdown の互換
- 明示保存
- 確認後の physical delete
- 詳細画面内 review

Settings v1 に混ぜない機能：

- autosave、Undo / soft delete
- PDF、Canvas PNG
- 検索改善、検索サジェスト、大規模一覧
- 認証、cloud、telemetry
- 定期・日次・通常起動時・データ変更時の自動 backup

### Worker 分割案

| Lane | 提案 task | 責務 | 依存 |
|---|---|---|---|
| Common / Desktop shell | `implement-desktop-settings-shell-bridge` | Mac Settings menu、Web gear、modal open signal、primary window 境界、focus、OS file dialog / restart bridge | 既存 lifecycle、dirty close bridge |
| Common / Desktop shell | `implement-desktop-update-check-state` | 最大 1 日 1 回、手動確認、background download、pending state、失敗保持 | shell bridge。provider 固定後に provider adapter を追加 |
| Common / Desktop shell | `implement-desktop-pending-restore-resume` | newer schema の pending restore を更新後に明示再開 | update state + restore pipeline |
| UI | `implement-desktop-settings-entrypoints` | modal、3カテゴリ、General / Updates の表示、アクセシビリティ | shell bridge、update DTO |
| UI | `implement-desktop-data-backup-settings` | export、managed restore、external restore の表示と state/error | backup / restore API DTO |
| API / backup | `implement-desktop-manual-sqlite-export` | ユーザー選択先への平文 SQLite export。retention なし | user data / storage 境界 |
| API / restore | `implement-desktop-restore-pipeline` | 両 restore 入口の staging validation、safety backup、atomic switch、reopen、pending 状態 | storage、migration 契約 |
| Common / UI / API | `implement-desktop-complete-data-deletion` | 入力確認、live DB・app backup・設定の削除 | Settings、storage、restore 状態 |

UI は filesystem / Prisma を持たず、API / shell の状態を表示します。API は window、modal、focus を持ちません。provider、manifest、署名方式が決まるまで、更新の provider-specific task は投入しません。

依存順は次のとおりです。

```text
既存 lifecycle / dirty close
        ↓
Settings shell bridge
   ├── Settings UI
   ├── update state
   └── export / restore DTO
             ↓
      Data and Backup UI
             ↓
  /backup replacement acceptance
             ↓
  Desktop Alpha packaged QA
```

### 発注者の判断が必要な未決事項

- gear の位置、Mac menu の名称、modal サイズ、カテゴリ nav の配置
- General の表示項目。アプリ version、data location、window 設定を表示するか
- 各ボタン、empty、error、restore 確認、完全削除確認の正確な文言
- `/backup` の Desktop UI / 開発 Web での表示継続方針
- update provider、manifest URL / schema、channel、package format
- package 署名・完全性検証方式、最低対応 macOS
- update check / download の retry、cache、保持期間
- app 管理 backup の file naming、一覧 metadata、保存形式
- manual export の file naming、拡張子、OS dialog filter
- restore の内部 error code、容量不足・再起動失敗・途中中断時の扱い
- pending restore の表示位置と更新後再開手順
- restore / update 中に primary window close を許可するか
- Settings 自体の mutable state を dirty controller に登録するか
- complete data deletion を Settings v1 の初回実装に含めるか

## 読んだ資料

`HANDOFF_2026-08-17.md`、`POST_MVP_IMPLEMENTATION_PLAN.md`、`DESKTOP_ALPHA_TAURI_FOUNDATION.md`、`MVP_CONTRACT.md`、`IMPLEMENTATION_STATUS.md`、`TEST_SCENARIOS.md`、MVP の画面・workflow・system spec・design tooling、`app-chrome.tsx`、`app-chrome-parts.tsx`、`desktop-close-bridge.ts`、`src-tauri/src/main.rs`、queue README / Manager prompt / summary template を確認しました。

## 変更・検証

- 変更ファイル：なし
- 作業前後の `git status --short`：同一。既存の未コミット変更と未追跡ファイルを保持
- lint / build / test：仕様整理のみのため未実行
- Worker task、commit、PR、外部サービス接続：未実施

### Next Read

- `doc/implementation/POST_MVP_IMPLEMENTATION_PLAN.md` §6〜§8
- `doc/technical/DESKTOP_ALPHA_TAURI_FOUNDATION.md`
- `doc/implementation/MVP_CONTRACT.md` §3〜§5・§9
- `doc/testing/TEST_SCENARIOS.md` §2〜§4
- `src/shared/desktop/desktop-close-bridge.ts`
- `src/app/_components/app-chrome.tsx`
- `src-tauri/src/main.rs`

## Verification

| 確認項目 | 結果 | 備考 |
|---|---|---|
| summary file created | 完了 | `summary/20260821/0532-specify-desktop-settings-contract-64cccd32-summary.md` |
| required headings | 完了 | template 必須見出しを含む |
| raw log suppression | 完了 | raw log 本文は転記していない |
| `tools/check-summary.sh` | 完了 | writer script により終了コード 0 で通過 |

## Remaining Unknowns

| ID | 未確認事項 | 次に必要な根拠 |
|---|---|---|
| U-001 | 生成物の内容妥当性はこの summary ではレビューしていない | Next Read の対象成果物 |

## Next Read

次の作業では、まずこの summary を読む。

- `summary/20260821/0532-specify-desktop-settings-contract-64cccd32-summary.md`
