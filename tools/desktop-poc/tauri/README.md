# Tauri + Node.js sidecar Desktop PoC

This directory is the isolated Tauri + Node.js sidecar candidate whose native PoC evidence supports the approved Cornell Method Notebook Desktop Alpha foundation. It does not change the root Next.js application or the Electron comparison candidate. The product implementation must keep this PoC directory and its evidence artifacts separate from the Desktop Alpha product boundary.

The comparison input is fixed by the shared manifest:

- baseline: `mvp-gate0-20260812-dcc057d8`
- baseline scope SHA-256: `dcc057d81b612573a5360b6f0b5bd9faea96f6e7586f59c833fc98bed978b72c`
- baseline manifest git head (fixture provenance): `366c0ebbb324db37d5bc66e6650d5b7b216616dd`
- fixture: 10,000 notes, seed `cornell-method-fixture-v1`
- fixture SHA-256: `bdb9d9996bf03c5c9885b9e1d13fdcce3cbf2925f559171bd9890fc4da6bc46e`
- fixture contentHash: `f01c404495412554a404154c7888577f681e536f72a75fb97b35643c2f3a7de6`
- target: Apple Silicon arm64, macOS 26.6.1, Node v26.7.0, npm 11.19.0

The manifest `git_head` is fixed fixture provenance. The validation and evidence reports record the executing candidate's git head separately as `revisionProvenance.candidateGitHead`, together with `candidateDirtyWorktree` (tracked and untracked changes, or `null` when unavailable). A candidate revision difference by itself does not invalidate the fixed baseline; fixture bytes/contentHash, baseline fields, and target environment are still validated.

## Responsibilities

The Rust shell owns the primary window, single-application-instance lock, duplicate-launch focus request, Node sidecar launch, dedicated process-group validation, process-tree cleanup, and loopback navigation. The sidecar is the candidate staging's production Next.js webpack output started with `next start` on the fixed loopback host and port.

`primaryWindow.count` and `primaryWindow.created` only prove that the shell created one window. They are not page usability evidence. The Rust shell records `primaryWindow.usableStatus: "PASS"` and `coldStart.processLaunchToPrimaryWindowUsableMs` only from Tauri 2.5.1's `Builder::on_page_load` callback after `PageLoadEvent::Finished` for the fixed loopback `/notes` URL. The navigation `window.location.replace()` call itself is not a usable timestamp. If that event is not observed, the shell records `UNVERIFIED` or `BLOCKED` with no usable timestamp. Native GUI/UI smoke remains a separate `BLOCKED`/`UNVERIFIED` boundary when GUI automation is unavailable.

The shell intentionally does not use a Tauri plugin. The Rust implementation records a file-lock/socket based instance handoff and uses only validated process-group signals or an explicit descendant PID tree. It never uses `pkill`, `killall`, command-name matching, or a root-PID-only cleanup PASS.

The instance lock contains a versioned JSON owner marker (`pid`, process group ID, command name, and command line). A duplicate launch first verifies that marker against the current process table. When the owner identity is active, it sends that marker through the Unix socket with a bounded retry and requires the primary listener's `focused` acknowledgement. If the socket remains unavailable or the handshake does not match, the lock is retained and startup fails clearly. A lock is recovered only when the marker is valid and the matching owner identity is no longer present (or is a matching zombie). Recovery atomically renames the verified stale lock to a unique quarantine path in the same directory, reserves the lock path with the recovering owner's marker, then atomically quarantines and cleans the stale socket. If another launch wins the replacement-lock race, the losing recovery cleans only its own quarantine and never touches the replacement socket. Missing, malformed, mismatched, or otherwise unverifiable markers fail closed and are never deleted. The primary guard also removes paths only while its own marker still owns the lock.

The Rust result records `instanceRecovery: { status: "PASS", state: "stale-recovered", reason: ... }` only after the verified stale lock and socket have been safely quarantined and cleaned under the recovery owner's reserved lock. It records a verified duplicate focus as `state: "active-owner-focused"` alongside the existing `duplicate-launch-focus` lifecycle event. A normal launch leaves this field absent. Recovery evidence is supplementary and does not promote a blocked or unverified native/UI measurement to `PASS`.

## Commands

```sh
npm run syntax
npm test
npm run poc:validate
npm run poc:prepare
npm run poc:build
npm run poc:runtime-http
npm run poc:smoke
npm run poc:lifecycle
npm run poc:package
npm run poc:evidence
npm run poc:all
```

All generated staging, candidate user data, clean/populated SQLite files, Next output, Rust target output, `.app`, DMG, run state, logs, and evidence are under:

`/private/tmp/cornell-method-desktop-poc/mvp-gate0-20260812-dcc057d8/tauri/`

The port is fixed at `127.0.0.1:37821`. A collision is recorded as BLOCKED; commands never silently choose another port. Evidence excludes note bodies, the search query, and a full database dump.

The integrated manifest keeps comparison axes explicit:

- `measurements.operationResponse` prefers measured GUI smoke operations and falls back to measured `runtime-http-smoke.json` operations when smoke operations are `BLOCKED` or `UNVERIFIED`. The selected `source` and `provenance` identify the result as production HTTP/API evidence; it is not renderer/WebView UI smoke.
- `measurements.uiSmoke` preserves the GUI smoke status. A runtime HTTP PASS does not promote a `BLOCKED` or `UNVERIFIED` GUI smoke or overall manifest to PASS.
- `measurements.cleanup` is native Tauri shell cleanup from `smoke.json` or explicit lifecycle shell evidence only. Runtime HTTP sidecar cleanup stays at `measurements.productionRuntimeHttp.cleanup` and is never substituted for native shell cleanup.
- `measurements.coldStart.primaryWindowUsable` and `measurements.coldStart.runtimeReadiness` carry separate provenance, so primary-window usability is not inferred from loopback runtime readiness.

## Dependency and build boundary

The candidate package has no JavaScript runtime dependency. `poc:prepare` copies the root runtime inputs into disposable staging and runs `npm ci` there, so root `node_modules` is not used by the candidate runtime. The shared fixture is verified before a byte-identical copy is made to populated user data. A read-only root `better-sqlite3` module may be used only to inspect the shared fixture before candidate staging exists; candidate runtime and persistence checks prefer staging's own module.

The Rust manifest pins `tauri` to `=2.5.1` and the compatible `tauri-build` to `=2.2.0`; the checked-in `src-tauri/Cargo.lock` is generated by Cargo and keeps the Tauri 2.5 dependency family reproducible. If Cargo cannot resolve the locked crates, or `cargo tauri` is absent, the affected build/package axis remains BLOCKED / UNVERIFIED and no placeholder app, DMG, or measurement is produced.

Developer ID signing, notarization, public distribution, and a product updater are intentionally outside this PoC. The update manifest is metadata only and uses explicit restart as the future application boundary. The PoC host Node binary is not claimed to be a fully bundled distributable sidecar; that is recorded as a Desktop Alpha risk.
