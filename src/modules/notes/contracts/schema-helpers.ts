export function emptyStringToUndefined(value: unknown) {
  return value === "" ? undefined : value;
}

export function emptyStringToNull(value: unknown) {
  return value === "" || value === undefined ? null : value;
}
