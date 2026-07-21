import type {
  NotebookInput,
  NotesQuery,
} from "@/modules/notes/contracts";
import { NotesRemoteError } from "./error";
import { buildNotesQuery } from "./query";
import {
  jsonHeaders,
  notesApiBase,
  requestJson,
} from "./transport";
import type {
  NoteDetailResponse,
  NotesListResponse,
} from "./types";

export async function fetchNotesList(
  query: Partial<NotesQuery>,
): Promise<NotesListResponse> {
  const queryString = buildNotesQuery(query);
  return requestJson<NotesListResponse>(
    `/api/notes?${queryString}`,
    {},
    "読み込みに失敗しました",
  );
}

export async function createNote(input: NotebookInput): Promise<NoteDetailResponse> {
  return requestJson<NoteDetailResponse>(
    "/api/notes",
    {
      method: "POST",
      headers: jsonHeaders(),
      body: JSON.stringify(input),
    },
    "保存に失敗しました。",
  );
}

export async function updateNote(
  id: string,
  input: NotebookInput,
): Promise<NoteDetailResponse> {
  return requestJson<NoteDetailResponse>(
    `/api/notes/${id}`,
    {
      method: "PATCH",
      headers: jsonHeaders(),
      body: JSON.stringify(input),
    },
    "保存に失敗しました。",
  );
}

export async function deleteNote(id: string): Promise<void> {
  await requestJson<null>(
    `/api/notes/${id}`,
    {
      method: "DELETE",
    },
    "削除に失敗しました。",
  );
}

export async function fetchNoteDetail(
  id: string,
  options: { baseUrl?: string; cache?: RequestCache } = {},
): Promise<NoteDetailResponse | null> {
  try {
    return await requestJson<NoteDetailResponse>(
      `${notesApiBase(options.baseUrl)}/notes/${id}`,
      {
        cache: options.cache,
      },
      "ノートが見つかりません",
    );
  } catch (error) {
    if (error instanceof NotesRemoteError && error.status === 404) {
      return null;
    }
    throw error;
  }
}
