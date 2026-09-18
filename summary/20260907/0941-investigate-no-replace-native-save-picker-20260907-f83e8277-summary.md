---
summary_type: task-summary
created_at: 2026-09-07 09:41 JST
task_kind: worker-task
task_status: done
---

## Objective

`investigate-no-replace-native-save-picker-20260907-f83e8277.task.md` の完了状態、変更ファイル、後続で読む最小ファイルを固定し、raw log の再読を避ける。

## Scope

| 項目 | 内容 |
|---|---|
| task kind | `worker-task` |
| worker | `Worker-common` |
| status | `done` |
| task file | `codex-queue/tasks/done/investigate-no-replace-native-save-picker-20260907-f83e8277.task.md` |
| changed-files provenance | `explicit worker provenance manifest` |
| raw log | out of scope |

## Inputs Read

| 種別 | パス | 確認内容 |
|---|---|---|
| task | `codex-queue/tasks/done/investigate-no-replace-native-save-picker-20260907-f83e8277.task.md` | task 完了状態の起点 |
| changed files | Worker provenance manifest | Worker が意図的に作成・更新・削除した成果物だけを記録 |

## Changes Made

| パス | 変更内容 | 理由 |
|---|---|---|
| none | Worker が記録した変更ファイルなし | provenance manifest に記録なし |

## Findings

| ID | fact / assumption / unknown | 内容 | 根拠 |
|---|---|---|---|
| F-001 | fact | task は `done` として完了処理された。 | `codex-queue/tasks/done/investigate-no-replace-native-save-picker-20260907-f83e8277.task.md` |
| F-002 | fact | Worker provenance manifest に変更ファイルは記録されなかった。 | Changes Made |
| A-001 | assumption | 後続作業ではこの summary の Next Read を起点にすれば raw log 再読を避けられる。 | summary 運用ルール |

## Worker Report

調査完了。コード・設定・依存関係・生成物は変更していません。

結論として、AppleScript の `choose file name` には、既存ファイル選択時の「Replace」を非表示・無効化する公式オプションはありません。Apple公式資料にも、同名ファイルならReplace確認が表示されると明記されています。[AppleScript Commands Reference](https://developer.apple.com/library/archive/documentation/AppleScript/Conceptual/AppleScriptLangGuide/reference/ASLR_cmds.html)、[Mac Automation Scripting Guide](https://developer.apple.com/library/archive/documentation/LanguagesUtilities/Conceptual/MacAutomationScriptingGuide/PromptforaFileName.html)

推奨案は「フォルダだけを選択し、ファイル名をアプリが決定する」方式です。

- `choose file name` を `choose folder` に変更
- アプリが `cornell-method-backup.sqlite` などの新規名を決定
- 同名が存在する場合は連番・UUID等で未使用名を生成
- 最終保存は既存の create-only / no-replace 処理を維持
- ユーザーには「選択したフォルダに新しいSQLiteバックアップを作成します」と案内

候補比較：

| 候補 | 判定 |
|---|---|
| フォルダ選択＋アプリ命名 | 推奨。Replace UIなし、API変更を最小化、アクセシビリティとテストが明確 |
| Settingsで名前入力＋フォルダ選択 | ユーザー制御は高いが、UI・bridge・API変更が増える |
| 別のネイティブ実装 | Replace抑止の可能性はあるが、既存依存だけでは保証できず、macOS実機検証と実装コストが大きい |

後続coding taskの対象：

- `src-tauri/src/runtime.rs`
  - SaveDestinationをフォルダ選択へ変更
  - アプリ側の安全な新規ファイル名生成
  - race winner保全、temporary cleanup、`destination-exists` 維持
- `src/shared/desktop/desktop-settings-bridge.ts`
  - 必要最小限のselection/fileName契約調整
- `src/app/_components/settings/settings-modal.tsx`
  - 保存先案内文と成功メッセージを実際の挙動に合わせる
- 関連する `test/desktop/**` とUI contract test
  - Replaceスクリプト不使用
  - フォルダ選択契約
  - 衝突時の別名生成
  - 同時作成時に先勝ちファイルを保全
  - temporary artifactの成功・失敗時cleanup

受け入れ条件は、既存ファイルを削除・上書きせず、競合時に既存のrace winnerを保持し、失敗時のtemporary fileを安全にcleanupできることです。macOS標準ダイアログの実機確認は必須です。

検証は既存ファイルを確認し、対象テストを実行しましたが、現在のNode実行方法ではTypeScriptテストがESM扱いとなり、`__dirname is not defined` で起動前に失敗しました。作業前後の `git status --short` は同一で、既存のユーザー変更のみ残っています。

## Verification

| 確認項目 | 結果 | 備考 |
|---|---|---|
| summary file created | 完了 | `summary/20260907/0941-investigate-no-replace-native-save-picker-20260907-f83e8277-summary.md` |
| required headings | 完了 | template 必須見出しを含む |
| changed-files provenance | 完了 | explicit worker provenance manifest |
| raw log suppression | 完了 | raw log 本文は転記していない |
| `tools/check-summary.sh` | 完了 | writer script により終了コード 0 で通過 |

## Remaining Unknowns

| ID | 未確認事項 | 次に必要な根拠 |
|---|---|---|
| U-001 | 生成物の内容妥当性はこの summary ではレビューしていない | Next Read の対象成果物 |

## Next Read

次の作業では、まずこの summary を読む。

- `summary/20260907/0941-investigate-no-replace-native-save-picker-20260907-f83e8277-summary.md`
