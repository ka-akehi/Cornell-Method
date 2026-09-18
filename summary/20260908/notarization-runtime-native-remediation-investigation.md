# Notarization packaged runtime native binary investigation

Date: 2026-09-08 JST  
Scope: read-only investigation for Apple submission `5c98df25-cf88-4672-a1f8-395ba5ac6648` (status `Invalid`, code 4000).

## Evidence and build path

- `scripts/prepare-desktop-node-runtime.js` removes `.desktop-runtime/node`, `package.json`, `package-lock.json`, and `node_modules`, then copies the repository `package.json` and lockfile and runs `npm ci --omit=dev --no-audit --no-fund` with `NODE_ENV=production`. It then copies the generated Prisma client, the arm64 Prisma schema engine, and the current Node executable.
- The runtime package file is rewritten after install to contain only `dependencies`, but this does not prune the already-installed tree.
- `src-tauri/tauri.conf.json` runs `npm run build && npm run desktop:prepare-node-runtime`. Its resource map copies `.desktop-runtime/node`, `.desktop-runtime/package.json`, and the entire `.desktop-runtime/node_modules` directory to `Contents/Resources/runtime/node_modules`; therefore every installed native file enters the app bundle. No package-level allowlist or native-file filtering is present.
- The current config uses `macOS.signingIdentity: "-"`, which is ad-hoc signing. It cannot satisfy Developer ID notarization. The timestamped disposable app inspected was therefore not a notarization candidate; `codesign -dv` showed runtime flag, but authority was unavailable, and deep verification reported an invalid signature after inspection.
- Read-only `npm ls --omit=dev --prefix .desktop-runtime --all` reported five extraneous packages: `@emnapi/core`, `@emnapi/runtime`, `@emnapi/wasi-threads`, `@napi-rs/wasm-runtime`, and `@tybys/wasm-util`. They are transitive support files associated with the installed optional/native dependency graph and must not be assumed removable without runtime tests.
- The repository root dependencies include runtime-relevant native consumers (`next`, `better-sqlite3`, `fabric`/`canvas`, `prisma`, and `@uiw/react-md-editor` transitively pulling rendering packages). Dev dependencies include Tailwind/PostCSS tooling, but `npm ci --omit=dev` still leaves some optional/native packages selected by production dependency resolution. The lockfile contains many platform variants as optional package metadata; the installed tree must be inspected rather than inferred from lockfile entries.

## Apple error path classification

All 20 reported paths were found in `.desktop-runtime` and the corresponding timestamped app runtime tree. `file` reported the following architectures/types:

| Reported path | Classification on Apple Silicon | Remediation disposition |
|---|---|---|
| `next/next-swc-fallback/@next/swc-darwin-arm64/next-swc.darwin-arm64.node` | arm64 native Node addon; fallback copy | Keep only if runtime scan proves Next fallback can load it; otherwise prune duplicate fallback tree. If kept, Developer ID sign with runtime/hardened options. |
| `lightningcss-darwin-arm64/lightningcss.darwin-arm64.node` | arm64 native Node addon | Runtime-required only if loaded by the packaged Next/CSS path; keep and sign if required. |
| `bare-path/prebuilds/darwin-x64/bare-path.bare` | x86_64 prebuild | Unneeded for darwin-arm64 artifact; prune. |
| `bare-path/prebuilds/ios-x64-simulator/bare-path.bare` | x86_64 iOS simulator prebuild | Unneeded; prune. |
| `bare-path/prebuilds/darwin-arm64/bare-path.bare` | arm64 prebuild | Keep only if the production dependency actually loads Bare; sign if kept. |
| `@tailwindcss/oxide-darwin-arm64/tailwindcss-oxide.darwin-arm64.node` | arm64 Tailwind native addon | Likely dev/build-only and should not enter a production runtime. Prove no packaged code loads it, then prune; do not change package classification without a separate dependency decision. |
| `bare-fs/prebuilds/darwin-x64/bare-fs.bare` | x86_64 prebuild | Unneeded; prune. |
| `bare-fs/prebuilds/ios-x64-simulator/bare-fs.bare` | x86_64 iOS simulator prebuild | Unneeded; prune. |
| `bare-fs/prebuilds/darwin-arm64/bare-fs.bare` | arm64 prebuild | Keep only if loaded; sign if kept. |
| `bare-url/prebuilds/darwin-x64/bare-url.bare` | x86_64 prebuild | Unneeded; prune. |
| `bare-url/prebuilds/ios-x64-simulator/bare-url.bare` | x86_64 iOS simulator prebuild | Unneeded; prune. |
| `bare-url/prebuilds/darwin-arm64/bare-url.bare` | arm64 prebuild | Keep only if loaded; sign if kept. |
| `@napi-rs/canvas-darwin-arm64/skia.darwin-arm64.node` | arm64 native canvas addon | Keep if Fabric/canvas production path loads it; sign if kept. |
| `better-sqlite3/build/Release/test_extension.node` | arm64 test extension | Test-only; prune. It is not part of the SQLite runtime. |
| `better-sqlite3/build/Release/better_sqlite3.node` | arm64 production SQLite addon | Required by the local SQLite adapter; keep and sign. |
| `@img/sharp-libvips-darwin-arm64/lib/libvips-cpp.8.17.3.dylib` | arm64 shared library | Keep only if packaged Next/sharp path requires it; sign as a nested library before its consumer. |
| `@img/sharp-darwin-arm64/lib/sharp-darwin-arm64.node` | arm64 native Node addon | Keep only if loaded; sign if kept. |
| `@prisma/engines/schema-engine-darwin` | x86_64 Prisma executable | Duplicate/wrong architecture for arm64-only build; prune. The runtime script explicitly copies the arm64 engine. |
| `@prisma/engines/schema-engine-darwin-arm64` | arm64 Prisma executable | Explicitly copied by preparation script and required for the selected Prisma flow; keep and sign. |
| `@next/swc-darwin-arm64/next-swc.darwin-arm64.node` | arm64 Next native addon | Keep if Next runtime loads it; sign. This is distinct from the fallback duplicate above. |
| `fsevents/fsevents.node` | universal x86_64 + arm64 addon | Optional filesystem watcher, not required by the production packaged server in normal operation; prune if runtime smoke tests pass without it. If retained, both slices must be signed or the artifact must be architecture-filtered. |

