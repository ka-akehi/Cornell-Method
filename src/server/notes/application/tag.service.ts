import type { TagDto } from "@/modules/notes/contracts";
import { findTagOptions } from "@/server/notes/infrastructure";
import { formatTagOptions } from "@/server/notes/presenters";

export async function listTagOptions(): Promise<TagDto[]> {
  const tagRecords = await findTagOptions();
  return formatTagOptions(tagRecords);
}
