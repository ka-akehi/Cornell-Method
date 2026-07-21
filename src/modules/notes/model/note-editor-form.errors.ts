import type { ApiFieldError } from "@/shared/http";

export function fieldError(errors: ApiFieldError[], field: string) {
  return errors.find((error) => error.field === field)?.message;
}

export function indexedFieldError(
  errors: ApiFieldError[],
  field: string,
  index: number,
) {
  return (
    fieldError(errors, `${field}.${index}.text`) ??
    fieldError(errors, `${field}.${index}.name`)
  );
}
