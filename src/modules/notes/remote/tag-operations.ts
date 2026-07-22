import type { TagDto, TagOptionsResponse } from "@/modules/notes/contracts";
import { requestJson } from "./transport";

export async function fetchTagOptions(): Promise<TagDto[]> {
  return requestJson<TagOptionsResponse>(
    "/api/tags",
    {},
    "タグ候補の読み込みに失敗しました",
  );
}
