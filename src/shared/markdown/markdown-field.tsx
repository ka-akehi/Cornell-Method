"use client";

import ReactMarkdown, { type Components } from "react-markdown";
import {
  type KeyboardEvent,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import rehypeRaw from "rehype-raw";
import rehypeSanitize, { defaultSchema, type Options } from "rehype-sanitize";
import remarkGfm from "remark-gfm";
import { applyMarkdownListEnter } from "./markdown-list-enter";

type PreviewMode = "hidden" | "visible";
type MarkdownFieldView = "input" | "preview";

type MarkdownAstNode = {
  type: string;
  value?: string;
  children?: MarkdownAstNode[];
};

const markdownSanitizeSchema: Options = {
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

/**
 * Keep soft line breaks visible without adding a runtime dependency. Markdown
 * code nodes deliberately remain untouched so source formatting is preserved.
 */
function remarkSoftLineBreaks() {
  return (tree: MarkdownAstNode) => {
    transformSoftLineBreaks(tree);
  };
}

function transformSoftLineBreaks(node: MarkdownAstNode) {
  if (!node.children || node.type === "code" || node.type === "inlineCode") {
    return;
  }

  const children: MarkdownAstNode[] = [];

  for (const child of node.children) {
    if (child.type === "text" && child.value?.includes("\n")) {
      const lines = child.value.split("\n");

      lines.forEach((line, index) => {
        if (line) {
          children.push({ ...child, value: line });
        }

        if (index < lines.length - 1) {
          children.push({ type: "break" });
        }
      });
      continue;
    }

    transformSoftLineBreaks(child);
    children.push(child);
  }

  node.children = children;
}

export type MarkdownPreviewProps = {
  value: string;
  emptyLabel?: string;
  className?: string;
};

export type MarkdownFieldProps = {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  error?: string;
  helperText?: string;
  rows?: number;
  preview?: PreviewMode;
  disabled?: boolean;
  required?: boolean;
  textareaClassName?: string;
  previewEmptyLabel?: string;
  layout?: "stacked" | "desktop-split";
};

const markdownComponents: Components = {
  h1: ({ children }) => (
    <h1 className="mb-3 mt-0 break-words text-xl font-semibold text-stone-950">
      {children}
    </h1>
  ),
  h2: ({ children }) => (
    <h2 className="mb-2 mt-5 break-words text-lg font-semibold text-stone-900">
      {children}
    </h2>
  ),
  h3: ({ children }) => (
    <h3 className="mb-2 mt-4 break-words text-base font-semibold text-stone-900">
      {children}
    </h3>
  ),
  p: ({ children }) => (
    <p className="my-2 break-words leading-7 text-stone-800">{children}</p>
  ),
  ul: ({ children }) => (
    <ul className="my-2 list-disc space-y-1 pl-5 text-stone-800">
      {children}
    </ul>
  ),
  ol: ({ children }) => (
    <ol className="my-2 list-decimal space-y-1 pl-5 text-stone-800">
      {children}
    </ol>
  ),
  u: ({ children }) => (
    <u className="underline underline-offset-2">{children}</u>
  ),
  mark: ({ children }) => (
    <mark className="rounded bg-amber-200 px-0.5 text-stone-900">
      {children}
    </mark>
  ),
  details: ({ children, open }) => (
    <details
      open={open}
      className="my-3 overflow-hidden rounded-lg border border-stone-200 bg-stone-50/70 [&>div]:px-3 [&>div]:pb-3"
    >
      {children}
    </details>
  ),
  summary: ({ children }) => (
    <summary className="cursor-pointer select-none px-3 py-2 font-medium text-stone-800 outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-inset">
      {children}
    </summary>
  ),
  li: ({ children, className }) => (
    <li
      className={`break-words pl-1 ${
        className?.includes("task-list-item") ? "list-none" : ""
      }`}
    >
      {children}
    </li>
  ),
  blockquote: ({ children }) => (
    <blockquote className="my-3 border-l-4 border-stone-300 bg-stone-50 px-2 py-2 text-stone-700">
      {children}
    </blockquote>
  ),
  code: ({ className, children, ...props }) => {
    const isBlock = className?.includes("language-");

    if (isBlock) {
      return (
        <code className={className} {...props}>
          {children}
        </code>
      );
    }

    return (
      <code
        className="rounded bg-stone-100 px-1.5 py-0.5 font-mono text-[0.9em] text-stone-900"
        {...props}
      >
        {children}
      </code>
    );
  },
  pre: ({ children }) => (
    <pre className="my-3 max-w-full overflow-x-auto rounded-lg bg-stone-950 p-4 text-sm leading-6 text-stone-100 [&>code]:rounded-none [&>code]:bg-transparent [&>code]:px-0 [&>code]:py-0 [&>code]:text-inherit">
      {children}
    </pre>
  ),
  table: ({ children }) => (
    <div className="my-3 max-w-full overflow-x-auto">
      <table className="w-full min-w-max border-collapse text-left text-sm">
        {children}
      </table>
    </div>
  ),
  th: ({ children }) => (
    <th className="border border-stone-200 bg-stone-100 px-3 py-2 font-semibold text-stone-900">
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className="border border-stone-200 px-3 py-2 align-top text-stone-800">
      {children}
    </td>
  ),
  a: ({ href, children }) => (
    <a
      href={href}
      className="break-words text-amber-700 underline underline-offset-2 hover:text-amber-800"
      target="_blank"
      rel="noreferrer"
    >
      {children}
    </a>
  ),
  input: ({ type, checked }) => {
    if (type !== "checkbox") {
      return null;
    }

    return (
      <input
        type="checkbox"
        checked={Boolean(checked)}
        readOnly
        tabIndex={-1}
        aria-label={checked ? "完了済み" : "未完了"}
        className="mr-2 h-4 w-4 align-[-2px] accent-amber-500"
        onClick={(event) => event.preventDefault()}
        onChange={(event) => event.preventDefault()}
      />
    );
  },
};

export function MarkdownPreview({
  value,
  emptyLabel = "プレビューする Markdown がありません。",
  className = "",
}: MarkdownPreviewProps) {
  if (!value.trim()) {
    return (
      <div
        className={`markdown-preview-empty min-w-0 border-b border-dashed border-stone-300/70 bg-[color:var(--paper-soft)]/40 px-4 py-3 text-sm text-[color:var(--paper-ink-soft)] ${className}`}
      >
        {emptyLabel}
      </div>
    );
  }

  return (
    <div
      className={`markdown-preview-surface min-w-0 border-b border-stone-300/70 bg-[color:var(--paper-soft)]/70 px-4 pb-4 pt-3 text-sm text-[color:var(--paper-ink)] ${className}`}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkSoftLineBreaks]}
        rehypePlugins={[
          rehypeRaw,
          [rehypeSanitize, markdownSanitizeSchema],
        ]}
        components={markdownComponents}
      >
        {value}
      </ReactMarkdown>
    </div>
  );
}

