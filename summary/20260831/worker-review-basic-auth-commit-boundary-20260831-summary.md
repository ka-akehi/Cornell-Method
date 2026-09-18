# Basic auth commit-boundary review

## 結論

判定は **commit ready**。対象差分は Basic Auth / state-changing API の same-origin 境界に限定され、現行 MVP の local-first 契約および handoff の「hosted exact-origin / local loopback authority / fail-closed」方針と整合する。認証情報は読取・出力していない。

## 確認した変更意図・trigger・security impact

- Trigger: production loopback WebView で `request.nextUrl.origin` と実際の wire authority がずれる可能性があり、POST/PATCH/DELETE が同一オリジン拒否になる。
- `getRequestAuthorityOrigin({ host, protocol })` は受信 Host と HTTP(S) protocol から厳密な origin を作り、path/query/fragment、credentials、空値、不正 authority は `null` にして fail-closed。
- `src/proxy.ts` は認証許可後、state-changing APIだけにこの origin を使う。GET/HEAD/OPTIONS/PUT、public path、未認証 API の契約は変更していない。
- Origin が存在する場合は exact match、Origin 欠落時だけ Referer fallback という既存のCSRF境界を維持する。Basic Authの hosted default-on / invalid config fail-closed も維持する。

## 差分・stage境界

この作業単位のstage対象は次の3ファイル全体。

```text
src/server/auth/basic-auth.js
test/auth/basic-auth.test.js
src/proxy.ts
```

`src/proxy.ts` では import の `getRequestAuthorityOrigin` 追加と、same-origin判定の `requestOrigin` 供給変更（旧 `request.nextUrl.origin` の置換）が auth/same-origin hunk。今回の `src/proxy.ts` 差分には same-origin以外の変更はないため、proxy全体をstageしてよい。その他の未コミット差分はstageしない。

## Verification

- `node --test test/auth/basic-auth.test.js`: 14/14 PASS
- `git diff --check`: PASS
- 前後 `git status --short`: 対象外を含む既存の未コミット差分を保持。今回、コード・設定・依存関係・Git indexは変更していない。
- packaged GUI / sidecar /実ユーザーDBのruntime検証は実施していない。handoff記載どおり、current worker hostでは未確認/blockedであり、これはcommit ready判定を妨げる新規欠陥ではない。

## 推奨コミット

`fix(auth): preserve request authority for same-origin API checks`

## Next Read

- `src/server/auth/basic-auth.js`
- `src/proxy.ts`
- `test/auth/basic-auth.test.js`
- `summary/20260827/backup-same-origin-investigation-20260827-summary.md`
