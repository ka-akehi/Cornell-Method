/* eslint-disable @typescript-eslint/no-require-imports -- This focused contract test uses Node's built-in test runner. */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");

const projectRoot = path.resolve(__dirname, "../..");

function readSource(relativePath) {
  return fs.readFileSync(path.join(projectRoot, relativePath), "utf8");
}

const markdownField = readSource("src/shared/markdown/markdown-field.tsx");
const packageJson = JSON.parse(readSource("package.json"));
const packageLock = JSON.parse(readSource("package-lock.json"));

test("Markdown preview allowlists safe DocBase HTML extensions", () => {
  assert.match(markdownField, /import rehypeRaw from "rehype-raw";/);
  assert.match(
    markdownField,
    /import rehypeSanitize, \{ defaultSchema, type Options \} from "rehype-sanitize";/,
  );
  assert.match(markdownField, /const markdownSanitizeSchema: Options = \{/);

  for (const tagName of ["details", "div", "mark", "summary", "u"]) {
    assert.match(markdownField, new RegExp(`"${tagName}"`));
  }

  assert.match(markdownField, /details: \["open"\]/);
  assert.match(
    markdownField,
    /new Set\(\[\.\.\.\(defaultSchema\.strip \?\? \[\]\), "iframe", "style"\]\)/,
  );
  assert.match(
    markdownField,
    /rehypePlugins=\{\[\s*rehypeRaw,\s*\[rehypeSanitize, markdownSanitizeSchema\],\s*\]\}/s,
  );

  assert.match(markdownField, /u: \(\{ children \}\)/);
  assert.match(markdownField, /mark: \(\{ children \}\)/);
  assert.match(markdownField, /details: \(\{ children, open \}\)/);
  assert.match(markdownField, /open=\{open\}/);
  assert.match(markdownField, /summary: \(\{ children \}\)/);
  assert.match(markdownField, /cursor-pointer select-none/);
  assert.match(markdownField, /focus-visible:ring-2/);

  assert.equal(packageJson.dependencies["rehype-raw"], "^7.0.0");
  assert.equal(
    packageLock.packages[""].dependencies["rehype-raw"],
    "^7.0.0",
  );
  assert.equal(packageLock.packages["node_modules/rehype-raw"].version, "7.0.0");
});

test("Markdown preview keeps dangerous HTML outside the allowlist", () => {
  const schemaStart = markdownField.indexOf(
    "const markdownSanitizeSchema: Options = {",
  );
  const schemaEnd = markdownField.indexOf("};", schemaStart) + 2;
  const schemaSource = markdownField.slice(schemaStart, schemaEnd);

  assert.match(markdownField, /strip: Array\.from\(/);
  assert.match(markdownField, /"iframe"/);
  assert.match(markdownField, /"style"/);
  assert.match(schemaSource, /\.\.\.defaultSchema/);
  assert.doesNotMatch(schemaSource, /style\s*:/i);
  assert.doesNotMatch(schemaSource, /\bon[a-z]+/i);
  assert.doesNotMatch(schemaSource, /javascript/i);
});

test("Markdown preview contract renders safe extensions and strips unsafe HTML", async () => {
  const React = (await import("react")).default;
  const { renderToStaticMarkup } = await import("react-dom/server");
  const { default: ReactMarkdown } = await import("react-markdown");
  const rehypeRaw = (await import("rehype-raw")).default;
  const rehypeSanitizeModule = await import("rehype-sanitize");
  const rehypeSanitize = rehypeSanitizeModule.default;
  const { defaultSchema } = rehypeSanitizeModule;
  const { default: remarkGfm } = await import("remark-gfm");
  const schema = {
    ...defaultSchema,
    tagNames: Array.from(
      new Set([
        ...(defaultSchema.tagNames ?? []),
        "details",
        "div",
        "mark",
        "summary",
        "u",
      ]),
    ),
    attributes: {
      ...(defaultSchema.attributes ?? {}),
      details: ["open"],
    },
    strip: Array.from(
      new Set([...(defaultSchema.strip ?? []), "iframe", "style"]),
    ),
  };
  const fixture = [
    "<u>underlined</u> <mark>highlighted</mark>",
    "",
    "<details open><summary>Details</summary><div>",
    "",
    "- [x] task",
    "",
    "| key | value |",
    "| --- | --- |",
    "| one | two |",
    "",
    "</div></details>",
    "",
    "> quote",
    "",
    "`inline`",
    "",
    "footnote[^1]",
    "",
    "[^1]: note",
    "",
    "<script>alert(1)</script><style>danger-style</style><iframe src=\"https://evil.example\">danger-frame</iframe>",
    '<a href="javascript:alert(1)" onclick="alert(1)" style="color:red">unsafe</a>',
  ].join("\n");
  const html = renderToStaticMarkup(
    React.createElement(
      ReactMarkdown,
      {
        remarkPlugins: [remarkGfm],
        rehypePlugins: [rehypeRaw, [rehypeSanitize, schema]],
      },
      fixture,
    ),
  );

  assert.match(html, /<u>underlined<\/u>/);
  assert.match(html, /<mark>highlighted<\/mark>/);
  assert.match(html, /<details open=""><summary>Details<\/summary>/);
  assert.match(html, /type="checkbox"/);
  assert.match(html, /<table>/);
  assert.match(html, /<blockquote>/);
  assert.match(html, /<code>inline<\/code>/);
  assert.match(html, /data-footnote-ref/);
  assert.doesNotMatch(
    html,
    /<script|<style|<iframe|danger-style|danger-frame|onclick|javascript:|style=/i,
  );
});

test("Markdown preview suppresses only GFM task-list markers", () => {
  assert.match(markdownField, /li: \(\{ children, className \}\)/);
  assert.match(markdownField, /className\?\.includes\("task-list-item"\)/);
  assert.ok(markdownField.includes("className={`break-words pl-1 ${"));
  assert.match(markdownField, /\? \"list-none\" : \"\"/);

  assert.match(markdownField, /remarkPlugins=\{\[remarkGfm, remarkSoftLineBreaks\]\}/);
  assert.match(
    markdownField,
    /rehypePlugins=\{\[\s*rehypeRaw,\s*\[rehypeSanitize, markdownSanitizeSchema\],\s*\]\}/s,
  );
  assert.match(markdownField, /readOnly/);
  assert.match(markdownField, /tabIndex=\{-1\}/);
  assert.match(markdownField, /onClick=\{\(event\) => event\.preventDefault\(\)\}/);
  assert.match(markdownField, /onChange=\{\(event\) => event\.preventDefault\(\)\}/);
});

test("Markdown preview keeps block-code framing on pre instead of inline code", () => {
  assert.match(markdownField, /const isBlock = className\?\.includes\("language-"\)/);
  assert.match(
    markdownField,
    /className=\"rounded bg-stone-100 px-1\.5 py-0\.5 font-mono/,
  );
  assert.match(
    markdownField,
    /\[&>code\]:rounded-none \[&>code\]:bg-transparent \[&>code\]:px-0 \[&>code\]:py-0 \[&>code\]:text-inherit/,
  );
});

test("MarkdownField provides an accessible input/preview toggle", () => {
  assert.match(markdownField, /useState<MarkdownFieldView>\("input"\)/);
  assert.match(markdownField, /const isInputView = preview === "hidden" \|\| view === "input";/);
  assert.match(markdownField, /role="group"/);
  assert.match(markdownField, /aria-label=\{`\$\{label\}の表示切替`\}/);
  assert.match(markdownField, /id=\{`\$\{id\}-input-toggle`\}/);
  assert.match(markdownField, /id=\{`\$\{id\}-preview-toggle`\}/);
  assert.match(markdownField, /aria-pressed=\{isInputView\}/);
  assert.match(markdownField, /aria-pressed=\{!isInputView\}/);
  assert.match(markdownField, />\s*入力\s*<\/button>/);
  assert.match(markdownField, />\s*プレビュー\s*<\/button>/);
  assert.match(markdownField, /hidden=\{!isInputView\}/);
  assert.match(markdownField, /hidden=\{isInputView\}/);
  assert.match(markdownField, /preview === "visible" && \(/);
});

test("Markdown preview uses compact blockquote padding without changing its boundary", () => {
  assert.ok(
    markdownField.includes(
      'className="my-3 border-l-4 border-stone-300 bg-stone-50 px-2 py-2 text-stone-700"',
    ),
  );
});

test("body, summary, detail, and read view share the Markdown renderer", () => {
  for (const relativePath of [
    "src/modules/notes/ui/components/editor/body.tsx",
    "src/modules/notes/ui/components/editor/summary.tsx",
    "src/modules/notes/ui/components/detail/display.tsx",
    "src/modules/notes/ui/components/detail/read-view.tsx",
  ]) {
    const source = readSource(relativePath);
    assert.match(source, /@\/shared\/markdown/);
    assert.match(source, /Markdown(?:Field|Preview)/);
  }
});

test("Markdown body and Summary editors opt into the shared preview toggle", () => {
  for (const relativePath of [
    "src/modules/notes/ui/components/editor/body.tsx",
    "src/modules/notes/ui/components/editor/summary.tsx",
  ]) {
    const source = readSource(relativePath);
    assert.match(source, /<MarkdownField/);
    assert.match(source, /preview="visible"/);
  }
});
