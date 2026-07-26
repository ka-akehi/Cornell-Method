import type { ApiFieldError } from "@/shared/http/client";

function addTargetForField(targetIds: Set<string>, field: string) {
  switch (field) {
    case "title":
      targetIds.add("note-title");
      return;
    case "noteDate":
      targetIds.add("note-date");
      return;
    case "nextReviewDate":
      targetIds.add("next-review-date");
      return;
    case "sourceType":
      targetIds.add("source-type");
      return;
    case "sourceTitle":
      targetIds.add("source-title");
      return;
    case "tags":
      targetIds.add("tag-input");
      return;
    case "body":
      targetIds.add("body");
      return;
    case "canvas":
      targetIds.add("canvas-viewport");
      return;
    case "summary":
      targetIds.add("summary");
      return;
    default:
      break;
  }

  const indexedTag = field.match(/^tags\.(\d+)\.name$/);
  if (indexedTag) {
    targetIds.add("tag-input");
    return;
  }

  const indexedCue = field.match(/^cues\.(\d+)\.text$/);
  if (indexedCue) {
    targetIds.add(`cue-${indexedCue[1]}`);
  }
}

export function getNoteEditorErrorTargetIds(errors: readonly ApiFieldError[]) {
  const targetIds = new Set<string>();

  for (const error of errors) {
    addTargetForField(targetIds, error.field);
  }

  return targetIds;
}

function isUnavailableTarget(element: HTMLElement) {
  return (
    element.hasAttribute("disabled") ||
    element.getAttribute("aria-disabled") === "true" ||
    element.getAttribute("aria-hidden") === "true"
  );
}

/**
 * Resolve the first matching target in the form's actual DOM order. The API
 * error order is intentionally not used for this decision.
 */
export function findNoteEditorErrorTarget(
  form: HTMLFormElement | null,
  errors: readonly ApiFieldError[],
) {
  if (!form) return null;

  const targetIds = getNoteEditorErrorTargetIds(errors);
  if (targetIds.size === 0) return null;

  for (const element of form.querySelectorAll<HTMLElement>("[id]")) {
    if (targetIds.has(element.id) && !isUnavailableTarget(element)) {
      return element;
    }
  }

  return null;
}
