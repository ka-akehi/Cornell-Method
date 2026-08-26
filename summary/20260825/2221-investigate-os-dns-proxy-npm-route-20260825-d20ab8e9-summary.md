---
summary_type: task-summary
created_at: 2026-08-25 22:21 JST
task_kind: worker-task
task_status: done
---

## Objective

`investigate-os-dns-proxy-npm-route-20260825-d20ab8e9.task.md` の完了状態、変更ファイル、後続で読む最小ファイルを固定し、raw log の再読を避ける。

## Scope

| 項目 | 内容 |
|---|---|
| task kind | `worker-task` |
| worker | `Worker-common` |
| status | `done` |
| task file | `codex-queue/tasks/done/investigate-os-dns-proxy-npm-route-20260825-d20ab8e9.task.md` |
| raw log | out of scope |

## Inputs Read

| 種別 | パス | 確認内容 |
|---|---|---|
| task | `codex-queue/tasks/done/investigate-os-dns-proxy-npm-route-20260825-d20ab8e9.task.md` | task 完了状態の起点 |
| changed files | worker timestamp | task 実行中に更新された成果物の確認 |

## Changes Made

| パス | 変更内容 | 理由 |
|---|---|---|
| none | 変更ファイルなし | worker timestamp 以降の成果物更新なし |

## Findings

| ID | fact / assumption / unknown | 内容 | 根拠 |
|---|---|---|---|
| F-001 | fact | task は `done` として完了処理された。 | `codex-queue/tasks/done/investigate-os-dns-proxy-npm-route-20260825-d20ab8e9.task.md` |
| F-002 | fact | worker timestamp 以降の成果物更新は検出されなかった。 | Changes Made |
| A-001 | assumption | 後続作業ではこの summary の Next Read を起点にすれば raw log 再読を避けられる。 | summary 運用ルール |

## Worker Report

調査完了。コード・設定・キャッシュ・ユーザーデータは変更していません。

### 診断結果

| 対象 | 状態 | 根拠 |
|---|---|---|
| macOS resolver | 失敗／制限 | `scutil --dns`: `No DNS configuration available`。`dig/nslookup`: `Operation not permitted` |
| route / interface | 一部成功 | `netstat -rn` で default route `en5` を確認。`ifconfig en5` は active。`route -n get default` は権限制限 |
| system proxy / env | 成功・設定なし | `scutil --proxy` に有効設定なし。HTTP/HTTPS/ALL/NO_PROXY は全て未設定 |
| npm config | 成功・異常なし | registry は標準値、proxy は null、`strict-ssl=true`、userconfig は `~/.npmrc` |
| Node/npm registry probe | 失敗 | `dns.lookup` 3/3 が `ENOTFOUND`。npm ping/view 各3/3も `ENOTFOUND` |
| curl HTTPS | 未確認 | 通常経路・`--noproxy '*'` とも DNS error、HTTP `000`。HTTPS接続段階に未到達 |
| npm cache | 影響なし | disposable cache の postcss entry は0件。終了時に削除済み |

### 原因分類

主分類は、ホストの DNS 設定不良と断定するより「Worker 実行環境の DNS/SystemConfiguration ソケット制限」です。

- npm 設定、proxy、cache が原因である根拠はない。
- default route と `en5` は確認できた。
- `/etc/resolv.conf` には nameserver があるが、DNS query 自体が拒否されている。
- registry 側の障害、直接 HTTPS、過去の一過性の HTTP 200 は未確認。
- 3回連続で同じ失敗のため、現在の実行環境では再現性がある。

### 推奨する次の1 task

「現在の Worker sandbox 外の、通常の macOS Terminal/CI ネットワーク環境で同じ診断と packaged runtime retry を行う」task を推奨します。

- 対象: 実行環境のみ。リポジトリ、npmrc、OS DNS は変更しない。
- rollback: 不要。診断セッションを終了すれば元に戻る。
- 権限: 通常のユーザー権限。runner のネットワーク権限変更が必要なら別途承認。
- 検証条件: `scutil --dns`、`networksetup`、`route -n get default`、`dig/nslookup`、Node `dns.lookup`、curl HEAD、npm ping/view が成功すること。
- 全条件が通った後にだけ `npm run desktop:prepare-node-runtime`、続いて `cargo tauri build` を再試行する。

### 修正候補の優先順位

1. project-scoped npm config  
   適用: `npm config set registry https://registry.npmjs.org/ --location=project`  
   rollback: 既存値がなければ `npm config delete registry --location=project`  
   影響: リポジトリの `.npmrc` のみ、repo write 権限。今回は registry が既に正しいため適用不要。

2. 実行時 proxy 環境変数  
   適用: 承認済み proxy が判明した場合のみ、`HTTPS_PROXY` / `HTTP_PROXY` を1プロセスへ渡す。  
   rollback: 子プロセス終了、または `unset HTTP_PROXY HTTPS_PROXY ALL_PROXY NO_PROXY`。  
   影響: その実行だけ。現在 proxy は検出されていないため適用不要。

3. `en5` に対応する特定 network service の DNS  
   適用候補: `sudo networksetup -setdnsservers "<service-for-en5>" <approved-dns-1> <approved-dns-2>`  
   rollback: DHCP DNS なら `sudo networksetup -setdnsservers "<service-for-en5>" empty`  
   影響: その network service、管理者権限が必要。active service と承認済み DNS が未確認のため、次 task では実行しない。

4. system-wide DNS  
   全 active service に DNS を設定する方式。影響範囲・権限が最大で、rollback も各 service 単位。今回の証拠では不適切。

作業前後の `git status --short` は一致しました。変更ファイルはありません。

## Verification

| 確認項目 | 結果 | 備考 |
|---|---|---|
| summary file created | 完了 | `summary/20260825/2221-investigate-os-dns-proxy-npm-route-20260825-d20ab8e9-summary.md` |
| required headings | 完了 | template 必須見出しを含む |
| raw log suppression | 完了 | raw log 本文は転記していない |
| `tools/check-summary.sh` | 完了 | writer script により終了コード 0 で通過 |

## Remaining Unknowns

| ID | 未確認事項 | 次に必要な根拠 |
|---|---|---|
| U-001 | 生成物の内容妥当性はこの summary ではレビューしていない | Next Read の対象成果物 |

## Next Read

次の作業では、まずこの summary を読む。

- `summary/20260825/2221-investigate-os-dns-proxy-npm-route-20260825-d20ab8e9-summary.md`
