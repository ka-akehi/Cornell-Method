import type { TagOptionsResponse } from "@/modules/notes/contracts";
import { requestJson } from "./transport";
import type { NoteTag } from "./types";

export async function fetchTagOptions(): Promise<NoteTag[]> {
  return requestJson<TagOptionsResponse>(
    "/api/tags",
    {},
    "タグ候補の読み込みに失敗しました",
  );
}
