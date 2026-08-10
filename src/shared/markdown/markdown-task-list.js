/**
 * @typedef {Object} MarkdownTaskMarker
 * @property {number} lineIndex
 * @property {number} markerStart
 * @property {string} marker
 */

const taskListItemPattern =
  /^((?:(?:[ \t]{0,3}>[ \t]?)+[ \t]*|[ \t]*)(?:[-+*]|\d+[.)])[ \t]+)\[([ xX])\](?=[ \t]+)/;

const listItemPrefixPattern =
  /^((?:(?:[ \t]{0,3}>[ \t]?)+[ \t]*|[ \t]*)(?:[-+*]|\d+[.)])[ \t]+)/;

const markdownTaskInputMarker = "__cornellMarkdownTaskInput";
const markdownTaskIndexDataKey = "cornellMarkdownTaskIndex";

/**
 * Mark the checkbox inputs created by mdast-util-to-hast for GFM task items.
 *
 * This runs before rehype-raw. Raw HTML is still represented as `raw` nodes at
 * this point, so only parser-generated GFM task inputs can receive the marker.
 * The marker is removed again before sanitization. Promotion also requires a
 * generated HAST node without a source position, so a raw HTML attribute with
 * the same internal name cannot spoof a task input.
 *
 * @returns {(tree: MarkdownHastNode) => void}
 */
function markMarkdownTaskInputs() {
  return (tree) => {
    let taskIndex = 0;

    walkMarkdownHast(tree, (node) => {
      if (
        node.tagName !== "input" ||
        node.properties?.type !== "checkbox" ||
        node.properties.disabled !== true
      ) {
        return;
      }

      node.properties[markdownTaskInputMarker] = taskIndex;
      taskIndex += 1;
    });
  };
}

/**
 * Move the internal marker to HAST data after rehype-raw has parsed raw HTML.
 * The data field is passed to ReactMarkdown components but is not rendered as
 * a DOM attribute. Raw HTML nodes never carried the internal marker.
 *
 * @returns {(tree: MarkdownHastNode) => void}
 */
function promoteMarkdownTaskInputMarkers() {
  return (tree) => {
    walkMarkdownHast(tree, (node) => {
      const marker = node.properties?.[markdownTaskInputMarker];
      const taskIndex = normalizeMarkdownTaskIndex(marker);

      // rehype-raw adds source positions to parsed HTML elements, while the
      // parser-generated task input keeps the marker without a position.
      if (taskIndex === null || node.position) {
        return;
      }

      node.data = {
        ...(node.data ?? {}),
        [markdownTaskIndexDataKey]: taskIndex,
      };
      delete node.properties[markdownTaskInputMarker];
    });
  };
}

/**
 * Read the parser-assigned index from a ReactMarkdown input node.
 *
 * @param {unknown} node
 * @returns {number | null}
 */
function getMarkdownTaskIndex(node) {
  if (!node || typeof node !== "object") {
    return null;
  }

  const data = node.data;
  const taskIndex =
    data && typeof data === "object"
      ? data[markdownTaskIndexDataKey]
      : undefined;

  return normalizeMarkdownTaskIndex(taskIndex);
}

/**
 * rehype-raw stringifies custom properties while reparsing the tree, so
 * accept the numeric and string forms produced by the two parser stages.
 *
 * @param {unknown} value
 * @returns {number | null}
 */
function normalizeMarkdownTaskIndex(value) {
  if (typeof value === "number") {
    return Number.isInteger(value) && value >= 0 ? value : null;
  }

  if (typeof value !== "string" || !/^\d+$/.test(value)) {
    return null;
  }

  const taskIndex = Number(value);
  return Number.isSafeInteger(taskIndex) ? taskIndex : null;
}

/**
 * @typedef {Object} MarkdownHastNode
 * @property {string} type
 * @property {string} [tagName]
 * @property {Record<PropertyKey, unknown>} [properties]
 * @property {Record<string, unknown>} [data]
 * @property {MarkdownHastNode[]} [children]
 */

