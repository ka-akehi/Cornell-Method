"use client";

import ReactMarkdown, { type Components } from "react-markdown";
import rehypeSanitize from "rehype-sanitize";
import remarkGfm from "remark-gfm";

type PreviewMode = "hidden" | "visible";

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
  li: ({ children }) => <li className="break-words pl-1">{children}</li>,
  blockquote: ({ children }) => (
    <blockquote className="my-3 border-l-4 border-stone-300 bg-stone-50 px-4 py-2 text-stone-700">
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
    <pre className="my-3 max-w-full overflow-x-auto rounded-lg bg-stone-950 p-4 text-sm leading-6 text-stone-100">
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
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeSanitize]}
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
  const descriptionId = helperText ? `${id}-helper` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const fieldControls = (
    <>
      <textarea
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
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
  const previewContent =
    preview === "visible" ? (
      <div className="min-w-0">
        <h3 className="border-b border-stone-300/70 pb-2 text-xs font-extrabold tracking-[0.06em] text-stone-700">
          Markdown Preview
        </h3>
        <MarkdownPreview value={value} emptyLabel={previewEmptyLabel} />
      </div>
    ) : null;

  return (
    <div className="min-w-0 space-y-2">
      <label htmlFor={id} className="block text-sm font-medium text-stone-700">
        {label}
        {required && <span className="ml-1 text-red-600">*</span>}
      </label>
      {layout === "desktop-split" ? (
        <div className="grid min-w-0 gap-3 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] lg:items-start">
          <div className="min-w-0 space-y-2">{fieldControls}</div>
          {previewContent}
        </div>
      ) : (
        <>
          {fieldControls}
          {previewContent}
        </>
      )}
    </div>
  );
}
