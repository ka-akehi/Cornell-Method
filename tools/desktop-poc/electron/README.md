# Electron Desktop PoC

This directory is an isolated Electron candidate for the Cornell Method Notebook Desktop PoC. It is not the selected desktop shell and it does not change the current MVP application.

The comparison input is fixed by the shared manifest:

- baseline: `mvp-gate0-20260812-dcc057d8`
- baseline manifest git head (fixture provenance): `366c0ebbb324db37d5bc66e6650d5b7b216616dd`
- baseline scope SHA-256: `dcc057d81b612573a5360b6f0b5bd9faea96f6e7586f59c833fc98bed978b72c`
- fixture: 10,000 notes, seed `cornell-method-fixture-v1`
- fixture SHA-256: `bdb9d9996bf03c5c9885b9e1d13fdcce3cbf2925f559171bd9890fc4da6bc46e`
- fixture contentHash: `f01c404495412554a404154c7888577f681e536f72a75fb97b35643c2f3a7de6`
- target: Apple Silicon arm64, macOS 26.6.1, Node v26.7.0, npm 11.19.0

The manifest `git_head` is fixed fixture provenance. The validation and evidence reports record the executing candidate's git head separately as `revisionProvenance.candidateGitHead`, together with `candidateDirtyWorktree` (tracked and untracked changes, or `null` when unavailable). A candidate revision difference by itself does not invalidate the fixed baseline; fixture bytes/contentHash, baseline fields, and target environment are still validated.

The next Tauri + Node.js sidecar PoC must use the same manifest, fixture bytes, arm64/macOS target, production webpack build mode, cache state, fixed loopback measurement procedure, operation sequence, process-tree memory aggregation, and evidence fields. The later comparison task chooses the shell; this candidate makes no choice.

## Isolation boundary

Only this directory is tracked by the repository task. All generated staging, user data, build output, app/DMG artifacts, run state, and evidence go under:

`/private/tmp/cornell-method-desktop-poc/mvp-gate0-20260812-dcc057d8/electron/`

The preparation script copies the application source, Prisma schema/migrations, config, public assets, and package metadata into disposable `staging/`. It excludes `.git`, `.env`, live databases, root Next output, and root `node_modules` contents. `staging/node_modules` is a read-only symlink to the existing root dependency tree; build output is written only to `staging/next-dist`.

`user-data/clean/live.sqlite` is created with the existing Prisma SQLite migrations. `user-data/populated/live.sqlite` starts as a SHA-256-verified copy of the shared fixture. The runtime always receives an absolute `file:` URL under candidate user-data, never a bundle, staging source, root DB, or shared fixture path.

The main process starts `next start` on fixed loopback port `37821`, creates one primary `BrowserWindow` for `/notes`, and stops the runtime when the primary window closes. The runtime is launched as a detached child on POSIX so its positive root PID can be validated as a dedicated process-group ID; process-group signaling is allowed only when every observed runtime descendant has that group ID and the group has no member outside the runtime's parent-child closure. If either direction is not verified, shutdown falls back to the explicitly observed parent-child descendant closure. The preload intentionally exposes no shell API to the renderer. Internal Electron, renderer, Next, and helper processes are allowed; memory is aggregated over the descendant closure rooted at the Electron main PID.

## Candidate commands

Install must happen in this directory only, after `npm run poc:validate` has passed:

```sh
npm install --no-audit --no-fund
npm run poc:validate
npm run poc:prepare
npm run poc:build
npm run poc:smoke
npm run poc:runtime-http
npm run poc:lifecycle
npm run poc:package
npm run poc:evidence
```

`npm run poc:runtime-http` is a separate production-runtime/API smoke. It is useful when the Electron binary or GUI cannot run, but it is not counted as renderer UI smoke. `npm run poc:all` runs the same sequence and stops after a failed baseline validation. `npm run syntax` and `npm test` are candidate-only checks. The root `npm run lint` and `npm run build` are intentionally not run for this task because they would cross the isolation boundary.

## Evidence

The canonical output is `evidence/electron-evidence-manifest.json`. It records the exact baseline and dependency versions, clean/populated user-data paths, build/cache conditions, cold start, list/search/detail/edit/save/reopen timings, process roles/PIDs/RSS, lifecycle and cleanup, migration/SQLite/read-back results, artifact size/hash/architecture, and update metadata outlook. Shutdown evidence records the runtime root PID, the observed descendant closure before shutdown, the SIGTERM and bounded grace wait, any SIGKILL and its method, the observed after-shutdown tree and remaining PIDs, loopback listener state, forced-termination state, timeouts, and final status. Smoke/lifecycle cleanup is PASS only when the before/after tree observations are valid and no PID from the observed app-owned runtime closure remains.

Supporting reports are `baseline-validation.json`, `preparation.json`, `build.json`, `smoke.json`, `runtime-http-smoke.json`, `lifecycle.json`, `package.json`, and `update-manifest.json`. A blocked or unverified operation is recorded as such; it is not converted to PASS by static inference. Shutdown evidence includes the two-way group-scope result, the selected signal method, and the reason for an explicit PID fallback. No measurement threshold is introduced, and this PoC records one trial per measurement unless the manifest says otherwise. If npm registry access is unavailable, the candidate does not synthesize a fake lockfile or fall back to root dependencies; install and dependent measurements remain `BLOCKED`.

## Packaging and update boundary

The packaging script requests an arm64 `.app` directory artifact and DMG through Electron Builder. Developer ID signing, notarization, public distribution, and a product updater are intentionally out of scope. The static update template can carry version, artifact name, architecture, SHA-256, and explicit-restart application. Background download, signature verification, and restart application are future boundaries only.

The packaged artifact includes the candidate shell and the built Next output as a PoC resource. It does not claim to be a distributable product runtime because Node and the complete native dependency tree are not bundled. The evidence manifest calls out this risk for the later Desktop Alpha design.