/**
 * @param {MarkdownHastNode} node
 * @param {(node: MarkdownHastNode) => void} visit
 * @returns {void}
 */
function walkMarkdownHast(node, visit) {
  if (node.type === "element") {
    visit(node);
  }

  for (const child of node.children ?? []) {
    walkMarkdownHast(child, visit);
  }
}

/**
 * Toggle one GFM task-list marker while preserving the rest of the source.
 * The index follows the document order of task-list markers, including nested
 * list items. Fenced code blocks are skipped so arbitrary HTML/code inputs are
 * never treated as task markers.
 *
 * @param {string} markdown
 * @param {number} taskIndex
 * @param {boolean} checked
 * @returns {string}
 */
function updateMarkdownTaskMarker(markdown, taskIndex, checked) {
  if (!Number.isInteger(taskIndex) || taskIndex < 0) {
    return markdown;
  }

  const segments = markdown.split(/(\r\n|\n|\r)/);
  let fence = null;
  let htmlBlock = null;
  let currentTaskIndex = 0;

  for (let segmentIndex = 0; segmentIndex < segments.length; segmentIndex += 2) {
    const line = segments[segmentIndex];

    if (htmlBlock) {
      const result = consumeMarkdownHtmlBlock(htmlBlock, line);

      if (result.consumed) {
        htmlBlock = result.next;
        continue;
      }

      htmlBlock = null;
    }

    const fenceMarker = parseFenceMarker(line);

    if (fence) {
      if (
        fenceMarker &&
        fenceMarker.character === fence.character &&
        fenceMarker.length >= fence.length &&
        fenceMarker.rest.trim().length === 0
      ) {
        fence = null;
      }
      continue;
    }

    if (fenceMarker) {
      fence = fenceMarker;
      continue;
    }

    const htmlBlockStart = parseMarkdownHtmlBlockStart(
      segments,
      segmentIndex,
      line,
    );

    if (htmlBlockStart) {
      htmlBlock = htmlBlockStart.next;
      continue;
    }

    const taskMatch = line.match(taskListItemPattern);
    if (!taskMatch || !isNestedTaskListItem(segments, segmentIndex, taskMatch[1])) {
      continue;
    }

    if (currentTaskIndex === taskIndex) {
      const markerStart = taskMatch[1].length;
      const nextMarker = checked ? "[x]" : "[ ]";
      segments[segmentIndex] =
        line.slice(0, markerStart) +
        nextMarker +
        line.slice(markerStart + 3);
      return segments.join("");
    }

    currentTaskIndex += 1;
  }

  return markdown;
}

const blockHtmlTagNames = new Set([
  "address",
  "article",
  "aside",
  "base",
  "blockquote",
  "body",
  "caption",
  "center",
  "col",
  "colgroup",
  "dd",
  "details",
  "dialog",
  "dir",
  "div",
  "dl",
  "dt",
  "fieldset",
  "figcaption",
  "figure",
  "footer",
  "form",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "head",
  "header",
  "hr",
  "html",
  "iframe",
  "legend",
  "li",
  "link",
  "main",
  "menu",
  "menuitem",
  "nav",
  "ol",
  "p",
  "pre",
  "script",
  "section",
  "summary",
  "table",
  "tbody",
  "td",
  "tfoot",
  "th",
  "thead",
  "title",
  "tr",
  "track",
  "ul",
  "style",
  "textarea",
]);

/**
 * @typedef {Object} MarkdownHtmlBlockState
 * @property {"comment" | "processing" | "declaration" | "cdata" | "tag"} kind
 * @property {number} quoteDepth
 * @property {string | null} tagName
 * @property {boolean} endOnClosing
 */

/**
 * @typedef {Object} MarkdownHtmlBlockStart
 * @property {MarkdownHtmlBlockState | null} next
 */

/**
 * @param {string[]} segments
 * @param {number} segmentIndex
 * @param {string} line
 * @returns {MarkdownHtmlBlockStart | null}
 */
