/**
 * @typedef {Object} MarkdownListEnterOptions
 * @property {string} value
 * @property {number} selectionStart
 * @property {number} selectionEnd
 * @property {boolean} [shiftKey]
 * @property {boolean} [isComposing]
 */

/**
 * @typedef {Object} MarkdownListEnterResult
 * @property {string} value
 * @property {number} selectionStart
 * @property {number} selectionEnd
 */

/**
 * Apply Markdown list continuation for a plain textarea Enter key press.
 * Returning null leaves the browser's normal textarea behavior untouched.
 *
 * @param {MarkdownListEnterOptions} options
 * @returns {MarkdownListEnterResult | null}
 */
function applyMarkdownListEnter({
  value,
  selectionStart,
  selectionEnd,
  shiftKey = false,
  isComposing = false,
}) {
  if (
    shiftKey ||
    isComposing ||
    selectionStart !== selectionEnd ||
    selectionStart < 0 ||
    selectionStart > value.length
  ) {
    return null;
  }

  const lineStart = value.lastIndexOf("\n", selectionStart - 1) + 1;
  const lineEndIndex = value.indexOf("\n", selectionStart);
  const lineEnd = lineEndIndex === -1 ? value.length : lineEndIndex;
  const line = value.slice(lineStart, lineEnd);

  if (isInsideFencedCode(value, lineStart)) {
    return null;
  }

  const list = parseListLine(line);

  if (!list || selectionStart < lineStart + list.contentStartOffset) {
    return null;
  }

  if (isInsideInlineCode(line.slice(0, selectionStart - lineStart))) {
    return null;
  }

  if (!list.hasContent) {
    if (selectionStart !== lineEnd) {
      return null;
    }

    const nextValue =
      value.slice(0, lineStart) + list.indent + value.slice(lineEnd);
    const nextCaret = lineStart + list.indent.length;

    return {
      value: nextValue,
      selectionStart: nextCaret,
      selectionEnd: nextCaret,
    };
  }

  const nextValue =
    value.slice(0, selectionStart) + "\n" + list.nextPrefix + value.slice(selectionStart);
  const nextCaret = selectionStart + 1 + list.nextPrefix.length;

  return {
    value: nextValue,
    selectionStart: nextCaret,
    selectionEnd: nextCaret,
  };
}

function parseListLine(line) {
  const unorderedMatch = line.match(/^([ \t]*)([-*+])([ \t]*)(.*)$/);

  if (
    unorderedMatch &&
    (unorderedMatch[3].length > 0 || unorderedMatch[4].length === 0)
  ) {
    const [, indent, marker, separator, rest] = unorderedMatch;
    const task = parseTaskContent(rest);
    const hasContent = task
      ? task.content.trim().length > 0
      : rest.trim().length > 0;

    return {
      indent,
      hasContent,
      contentStartOffset:
        indent.length +
        marker.length +
        separator.length +
        (task ? 3 + task.separator.length : 0),
      nextPrefix: task
        ? `${indent}${marker}${separator}[ ]${task.separator || " "}`
        : `${indent}${marker}${separator}`,
    };
  }

  const orderedMatch = line.match(/^([ \t]*)(\d+)([.)])([ \t]*)(.*)$/);

  if (
    orderedMatch &&
    (orderedMatch[4].length > 0 || orderedMatch[5].length === 0)
  ) {
    const [, indent, number, delimiter, separator, rest] = orderedMatch;

    return {
      indent,
      hasContent: rest.trim().length > 0,
      contentStartOffset:
        indent.length + number.length + delimiter.length + separator.length,
      nextPrefix: `${indent}${incrementDecimalString(number)}${delimiter}${separator}`,
    };
  }

  return null;
}

function parseTaskContent(rest) {
  const taskMatch = rest.match(/^\[([ xX])\]([ \t]*)(.*)$/);

  if (!taskMatch) {
    return null;
  }

  const [, , separator, content] = taskMatch;

  // `[x]text` is regular list text in Markdown; a task marker needs a
  // separator after the closing bracket when it has following content.
  if (separator.length === 0 && content.length > 0) {
    return null;
  }

  return {
    separator,
    content,
  };
}

function incrementDecimalString(number) {
  const digits = number.split("");
  let index = digits.length - 1;

  while (index >= 0 && digits[index] === "9") {
    digits[index] = "0";
    index -= 1;
  }

  if (index < 0) {
    return `1${digits.join("")}`;
  }

  digits[index] = String(Number(digits[index]) + 1);
  return digits.join("");
}

function isInsideFencedCode(value, position) {
  let fence = null;

  for (const line of value.slice(0, position).split("\n")) {
    const fenceMatch = line.match(/^[ \t]{0,3}(`{3,}|~{3,})/);

    if (!fenceMatch) {
      continue;
    }

    const marker = fenceMatch[1];

    if (!fence) {
      fence = { character: marker[0], length: marker.length };
      continue;
    }

    if (
      marker[0] === fence.character &&
      marker.length >= fence.length
    ) {
      fence = null;
    }
  }

  return Boolean(fence);
}

function isInsideInlineCode(lineBeforeCaret) {
  let delimiterLength = 0;
  let index = 0;

  while (index < lineBeforeCaret.length) {
    if (lineBeforeCaret[index] === "\\") {
      index += 2;
      continue;
    }

    if (lineBeforeCaret[index] !== "`") {
      index += 1;
      continue;
    }

    let runLength = 1;

    while (lineBeforeCaret[index + runLength] === "`") {
      runLength += 1;
    }

    if (delimiterLength === 0) {
      delimiterLength = runLength;
    } else if (delimiterLength === runLength) {
      delimiterLength = 0;
    }

    index += runLength;
  }

  return delimiterLength > 0;
}

module.exports = { applyMarkdownListEnter };
