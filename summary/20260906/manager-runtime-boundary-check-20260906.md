# Manager Runtime Boundary Check

作成日: 2026-09-06（JST）

## 目的

ユーザーから「この PC は Computer Use と loopback bind が許可されているはず」と指摘を受けたため、PC の loopback、packaged app の起動経路、HTTP/API 境界、Codex Computer Use connector の権限を分離して確認した。

## 対象

- exact normal artifact: `/private/tmp/cornell-method-close-fix-normal-20260906-FhigAv/tauri-target/aarch64-apple-darwin/release/bundle/macos/Cornell Method Notebook.app`
- `BUILD_ID`: `TP446-_3y5FLHBQwztoXM`
- main executable SHA-256: `3fcb96f784f43d268b057d2f9a3ad3d5531d1c0048108f7d020b2f1d96936fa6`
- disposable runtime root: `/private/tmp/cornell-method-runtime-qa-manager-cleanenv-20260906`

## Findings

| 項目 | 判定 | 根拠 |
|---|---|---|
| PC の `127.0.0.1` ephemeral bind | PASS | 最小 Node listener が bind、port 取得、close まで成功 |
| standalone sidecar launcher | PASS | 秘密情報を除いた `env -i` で ready handshake、loopback runtime child を確認 |
| cleanenv packaged app | PASS | app → sidecar bootstrap → serve → Next runtime child、`127.0.0.1` listener、health `200` を確認 |
| invalid Origin guard | PASS | disposable `/api/backups` への不正 Origin request が `403` |
| canonical Origin backup POST | PASS | `200` |
| canonical Origin note POST | PASS | `201` |
| note PATCH / GET | PASS | `200` / `200` |
| note DELETE / deleted GET | PASS | `204` / `404` |
| backup GET | PASS | `200`、metadata count `1` |
| live SQLite read-back | PASS | disposable DB の notebooks count `0`、`PRAGMA integrity_check` は `ok` |
| backup SQLite read-back | PASS | `PRAGMA integrity_check` は `ok` |
| Codex Computer Use connector | BLOCKED | `cua.getApp(...)` が `Computer Use permissions are not granted` を返した |

## 解釈の境界

- PC の loopback bind は許可されている。前回の「loopback bind を許可する host が必要」という表現は、この PC 全体に対する断定としては不正確だった。
- 継承環境を付けた packaged app の最初の起動では sidecar process は生成されたが listener が見つからなかった。その後の `env -i` packaged app は正常に ready した。差分の恒久原因は未確定であり、環境変数の一つを原因と断定しない。
- canonical HTTP/API/proxy/DB は disposable 環境で正常だった。ユーザー報告の same-origin 表示を説明する renderer の Tauri invoke、browser fallback、WebView Network entry は未観測である。
- window restoration warning、実際の × ボタン、dirty save/discard/cancel、`location.origin`、`window.__TAURI_INTERNALS__` は Computer Use connector が拒否されたため未確認である。

## 変更と後処理

- source、設定、依存関係、lockfile、`Notebook.app`、実ユーザー data は変更していない。
- disposable runtime の app、sidecar、Next child は停止済み。
- disposable data は実ユーザー data を含まない。raw log、process environment、credential は summary に記録していない。

## Next Read

- `summary/20260906/manager-runtime-boundary-check-20260906.md`
- `summary/20260906/0706-investigate-packaged-runtime-same-origin-20260906-5197105a-summary.md`
- `summary/20260906/worker-rebuild-normal-app-20260906-summary.md`
- `Notebook.app`

## 次の判断

Computer Use connector が許可されたセッションで、同じ exact artifact と disposable data を使い、`location.origin`、Tauri internals、native invoke / browser fallback、Network entry、window close を実測する。HTTP/API 側の証拠だけでは coding task を作成しない。