function parseMarkdownHtmlBlockStart(segments, segmentIndex, line) {
  const withoutBlockquote = stripBlockquotePrefix(line);
  const quoteDepth = getQuoteDepth(line);
  const indent = withoutBlockquote.match(/^[ \t]*/)?.[0].length ?? 0;
  const content = withoutBlockquote.slice(indent);

  if (
    indent > 3 ||
    !content.startsWith("<")
  ) {
    return null;
  }

  if (content.startsWith("<!--")) {
    return content.includes("-->")
      ? { next: null }
      : {
          next: {
            kind: "comment",
            quoteDepth,
            tagName: null,
            endOnClosing: false,
          },
        };
  }

  if (content.startsWith("<?")) {
    return content.includes("?>")
      ? { next: null }
      : {
          next: {
            kind: "processing",
            quoteDepth,
            tagName: null,
            endOnClosing: false,
          },
        };
  }

  if (/^<!\[CDATA\[/i.test(content)) {
    return content.includes("]]>")
      ? { next: null }
      : {
          next: {
            kind: "cdata",
            quoteDepth,
            tagName: null,
            endOnClosing: false,
          },
        };
  }

  if (/^<![A-Z]/.test(content)) {
    return content.includes(">")
      ? { next: null }
      : {
          next: {
            kind: "declaration",
            quoteDepth,
            tagName: null,
            endOnClosing: false,
          },
        };
  }

  const tagMatch = content.match(/^<\/?([A-Za-z][A-Za-z0-9-]*)\b/);
  if (!tagMatch) {
    return null;
  }

  const tagName = tagMatch[1].toLowerCase();
  const isClosingTag = content.startsWith("</");
  const isLongHtmlTag = blockHtmlTagNames.has(tagName);
  const isCompleteTag = /\/>\s*$/.test(content) || /\>\s*$/.test(content);

  if (!isLongHtmlTag && isMarkdownListContent(segments, segmentIndex, indent, quoteDepth)) {
    return null;
  }

  if (isClosingTag || (isCompleteTag && content.includes(`</${tagName}>`))) {
    return { next: null };
  }

  if (!isLongHtmlTag && isCompleteTag) {
    return {
      next: { kind: "tag", quoteDepth, tagName, endOnClosing: true },
    };
  }

  if (tagName === "script" || tagName === "style" || tagName === "pre" || tagName === "textarea") {
    return content.toLowerCase().includes(`</${tagName}>`)
      ? { next: null }
      : { next: { kind: "tag", quoteDepth, tagName, endOnClosing: true } };
  }

  return {
    next: { kind: "tag", quoteDepth, tagName, endOnClosing: false },
  };
}

/**
 * @param {MarkdownHtmlBlockState} state
 * @param {string} line
 * @returns {{ consumed: boolean, next: MarkdownHtmlBlockState | null }}
 */
function consumeMarkdownHtmlBlock(state, line) {
  const quoteDepth = getQuoteDepth(line);

  if (quoteDepth !== state.quoteDepth && !isMarkdownBlankLine(line)) {
    return { consumed: false, next: null };
  }

  const content = stripBlockquotePrefix(line).trim();

  if (state.kind === "comment" && content.includes("-->")) {
    return { consumed: true, next: null };
  }

  if (state.kind === "processing" && content.includes("?>")) {
    return { consumed: true, next: null };
  }

  if (state.kind === "cdata" && content.includes("]]>")) {
    return { consumed: true, next: null };
  }

  if (state.kind === "declaration" && content.includes(">")) {
    return { consumed: true, next: null };
  }

  if (state.kind === "tag") {
    if (isMarkdownBlankLine(line)) {
      return { consumed: true, next: null };
    }

    if (
      state.endOnClosing &&
      state.tagName &&
      content.toLowerCase().includes(`</${state.tagName}>`)
    ) {
      return { consumed: true, next: null };
    }
  }

  return { consumed: true, next: state };
}

/**
 * @param {string[]} segments
 * @param {number} segmentIndex
 * @param {number} indent
 * @param {number} quoteDepth
 * @returns {boolean}
 */
function isMarkdownListContent(segments, segmentIndex, indent, quoteDepth) {
  for (let previousIndex = segmentIndex - 2; previousIndex >= 0; previousIndex -= 2) {
    const previousLine = segments[previousIndex];

    if (isMarkdownBlankLine(previousLine)) {
      break;
    }

    const previousContext = parseListContext(previousLine);
    if (previousContext) {
      return (
        previousContext.quoteDepth === quoteDepth &&
        (previousContext.indent < indent ||
          (previousContext.indent === indent && indent > 0))
      );
    }

    if (getBlockIndent(previousLine) > indent) {
      continue;
    }

    break;
  }

  return false;
}

/**
 * @param {string} line
 * @returns {number}
 */
function getQuoteDepth(line) {
  return (line.match(/^(?:[ \t]{0,3}>[ \t]?)+/)?.[0].match(/>/g) ?? []).length;
}

/**
 * GFM also recognizes nested list items indented by four or more spaces when
 * they belong to a parent list. A standalone four-space line is an indented
 * code block and must not be edited.
 *
 * @param {string[]} segments
 * @param {number} segmentIndex
 * @param {string} taskPrefix
 * @returns {boolean}
 */
function isNestedTaskListItem(segments, segmentIndex, taskPrefix) {
  const context = parseListContext(taskPrefix);

  if (!context || context.indent <= 3) {
    return true;
  }

  for (let previousIndex = segmentIndex - 2; previousIndex >= 0; previousIndex -= 2) {
    const previousLine = segments[previousIndex];

    if (isMarkdownBlankLine(previousLine)) {
      continue;
    }

    const previousContext = parseListContext(previousLine);
    if (previousContext) {
      return (
        previousContext.quoteDepth === context.quoteDepth &&
        previousContext.indent < context.indent
      );
    }

    if (getBlockIndent(previousLine) >= context.indent) {
      continue;
    }

    return false;
  }

  return false;
}

/**
 * @param {string} line
 * @returns {boolean}
 */
function isMarkdownBlankLine(line) {
  return stripBlockquotePrefix(line).trim().length === 0;
}

/**
 * @param {string} line
 * @returns {number}
 */
function getBlockIndent(line) {
  return stripBlockquotePrefix(line).match(/^[ \t]*/)?.[0].length ?? 0;
}

/**
 * @param {string} line
 * @returns {string}
 */
function stripBlockquotePrefix(line) {
  return line.replace(/^(?:[ \t]{0,3}>[ \t]?)+/, "");
}

/**
 * @param {string} value
 * @returns {{ indent: number, quoteDepth: number } | null}
 */
function parseListContext(value) {
  const match = value.match(listItemPrefixPattern);
  if (!match) {
    return null;
  }

  const prefix = match[1];
  const quoteDepth = (prefix.match(/>/g) ?? []).length;
  const withoutBlockquote = prefix.replace(
    /^(?:[ \t]{0,3}>[ \t]?)+/,
    "",
  );
  const indent = withoutBlockquote.match(/^[ \t]*/)?.[0].length ?? 0;

  return { indent, quoteDepth };
}

/**
 * @param {string} line
 * @returns {{ character: "`" | "~", length: number, rest: string } | null}
 */
function parseFenceMarker(line) {
  const withoutBlockquote = line.replace(
    /^(?:[ \t]{0,3}>[ \t]?)+/,
    "",
  );
  const match = withoutBlockquote.match(/^[ \t]{0,3}(`{3,}|~{3,})(.*)$/);

  if (!match) {
    return null;
  }

  return {
    character: match[1][0],
    length: match[1].length,
    rest: match[2],
  };
}

module.exports = {
  getMarkdownTaskIndex,
  markMarkdownTaskInputs,
  promoteMarkdownTaskInputMarkers,
  updateMarkdownTaskMarker,
};
