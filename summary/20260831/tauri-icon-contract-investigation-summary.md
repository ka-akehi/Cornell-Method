# Tauri icon contract investigation

Date: 2026-08-31 (JST)

## Decision

**Commit ready.** Treat the icon change as a product asset change, not as a disposable build artifact. The commit boundary is:

- `src-tauri/icons/icon.png`
- `src-tauri/icons/icon.svg`
- `test/desktop/tauri-icon-contract.test.js`

Do not include unrelated worktree changes, generated packaged artifacts, or this summary in the icon commit.

## Evidence

- `src-tauri/tauri.conf.json` actively bundles `icons/icon.png`; the Tauri bundle does not reference SVG.
- The previous tracked PNG was 256x256 RGBA. The current PNG is 1024x1024, 8-bit RGBA, non-interlaced. This is an intentional replacement of the shipped bundle asset, not merely a derived untracked cache.
- `icon.svg` is a 1024x1024 vector source with the Cornell-specific palette (`#173F35`, `#F5E7CF`, `#C96A4A`, `#D7A84A`) and no Vercel/Next mark. Its geometry describes the same notebook icon represented by the PNG; the SVG is retained as the editable provenance/source asset even though Tauri consumes the PNG.
- The contract test verifies the configured PNG path, PNG signature/dimensions/color type, SVG palette, and absence of Vercel/Next source marks.

## Verification

`node --test test/desktop/tauri-icon-contract.test.js` passed: **2/2**.

The pre- and post-investigation `git status --short` showed the same pre-existing broad worktree changes plus the already-present icon PNG/SVG/test changes. No image, code, configuration, Git index, or unrelated file was modified by this investigation.

## Recommended commit message

`feat(desktop): add Cornell app icon assets and contract test`

## Next Read

No further icon-specific investigation is required. A packaging build may be used as an additional downstream check, but it is not needed to establish the commit boundary because the contract test and Tauri configuration already pass.
