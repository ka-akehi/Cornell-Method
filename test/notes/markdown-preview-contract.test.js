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
const markdownTaskList = readSource(
  "src/shared/markdown/markdown-task-list.js",
);
const {
  getMarkdownTaskIndex,
  markMarkdownTaskInputs,
  promoteMarkdownTaskInputMarkers,
  updateMarkdownTaskMarker,
} = require(path.join(projectRoot, "src/shared/markdown/markdown-task-list.js"));
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
    /rehypePlugins=\{\[\s*markMarkdownTaskInputs,\s*rehypeRaw,\s*promoteMarkdownTaskInputMarkers,\s*\[rehypeSanitize, markdownSanitizeSchema\],\s*\]\}/s,
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
    /rehypePlugins=\{\[\s*markMarkdownTaskInputs,\s*rehypeRaw,\s*promoteMarkdownTaskInputMarkers,\s*\[rehypeSanitize, markdownSanitizeSchema\],\s*\]\}/s,
  );
  assert.match(markdownField, /readOnly/);
  assert.match(markdownField, /tabIndex=\{-1\}/);
  assert.match(markdownField, /onClick=\{\(event\) => event\.preventDefault\(\)\}/);
  assert.match(markdownField, /onChange=\{\(event\) => event\.preventDefault\(\)\}/);
});

