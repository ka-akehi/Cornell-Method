import type {
  ReviewNoteResponse,
  ReviewUpdateInput,
} from "@/modules/notes/contracts";
import { jsonHeaders, requestJson } from "./transport";

export async function completeReview(
  id: string,
  input: ReviewUpdateInput,
): Promise<ReviewNoteResponse> {
  return requestJson<ReviewNoteResponse>(
    `/api/notes/${id}/review`,
    {
      method: "POST",
      headers: jsonHeaders(),
      body: JSON.stringify(input),
    },
    "復習済み更新に失敗しました。",
  );
}
