import type { NotesQuery } from "@/modules/notes/contracts";

export function buildNotesQuery(input: Partial<NotesQuery>) {
  const params = new URLSearchParams();

  if (input.query) params.set("query", input.query);
  if (input.from) params.set("from", input.from);
  if (input.to) params.set("to", input.to);
  if (input.tag && input.tag.length > 0) {
    const tags = Array.from(
      new Set(input.tag.map((tag) => tag.trim()).filter(Boolean)),
    );

    for (const tag of tags) {
      params.append("tags", tag);
    }
  }
  if (input.reviewDue) params.set("reviewDue", "true");
  params.set("page", String(input.page ?? 1));

  return params.toString();
}
