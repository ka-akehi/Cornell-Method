---
summary_type: task-summary
created_at: 2026-08-28 15:51 JST
task_kind: worker-task
task_status: done
---

## Objective

`investigate-proxy-canonical-origin-mismatch-after-local-probe-20260828-3ea031ba.task.md` の完了状態、変更ファイル、後続で読む最小ファイルを固定し、raw log の再読を避ける。

## Scope

| 項目 | 内容 |
|---|---|
| task kind | `worker-task` |
| worker | `Worker-common` |
| status | `done` |
| task file | `codex-queue/tasks/done/investigate-proxy-canonical-origin-mismatch-after-local-probe-20260828-3ea031ba.task.md` |
| changed-files provenance | `explicit worker provenance manifest` |
| raw log | out of scope |

## Inputs Read

| 種別 | パス | 確認内容 |
|---|---|---|
| task | `codex-queue/tasks/done/investigate-proxy-canonical-origin-mismatch-after-local-probe-20260828-3ea031ba.task.md` | task 完了状態の起点 |
| changed files | Worker provenance manifest | Worker が意図的に作成・更新・削除した成果物だけを記録 |

## Changes Made

| パス | 変更内容 | 理由 |
|---|---|---|
| none | Worker が記録した変更ファイルなし | provenance manifest に記録なし |

## Findings

| ID | fact / assumption / unknown | 内容 | 根拠 |
|---|---|---|---|
| F-001 | fact | task は `done` として完了処理された。 | `codex-queue/tasks/done/investigate-proxy-canonical-origin-mismatch-after-local-probe-20260828-3ea031ba.task.md` |
| F-002 | fact | Worker provenance manifest に変更ファイルは記録されなかった。 | Changes Made |
| A-001 | assumption | 後続作業ではこの summary の Next Read を起点にすれば raw log 再読を避けられる。 | summary 運用ルール |

## Worker Report

調査完了。コード・設定・生成物は変更していません。

結論として、現在の packaged sidecar で proxy が認識する canonical origin は、実質的に次の値です。

```text
http://localhost:<dynamic-port>
```

sidecar 自体は `127.0.0.1:<port>` で listen し、ready URL も `http://127.0.0.1:<port>/notes` ですが、Next.js 16.2.9 の `NextURL` が loopback hostname を `localhost` に正規化します。

根拠：

- [`src/proxy.ts:39-52`](</Users/kazuya/Desktop/自己学習/Cornell-Method/src/proxy.ts:39>)
  - state-changing API に対して `request.nextUrl.origin` と `Origin` / `Referer` を検証。
  - 不一致時に固定の HTTP 403 body を返す。
- [`src/server/auth/basic-auth.js:217-245`](</Users/kazuya/Desktop/自己学習/Cornell-Method/src/server/auth/basic-auth.js:217)
  - `Origin` が存在すると Referer へ fallback しない。
  - parsed origin の完全一致が必要。
- [`src-tauri/sidecar/launcher.cjs:1162-1179`](</Users/kazuya/Desktop/自己学習/Cornell-Method/src-tauri/sidecar/launcher.cjs:1162)
  - `127.0.0.1` の ephemeral port を確保。
- [`src-tauri/sidecar/launcher.cjs:1372-1395`](</Users/kazuya/Desktop/自己学習/Cornell-Method/src-tauri/sidecar/launcher.cjs:1372)
  - Next を `--hostname 127.0.0.1 --port <port>` で起動。
- [`src-tauri/src/runtime.rs:2194-2222`](</Users/kazuya/Desktop/自己学習/Cornell-Method/src-tauri/src/runtime.rs:2194)
  - ready URL は `http`、host `127.0.0.1`、dynamic port、path `/notes` に限定。
- [`src-tauri/src/runtime.rs:2466-2524`](</Users/kazuya/Desktop/自己学習/Cornell-Method/src-tauri/src/runtime.rs:2466)
  - native request の接続先、`Origin`、`Referer` は validated runtime URL から生成。
- `node_modules/next/dist/server/web/next-url.js:15-21`
  - `127.0.0.1`、`localhost`、`::1` を hostname `localhost` に正規化。
- 実測でも `NextURL("http://127.0.0.1:57040/...").origin` は `http://localhost:57040` になった。

そのため、次の両方が 403 になります。

```text
request.nextUrl.origin = http://localhost:57040
Origin                = http://127.0.0.1:57040
Referer               = http://127.0.0.1:57040/backup
```

`Origin` が存在するため Referer は使われず、`127.0.0.1` と `localhost` の文字列差で拒否されます。Origin を除去して Referer だけにしても、Referer の parsed origin が `127.0.0.1` のため拒否されます。

curl probe から確定できること：

- `POST /api/__origin_probe__` が API の state-changing 判定に入り、proxy の 403 body を返した。
- したがって route の存在確認より前に proxy guard で拒否された。
- 明示した `Origin` / `Referer` が URL と見かけ上一致していても、Next 内部の canonical origin とは一致しない可能性が高い。
- 403 body は native invoke 内部 HTTP 応答でも browser fetch 応答でも成立するため、curl 単独では経路までは確定できない。

経路の帰属：

- Browser: `location.origin` は `http://127.0.0.1:<port>`。相対 fetch が同じ Origin を送るなら、Next の `localhost` canonical origin と不一致。
- Native: [`runtime.rs:2510-2524`](</Users/kazuya/Desktop/自己学習/Cornell-Method/src-tauri/src/runtime.rs:2510) が `127.0.0.1` の Origin / Referer を生成するため、同じ不一致が起こり得る。
- IPC: `ipc://localhost/request_desktop_state_changing_api` の 200 OK は Tauri bridge 呼び出しの transport 応答。内部 HTTP の status 403 とは別物。今回の観測は「IPC は成功し、native 内部 HTTP が proxy で 403」と解釈するのが自然。

安全な修正境界：

- proxy の guard を緩和しない。
- wildcard capability や redirect 許可を追加しない。
- `127.0.0.1` と任意 host の同一視はしない。
- Next が実際に採用する canonical origin と、WebView の document origin、native の `Origin` / `Referer` を一つの明示的な設計値へ揃える。
- 接続先の loopback pinning と、Origin 検証値を混同しない targeted test を追加する。

追加で必要な最小 runtime 証拠：

- `request.nextUrl.origin` の sanitized 値
- 受信 `Origin` / `Referer` の host・port のみ
- browser fetch か native invoke か
- 内部 HTTP status
- proxy guard 通過／拒否のみ

Cookie、credential、本文、token、invoke key は不要です。

検証結果：

- `git diff --check`: PASS
- auth / desktop bridge / node-runtime 関連既存テスト: 27/27 PASS
- 作業前後の `git status --short`: 既存の未コミット変更のみ。今回の変更なし。
- Worker provenance manifest: 変更ファイルなし。

## Verification

| 確認項目 | 結果 | 備考 |
|---|---|---|
| summary file created | 完了 | `summary/20260828/1551-investigate-proxy-canonical-origin-mismatch-after-local-probe-20260828-3ea031ba-summary.md` |
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

- `summary/20260828/1551-investigate-proxy-canonical-origin-mismatch-after-local-probe-20260828-3ea031ba-summary.md`
