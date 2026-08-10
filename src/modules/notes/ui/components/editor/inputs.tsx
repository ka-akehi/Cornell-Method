"use client";

import { openDatePicker } from "../date-picker";

export function TitleInput({
  id,
  label,
  value,
  onChange,
  error,
  required = false,
  disabled = false,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  required?: boolean;
  disabled?: boolean;
}) {
  return (
    <div className="min-w-0 space-y-1.5">
      <label htmlFor={id} className="sr-only">
        {label}
        {required && <span className="ml-1">*</span>}
      </label>
      <input
        id={id}
        type="text"
        value={value}
        required={required}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        aria-invalid={Boolean(error)}
        aria-disabled={disabled}
        aria-describedby={error ? `${id}-error` : undefined}
        className={`note-paper-title w-full min-w-0 rounded-none border-0 border-b !bg-transparent px-0 py-1 !shadow-none outline-none transition placeholder:text-stone-400 focus:ring-0 ${
          disabled
            ? "cursor-not-allowed border-stone-200 text-stone-400 placeholder:text-stone-300"
            : error
              ? "border-red-400 focus:border-red-500"
              : "border-stone-300 focus:border-amber-500"
        }`}
        placeholder="タイトルを入力"
      />
      {error && (
        <p id={`${id}-error`} className="break-words text-xs leading-5 text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}

export function TextInput({
  id,
  label,
  value,
  onChange,
  error,
  type = "text",
  max,
  required = false,
  disabled = false,
  readOnly = false,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  type?: "text" | "date";
  max?: string;
  required?: boolean;
  disabled?: boolean;
  readOnly?: boolean;
}) {
  return (
    <div className="min-w-0 space-y-1.5">
      <label
        htmlFor={id}
        className="block text-sm font-medium text-stone-700"
      >
        {label}
        {required && <span className="ml-1 text-red-600">*</span>}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        max={max}
        required={required}
        disabled={disabled}
        readOnly={readOnly}
        onChange={(event) => onChange(event.target.value)}
        aria-invalid={Boolean(error)}
        aria-disabled={disabled}
        aria-readonly={readOnly}
        aria-describedby={error ? `${id}-error` : undefined}
        onClick={type === "date" ? openDatePicker : undefined}
        className={`w-full min-w-0 rounded-lg border bg-white px-3 py-2 text-sm text-stone-900 shadow-sm outline-none transition placeholder:text-stone-400 disabled:cursor-not-allowed disabled:bg-stone-50 disabled:text-stone-400 disabled:placeholder:text-stone-300 ${
          error
            ? "border-red-300 focus:border-red-500 focus:ring-2 focus:ring-red-100"
            : "border-stone-200 focus:border-amber-500 focus:ring-2 focus:ring-amber-100"
        }`}
      />
      {error && (
        <p id={`${id}-error`} className="break-words text-xs leading-5 text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}
