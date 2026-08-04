/* eslint-disable @typescript-eslint/no-require-imports -- This focused contract test uses Node's built-in test runner. */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");

const projectRoot = path.resolve(__dirname, "../..");

function readSource(relativePath) {
  return fs.readFileSync(path.join(projectRoot, relativePath), "utf8");
}

function readColorToken(foundation, tokenName) {
  const match = foundation.match(
    new RegExp(`${tokenName}:\\s*(#[0-9a-fA-F]{6})`),
  );
  assert.ok(match, `Missing color token ${tokenName}`);
  return match[1];
}

function relativeLuminance(hex) {
  const channels = hex
    .slice(1)
    .match(/../g)
    .map((channel) => Number.parseInt(channel, 16) / 255)
    .map((channel) =>
      channel <= 0.03928
        ? channel / 12.92
        : ((channel + 0.055) / 1.055) ** 2.4,
    );

  return channels.reduce(
    (sum, channel, index) => sum + channel * [0.2126, 0.7152, 0.0722][index],
    0,
  );
}

function contrastRatio(foreground, background) {
  const foregroundLuminance = relativeLuminance(foreground);
  const backgroundLuminance = relativeLuminance(background);
  return (
    (Math.max(foregroundLuminance, backgroundLuminance) + 0.05) /
    (Math.min(foregroundLuminance, backgroundLuminance) + 0.05)
  );
}

function assertNormalTextContrast(label, foreground, background) {
  const ratio = contrastRatio(foreground, background);
  assert.ok(
    ratio >= 4.5,
    `${label} contrast ${ratio.toFixed(2)}:1 must be at least 4.5:1`,
  );
}

test("accent-filled controls keep normal text at WCAG AA contrast", () => {
  const foundation = readSource("src/app/styles/foundation.css");
  const filledBackground = readColorToken(foundation, "--app-accent-deep");

  for (const [label, foregroundToken] of [
    ["notes list create link", "--app-surface"],
    ["backup create button", "--app-paper-surface"],
  ]) {
    assertNormalTextContrast(
      label,
      readColorToken(foundation, foregroundToken),
      filledBackground,
    );
  }

  assertNormalTextContrast("Cue number", "#fffdf8", filledBackground);
  assertNormalTextContrast("AppChrome selected create link", "#fffaf1", filledBackground);
  assertNormalTextContrast("note paper submit", "#fff8eb", filledBackground);

  const softBackground = readColorToken(foundation, "--app-accent-soft");
  const accentText = readColorToken(foundation, "--app-accent-deep");
  assertNormalTextContrast("AppChrome selected navigation link", accentText, softBackground);
});

test("filled-control states use the AA-safe token without changing semantic states", () => {
  const list = readSource("src/modules/notes/ui/components/list/list.tsx");
  const backup = readSource("src/modules/backup/ui/components/backup-page.tsx");
  const cues = readSource("src/modules/notes/ui/components/editor/cues.tsx");
  const appShell = readSource("src/app/styles/app-shell.css");
  const paper = readSource("src/app/styles/note-paper.css");

  assert.match(
    list,
    /border-\[var\(--app-accent-deep\)\] bg-\[var\(--app-accent-deep\)\][\s\S]*text-\[var\(--app-surface\)\][\s\S]*hover:bg-\[var\(--app-accent-deep\)\]/,
  );
  assert.match(
    backup,
    /border-\[var\(--app-accent-deep\)\] bg-\[var\(--app-accent-deep\)\][\s\S]*text-\[var\(--app-paper-surface\)\][\s\S]*disabled:bg-\[var\(--app-line\)\]/,
  );
  assert.match(
    cues,
    /bg-\[color:var\(--app-accent-deep\)\][\s\S]*text-\[color:var\(--app-paper-surface\)\]/,
  );
  assert.match(
    appShell,
    /\.app-chrome-nav-link\.is-selected,[\s\S]*background: var\(--app-accent-soft\);[\s\S]*color: var\(--app-accent-deep\);/,
  );
  assert.match(
    appShell,
    /\.app-chrome-create-link:hover,[\s\S]*\.app-chrome-create-link\.is-selected,[\s\S]*background: var\(--app-accent-deep\);[\s\S]*color: #fffaf1;/,
  );
  assert.match(
    paper,
    /\.note-paper-footer button\[type="submit"\]:not\(:disabled\)[\s\S]*border-color: var\(--app-accent-deep\);[\s\S]*background-color: var\(--app-accent-deep\);[\s\S]*color: #fff8eb;/,
  );
  assert.match(
    paper,
    /\.note-paper-footer button\[type="submit"\]:hover:not\(:disabled\)[\s\S]*background-color: var\(--app-accent-deep\);/,
  );
});
