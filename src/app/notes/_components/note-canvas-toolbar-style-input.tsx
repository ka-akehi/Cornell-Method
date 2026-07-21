import type {
  ChangeEventHandler,
  FocusEventHandler,
  KeyboardEventHandler,
} from "react";

export function parseIntegerStyleValue(rawValue: string, min: number, max: number) {
  const value = rawValue.trim();
  if (!/^\d+$/.test(value)) return null;

  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= min && parsed <= max ? parsed : null;
}

type CanvasIntegerStyleInputProps = {
  value: string;
  min: number;
  max: number;
  ariaLabel: string;
  disabled: boolean;
  onFocus: FocusEventHandler<HTMLInputElement>;
  onChange: ChangeEventHandler<HTMLInputElement>;
  onBlur: FocusEventHandler<HTMLInputElement>;
  onKeyDown: KeyboardEventHandler<HTMLInputElement>;
};

export function CanvasIntegerStyleInput({
  value,
  min,
  max,
  ariaLabel,
  disabled,
  onFocus,
  onChange,
  onBlur,
  onKeyDown,
}: CanvasIntegerStyleInputProps) {
  return (
    <>
      <input
        type="number"
        inputMode="numeric"
        min={min}
        max={max}
        step={1}
        value={value}
        disabled={disabled}
        aria-label={ariaLabel}
        aria-invalid={parseIntegerStyleValue(value, min, max) === null}
        onFocus={onFocus}
        onChange={onChange}
        onBlur={onBlur}
        onKeyDown={onKeyDown}
      />
      <span aria-hidden="true">px</span>
    </>
  );
}