export function MarkdownField({
  id,
  label,
  value,
  onChange,
  placeholder,
  error,
  helperText,
  rows = 8,
  preview = "visible",
  disabled = false,
  required = false,
  textareaClassName = "",
  previewEmptyLabel,
  layout = "stacked",
}: MarkdownFieldProps) {
  const [view, setView] = useState<MarkdownFieldView>("input");
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const pendingSelectionRef = useRef<{
    value: string;
    selectionStart: number;
    selectionEnd: number;
  } | null>(null);
  const descriptionId = helperText ? `${id}-helper` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const inputPanelId = `${id}-input-panel`;
  const previewPanelId = `${id}-preview-panel`;
  const isInputView = preview === "hidden" || view === "input";

  useLayoutEffect(() => {
    const pendingSelection = pendingSelectionRef.current;

    if (!pendingSelection) {
      return;
    }

    if (pendingSelection.value !== value) {
      pendingSelectionRef.current = null;
      return;
    }

    textareaRef.current?.setSelectionRange(
      pendingSelection.selectionStart,
      pendingSelection.selectionEnd,
    );
    pendingSelectionRef.current = null;
  }, [value]);

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (
      event.key !== "Enter" ||
      event.shiftKey ||
      event.nativeEvent.isComposing
    ) {
      return;
    }

    const result = applyMarkdownListEnter({
      value,
      selectionStart: event.currentTarget.selectionStart,
      selectionEnd: event.currentTarget.selectionEnd,
      shiftKey: event.shiftKey,
      isComposing: event.nativeEvent.isComposing,
    });

    if (!result) {
      return;
    }

    event.preventDefault();
    pendingSelectionRef.current = result;
    onChange(result.value);
  };

  const fieldControls = (
    <textarea
      id={id}
      ref={textareaRef}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      onKeyDown={handleKeyDown}
      placeholder={placeholder}
      rows={rows}
      disabled={disabled}
      required={required}
      aria-invalid={Boolean(error)}
      aria-describedby={[descriptionId, errorId].filter(Boolean).join(" ") || undefined}
      className={`w-full min-w-0 resize-y rounded-lg border bg-white px-3 py-2 text-sm leading-6 text-stone-900 shadow-sm outline-none transition placeholder:text-stone-400 disabled:cursor-not-allowed disabled:bg-stone-100 disabled:text-stone-500 ${
        error
          ? "border-red-300 focus:border-red-500 focus:ring-2 focus:ring-red-100"
          : "border-stone-200 focus:border-amber-500 focus:ring-2 focus:ring-amber-100"
      } ${textareaClassName}`}
    />
  );
  const fieldMessages = (
    <>
      {helperText && (
        <p id={descriptionId} className="text-xs leading-5 text-stone-500">
          {helperText}
        </p>
      )}
      {error && (
        <p id={errorId} className="break-words text-xs leading-5 text-red-600">
          {error}
        </p>
      )}
    </>
  );
  const inputPanel = (
    <div
      id={inputPanelId}
      role="tabpanel"
      aria-labelledby={`${id}-input-toggle`}
      hidden={!isInputView}
      className="min-w-0 space-y-2"
    >
      {fieldControls}
    </div>
  );
  const previewPanel =
    preview === "visible" ? (
      <div
        id={previewPanelId}
        role="tabpanel"
        aria-labelledby={`${id}-preview-toggle`}
        hidden={isInputView}
        className="min-w-0"
      >
        <h3 className="markdown-preview-heading border-b border-stone-300/70 pb-2 text-xs font-extrabold tracking-[0.06em] text-stone-700">
          Markdown Preview
        </h3>
        <MarkdownPreview value={value} emptyLabel={previewEmptyLabel} />
      </div>
    ) : null;

  return (
    <div className="min-w-0 space-y-2">
      <label
        htmlFor={id}
        className="block text-sm font-medium text-stone-700"
      >
        {label}
        {required && <span className="ml-1 text-red-600">*</span>}
      </label>
      {preview === "visible" && (
        <div
          role="group"
          aria-label={`${label}の表示切替`}
          className="flex w-fit rounded-lg border border-stone-200 bg-stone-50 p-1"
        >
          <button
            id={`${id}-input-toggle`}
            type="button"
            aria-pressed={isInputView}
            aria-controls={inputPanelId}
            onClick={() => setView("input")}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-1 ${
              isInputView
                ? "bg-white text-stone-900 shadow-sm"
                : "text-stone-500 hover:text-stone-800"
            }`}
          >
            入力
          </button>
          <button
            id={`${id}-preview-toggle`}
            type="button"
            aria-pressed={!isInputView}
            aria-controls={previewPanelId}
            onClick={() => setView("preview")}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-1 ${
              !isInputView
                ? "bg-white text-stone-900 shadow-sm"
                : "text-stone-500 hover:text-stone-800"
            }`}
          >
            プレビュー
          </button>
        </div>
      )}
      {layout === "desktop-split" ? (
        <div className="grid min-w-0 gap-3 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] lg:items-start">
          {inputPanel}
          {previewPanel}
        </div>
      ) : (
        <>
          {inputPanel}
          {previewPanel}
        </>
      )}
      {fieldMessages}
    </div>
  );
}