test("detail read renderer opts into keyboard and pointer task toggles", () => {
  const readViewStart = markdownField.indexOf(
    "function createMarkdownReadViewComponents",
  );
  const readViewEnd = markdownField.indexOf(
    "function MarkdownDocument",
    readViewStart,
  );
  const readViewComponents = markdownField.slice(readViewStart, readViewEnd);

  assert.match(markdownField, /export function MarkdownReadView/);
  assert.match(readViewComponents, /input: \(\{ type, checked, node \}\)/);
  assert.match(readViewComponents, /getMarkdownTaskIndex\(node\)/);
  assert.match(readViewComponents, /if \(currentTaskIndex === null\)/);
  assert.doesNotMatch(readViewComponents, /node\?\.position/);
  assert.doesNotMatch(readViewComponents, /let taskIndex = 0/);
  assert.match(readViewComponents, /taskToggleDisabled/);
  assert.match(
    readViewComponents,
    /readOnly[\s\S]*disabled[\s\S]*tabIndex=\{-1\}/,
  );
  assert.match(
    readViewComponents,
    /onTaskToggle\(currentTaskIndex, event\.currentTarget\.checked\)/,
  );
  assert.match(
    readViewComponents,
    /aria-label=\{`タスク \$\{currentTaskIndex \+ 1\}/,
  );
  assert.match(readViewComponents, /focus-visible:ring-2/);
  assert.match(markdownField, /markMarkdownTaskInputs/);
  assert.match(markdownField, /promoteMarkdownTaskInputMarkers/);
  assert.match(markdownTaskList, /const markdownTaskInputMarker =/);
  assert.match(markdownTaskList, /function getMarkdownTaskIndex\(node\)/);
  assert.match(markdownTaskList, /node\.position/);
  assert.match(
    markdownTaskList,
    /function updateMarkdownTaskMarker\(markdown, taskIndex, checked\)/,
  );
});

test("parser task markers keep SSR and hydration checkbox attributes aligned", async () => {
  const React = (await import("react")).default;
  const { renderToString } = await import("react-dom/server");
  const { default: ReactMarkdown } = await import("react-markdown");
  const rehypeRaw = (await import("rehype-raw")).default;
  const rehypeSanitizeModule = await import("rehype-sanitize");
  const rehypeSanitize = rehypeSanitizeModule.default;
  const { defaultSchema } = rehypeSanitizeModule;
  const { default: remarkGfm } = await import("remark-gfm");
  const schema = {
    ...defaultSchema,
    tagNames: Array.from(
      new Set([...(defaultSchema.tagNames ?? []), "div"]),
    ),
  };
  const fixture = [
    '<input type="checkbox">',
    "",
    "- [ ] first",
    "  - [x] nested",
    '  <input type="checkbox" checked>',
    "  - [ ] child",
    "",
    "<div>",
    "- [ ] raw html task-like text",
    "</div>",
    "",
    "<div>",
    "",
    "- [x] task inside raw container",
    "",
    "</div>",
    "",
    "```md",
    "- [ ] fenced",
    "```",
    "",
    '<input type="checkbox" checked disabled>',
    "",
    "- [X] last",
  ].join("\n");

  function renderFixture() {
    const states = [];
    const html = renderToString(
      React.createElement(
        ReactMarkdown,
        {
          remarkPlugins: [remarkGfm],
          rehypePlugins: [
            markMarkdownTaskInputs,
            rehypeRaw,
            promoteMarkdownTaskInputMarkers,
            [rehypeSanitize, schema],
          ],
          components: {
            input: ({ node, type, checked }) => {
              if (type !== "checkbox") return null;

              const taskIndex = getMarkdownTaskIndex(node);
              const isChecked = Boolean(checked);
              const isRawHtmlInput = taskIndex === null;
              states.push({
                taskIndex,
                checked: isChecked,
                raw: isRawHtmlInput,
              });

              return React.createElement("input", {
                type: "checkbox",
                checked: isChecked,
                readOnly: true,
                disabled: true,
                tabIndex: -1,
                "aria-label": isRawHtmlInput
                  ? isChecked
                    ? "完了済み"
                    : "未完了"
                  : `タスク ${taskIndex + 1}、${
                      isChecked ? "完了済み" : "未完了"
                    }`,
                className: "task-checkbox",
              });
            },
          },
        },
        fixture,
      ),
    );

    return { html, states };
  }

  const server = renderFixture();
  const client = renderFixture();

  assert.equal(client.html, server.html);
  assert.deepEqual(server.states, [
    { taskIndex: null, checked: false, raw: true },
    { taskIndex: 0, checked: false, raw: false },
    { taskIndex: 1, checked: true, raw: false },
    { taskIndex: null, checked: true, raw: true },
    { taskIndex: 2, checked: false, raw: false },
    { taskIndex: 3, checked: true, raw: false },
    { taskIndex: null, checked: true, raw: true },
    { taskIndex: 4, checked: true, raw: false },
  ]);
  const expectedTaskLines = [
    ["- [ ] first", "- [x] first"],
    ["  - [x] nested", "  - [ ] nested"],
    ["  - [ ] child", "  - [x] child"],
    ["- [x] task inside raw container", "- [ ] task inside raw container"],
    ["- [X] last", "- [ ] last"],
  ];
  for (const [taskIndex, [, toggledLine]] of expectedTaskLines.entries()) {
    const nextChecked = !server.states.filter((state) => !state.raw)[taskIndex].checked;
    assert.match(
      updateMarkdownTaskMarker(fixture, taskIndex, nextChecked),
      new RegExp(toggledLine.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
    );
  }
  assert.match(server.html, /aria-label="タスク 2、完了済み"/);
  assert.match(server.html, /aria-label="タスク 5、完了済み"/);
  assert.match(server.html, /readOnly=""[^>]*disabled=""[^>]*tabindex="-1"/);
  assert.match(server.html, /class="task-checkbox"/);
  assert.doesNotMatch(
    server.html,
    /__cornellMarkdownTaskInput|cornellMarkdownTaskIndex/,
  );
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

test("Summary hides only the shared preview heading and keeps the preview contract", () => {
  const summary = readSource(
    "src/modules/notes/ui/components/editor/summary.tsx",
  );
  const body = readSource("src/modules/notes/ui/components/editor/body.tsx");
  const summaryFieldStart = summary.indexOf("<MarkdownField");
  const summaryFieldEnd = summary.indexOf("/>", summaryFieldStart) + 2;
  const bodyFieldStart = body.indexOf("<MarkdownField");
  const bodyFieldEnd = body.indexOf("/>", bodyFieldStart) + 2;
  const summaryField = summary.slice(summaryFieldStart, summaryFieldEnd);
  const bodyField = body.slice(bodyFieldStart, bodyFieldEnd);

  assert.match(markdownField, /showPreviewHeading\?: boolean;/);
  assert.match(markdownField, /showPreviewHeading = true,/);
  assert.match(
    markdownField,
    /showPreviewHeading && \(\s*<h3 className="markdown-preview-heading/s,
  );
  assert.match(markdownField, />\s*Markdown Preview\s*<\/h3>/);

  assert.match(summaryField, /preview="visible"/);
  assert.match(summaryField, /showPreviewHeading=\{false\}/);
  assert.match(summaryField, /previewEmptyLabel="サマリーのプレビューはまだありません。"/);
  assert.match(bodyField, /preview="visible"/);
  assert.doesNotMatch(bodyField, /showPreviewHeading=\{false\}/);
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
    if (relativePath.endsWith("detail/read-view.tsx")) {
      assert.match(source, /MarkdownReadView/);
    } else {
      assert.match(source, /Markdown(?:Field|Preview)/);
    }
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
