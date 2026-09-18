import type { MouseEvent } from "react";

export function openDatePicker(event: MouseEvent<HTMLInputElement>) {
  const input = event.currentTarget;
  if (input.disabled || input.readOnly) return;

  if (typeof input.showPicker === "function") {
    try {
      input.showPicker();
      return;
    } catch {
      input.focus();
      return;
    }
  }

  input.focus();
}
