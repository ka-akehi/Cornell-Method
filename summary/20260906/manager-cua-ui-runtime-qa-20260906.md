# Manager Summary: packaged UI runtime QA via Computer Use (2026-09-06)

## Scope

Verify the current normal packaged artifact through the macOS Computer Use connector, focusing on renderer same-origin behavior and the native window close flow. No source or configuration change was requested or made.

## Artifact

- Path: `/private/tmp/cornell-method-close-fix-normal-20260906-FhigAv/tauri-target/aarch64-apple-darwin/release/bundle/macos/Cornell Method Notebook.app`
- BUILD_ID: `TP446-_3y5FLHBQwztoXM`
- Main executable SHA-256: `3fcb96f784f43d268b057d2f9a3ad3d5531d1c0048108f7d020b2f1d96936fa6`

## Observations

- Computer Use connection succeeded after the connector permission became effective.
- The list, detail, and edit screens loaded through loopback URLs of the form `127.0.0.1:<ephemeral-port>/...`; the renderer completed its API-backed reads without reproducing the same-origin error.
- The existing seeded XSS-like fixture was displayed as text; no alert or script execution was observed in the accessibility tree.
- The native close button closed the clean list window.
- After relaunch, an in-memory title edit was made without saving. Closing the window displayed the expected unsaved-changes dialog with save-and-exit, discard-and-exit, and back choices.
- Selecting discard closed the app. A process check found no matching packaged app, runtime launcher, or Next server process afterward.

## Conclusion

The current artifact provides evidence that the renderer-to-sidecar same-origin path and native close flow work in this runtime. The earlier HTTP 403 for an invalid Origin remains expected guard behavior, not evidence for a same-origin fix. Do not enqueue a same-origin or close-button coding task based on the current evidence.

Direct `window.location.origin`, `window.__TAURI_INTERNALS__`, and WebView Network-panel inspection were not available through the accessibility surface, so those remain unverified rather than inferred.

## Changes and cleanup

- No source, configuration, dependency, lockfile, database, user-data, or `Notebook.app` changes.
- The title edit was discarded; no save action was used.
- Packaged app processes were absent after cleanup.

## Next Read

- `summary/20260906/manager-runtime-boundary-check-20260906.md`
- `summary/20260906/0706-investigate-packaged-runtime-same-origin-20260906-5197105a-summary.md`
- `doc/implementation/MVP_CONTRACT.md`