The x64 and iOS simulator entries are clearly not executable requirements of an arm64 macOS package. The test extension is clearly not a runtime requirement. The arm64 entries cannot be removed solely because Apple flagged them: several are legitimate runtime dependencies and must either be retained and signed or proven unused by a packaged runtime smoke test.

## Options and recommendation

1. Sign every native file in the artifact with Developer ID Application, hardened runtime, and a secure timestamp. This is necessary but insufficient: it leaves architecture-inapplicable, test, duplicate, and possibly dev-only files in the notarized artifact and increases signing surface.
2. Produce a production-only, arm64-filtered runtime and remove x64/iOS simulator prebuilds, test extensions, duplicate Prisma engine, and proven-unused dev/fallback trees. This reduces the artifact and prevents Apple from validating files that cannot execute in the target. It is not sufficient by itself because retained native code still requires valid signing.
3. Recommended: combine 2 with 1. First make runtime preparation deterministic and minimal; then sign the main app and every retained nested executable, `.node`, `.bare`, and `.dylib` with Developer ID Application, `--options runtime`, and `--timestamp`, deepest dependencies first. `tauri.conf.json` must stop using `"-"` for the release-signing path; signing credentials remain outside the repository.

Remaining risks: optional dependency package layouts can change between npm versions; a static “arm64” filter can accidentally remove a lazy-loaded production addon; `.bare` files need explicit validation as code objects; and Tauri may re-sign or alter bundle contents. Therefore pruning must be followed by packaged arm64 smoke tests and final post-sign verification, not just filesystem checks.

## Implementation task handoff

Change only the minimum release-packaging surface:

- `scripts/prepare-desktop-node-runtime.js`: create a deterministic production runtime for darwin-arm64, remove non-target prebuild directories and test-only artifacts, and retain an explicit allowlist or validated runtime set for native files. Preserve the existing Prisma arm64 copy and production dependencies. Add a check that fails if x86_64/iOS-simulator/test native files remain in the prepared runtime and a check that required arm64 files exist.
- `src-tauri/tauri.conf.json`: replace ad-hoc signing only in the release-capable configuration with the intended Developer ID identity source, or introduce a safe environment-driven release override without committing identity/credentials. Keep local development behavior explicit.
- Tests/docs may be added only when needed to assert runtime contents and signing contract.

Do not change `package.json`, `package-lock.json`, application code, Prisma schema, user data, or unrelated Tauri/runtime code in this remediation unless a dependency classification is proven necessary and separately approved. Do not commit generated `.desktop-runtime`, app, DMG, signatures, credentials, or notarization output.

## Build, signing, and verification order

1. Start from a clean disposable build directory; run the normal frontend build and the revised runtime preparation on Apple Silicon.
2. Verify the prepared tree before bundling: `npm ls --omit=dev --prefix .desktop-runtime --all`; enumerate native candidates with `find .desktop-runtime/node_modules -type f` and `file`; assert no x86_64, iOS simulator, test extension, or unintended dev package remains; run the packaged runtime smoke tests.
3. Build the `.app`/DMG with Tauri. Do not use ad-hoc identity for the release artifact.
4. Sign nested retained libraries/addons/engines deepest-first with Developer ID Application, `--options runtime`, and `--timestamp`; sign the app last. Use the organization’s existing secure credential mechanism; never place credentials in source or logs.
5. Verify the final app before creating/submitting the DMG:
   - `codesign --verify --deep --strict --verbose=4 "Cornell Method Notebook.app"`
   - `codesign -dv --verbose=4 "Cornell Method Notebook.app"` and each retained native object; confirm Developer ID authority, `flags=0x10000(runtime)`, and a CMS signature with a secure timestamp.
   - `codesign --display --requirements - --verbose=4 ...` where useful to confirm the designated requirement.
   - `file`/`lipo -archs` on every retained native object; all target code must contain arm64 and no unintended x86_64-only or simulator slice.
   - `spctl --assess --type execute --verbose=4 "Cornell Method Notebook.app"` and `spctl --assess --type open --context context:primary-signature --verbose=4` as applicable on the final app/DMG.
   - `ditto --verify --verbose=1` on the DMG/archive if used by the release process.
6. Only after local verification, submit the exact final DMG, then inspect Apple’s returned log for zero critical validation errors and staple/validate according to the release owner’s approved process.

No Apple submission, re-signing, keychain access, staple, publish, push, commit, dependency installation, or artifact mutation was performed by this investigation.

## Working-tree notes

Initial and final `git status --short` showed pre-existing user changes: modified `Notebook.app`, several untracked prior summaries, and `summary/20260908/`. This investigation added only this summary; no existing change was reverted.

### Next Read

1. This summary
2. `scripts/prepare-desktop-node-runtime.js`
3. `src-tauri/tauri.conf.json`
4. `package.json` and `package-lock.json`
5. `doc/technical/DESKTOP_ALPHA_TAURI_FOUNDATION.md`
6. `test/desktop/desktop-node-runtime.test.ts`
