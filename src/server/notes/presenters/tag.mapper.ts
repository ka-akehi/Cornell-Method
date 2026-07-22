import type { TagDto } from "@/modules/notes/contracts";

type TagPersistenceRecord = {
  id: string;
  name: string;
  color: string | null;
};

export function formatTagOptions(
  tags: readonly TagPersistenceRecord[],
): TagDto[] {
  return tags.map(({ id, name, color }) => ({ id, name, color }));
}
