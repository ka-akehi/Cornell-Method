# Backup same-origin 403 investigation

## 結論

`同一オリジンのリクエストのみ許可されます` は `POST /api/backups` が `src/proxy.ts` の state-changing same-origin check で 403 になったときの body と一致する。proxy が返すため、`src/app/api/backups/route.ts` の `POST`、`createBackupEntry`、backup provider には到達しない。

## 経路と判定

- client は `src/modules/backup/remote/index.ts` の `fetch("/api/backups", { method: "POST" })` を実行する。
- production Tauri は sidecar の ready URL `http://127.0.0.1:<dynamic-port>/notes` を `WebviewUrl::External` に渡す。ready handshake も host `127.0.0.1`、HTTP、dynamic port、path `/notes` を要求する。
- proxy は `request.nextUrl.origin`、受信 `Origin`、受信 `Referer` を `isSameOriginRequest` に渡す。
- `Origin` が存在する場合は、空文字・`null`・不正形式を含めて Referer にフォールバックせず、正規化済み Origin が `request.nextUrl.origin` と完全一致するときだけ許可する。
- `Origin` が欠落している場合だけ、HTTP(S) の `Referer` の parsed origin が `request.nextUrl.origin` と一致するとき許可する。欠落・空・不正 Referer は拒否する。
- したがって、`request.nextUrl.origin=http://127.0.0.1:<p>` のとき、`Origin=http://127.0.0.1:<p>` または欠落 Origin + `Referer=http://127.0.0.1:<p>/...` は許可。`Origin=http://localhost:<p>`、逆方向の host mismatch、port mismatch、`Origin: null`、Origin 空文字、不正 Origin、両 header 欠落は拒否。Origin が `null`／不正で Referer が正しくても拒否。
- hosted browser では document origin と request origin が同じ canonical host/port なら通常許可される。`127.0.0.1` と `localhost` は同一 loopback でも文字列上別 origin なので許可されない。

## Production と PoC の差分

production client/bridge/Tauri path には、受信 header を書き換える canonical injection は確認できなかった。相対 `fetch` の header 生成は WebView/browser の実挙動に依存する。

比較資料の PoC `tools/desktop-poc/tauri/scripts/runtime-http.cjs` には state-changing request に `Origin=http://localhost:<p>`、`Referer=http://localhost:<p>/` を付加する helper がある。しかし production packaged renderer がこの helper を使用する呼び出しは確認できない。さらに production Tauri の `request.nextUrl.origin` は `127.0.0.1` URL になるため、PoC の localhost canonical header をそのまま production に移すと mismatch になる。

## 確度

- 確定: forbidden body は proxy 403 の契約であり、backup route/provider より前に返る。判定は exact origin、または Origin 欠落時の same-origin Referer。
- 強い推定: packaged WebView の `Origin` / `Referer` が欠落、`null`、または `localhost` と `127.0.0.1` の不一致になり、exact check に失敗した。
- 未確認: ユーザー実行時の実 header 値。current runner では packaged app 起動が SIGABRT、sidecar loopback bind が EPERM で、renderer/network capture を取得できなかった。既存 QA もこの点を証明しない。

## 既存テスト

`node --test test/auth/basic-auth.test.js test/backup/backup-page-recovery.test.js test/backup/backup-service-database-url.test.js tools/desktop-poc/tauri/test/runtime-http.test.cjs` を実行し、25/25 PASS。auth tests は exact Origin、unsafe Origin、Origin 欠落時のみ Referer fallback、`null`/malformed/missing の fail-closed、API boundary を固定する。PoC tests は localhost canonicalization と PoC helper のみを固定し、production packaged renderer の証明ではない。

## 次の coding task

1 cohesive responsibility として「production Tauri loopback WebView の state-changing API request に、sidecar の実際の canonical origin と一致する Origin/Referer を付与する実装」を切り出す。対象候補は production の renderer/network bridge と Tauri runtime URL の受け渡し境界で、PoC helper の単純コピーや全 API の same-origin 無効化は行わない。

守る境界:

- hosted same-origin exact check と Basic Auth を維持する。
- local desktop も sidecar の validated `http://127.0.0.1:<p>` に限定し、任意 Origin、全 missing header の許可、全 API の check 無効化をしない。
- GET は不要に変更せず、POST/PUT/PATCH/DELETE のみを対象にする。

必要な回帰テスト:

- production path が dynamic `127.0.0.1:<p>` を canonical source として使うこと。
- state-changing request の Origin/Referer が `request.nextUrl.origin` と一致すること。
- `localhost`/`127.0.0.1` mismatch、wrong port、Origin `null`/malformed、header 欠落を拒否すること。
- hosted browser の既存 exact-origin/fail-closed 契約と、backup route/provider 到達後の provider error mapping を維持すること。

実装前に permissive macOS host の disposable packaged app で renderer の実 header を記録し、`request.nextUrl.origin`、Origin、Referer、status、route/provider 到達有無を収集して仮説を確定する。実 header が canonical なら production code 以外（WebView/network environment）の切り分けを優先する。

## Worker provenance / 変更

コード、設定、依存関係、lockfile、生成物、app bundle、DMG、SQLite、実ユーザーデータは変更していない。Worker が意図して変更した非-summary ファイルはない。調査 summary のみ作成した。

## Next Read

1. `summary/20260827/backup-same-origin-investigation-20260827-summary.md`
2. `src/proxy.ts`
3. `src/server/auth/basic-auth.js`
4. `src/modules/backup/remote/index.ts`
5. `src-tauri/src/main.rs`（runtime URL を External WebView に渡す箇所）
6. `src-tauri/src/runtime.rs`（ready URL validation）
7. `test/auth/basic-auth.test.js`
