type TagRelation = {
  tag: {
    id: string;
    name: string;
    color: string | null;
  };
};

export function dateOnlyString(date: Date | null) {
  return date ? date.toISOString().slice(0, 10) : null;
}

export function dateTimeString(date: Date | null) {
  return date ? date.toISOString() : null;
}

export function bodyModeString(bodyMode: string) {
  if (bodyMode === "markdown" || bodyMode === "canvas") {
    return bodyMode;
  }

  throw new Error(`Unsupported notebook body mode: ${bodyMode}`);
}

export function formatTags(tags: readonly TagRelation[]) {
  return tags
    .map(({ tag }) => ({
      id: tag.id,
      name: tag.name,
      color: tag.color,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}
