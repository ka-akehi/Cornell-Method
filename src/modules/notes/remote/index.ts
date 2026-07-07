import type {
  ApiErrorBody,
  ApiFieldError,
} from "@/shared/http";
import { decodeApiErrorResponse } from "@/shared/http";
import type {
  NotebookInput,
  NotesQuery,
  ReviewUpdateInput,
} from "@/modules/notes/contracts";

export type NoteTag = {
  id: string;
  name: string;
  color: string | null;
};

export type NotebookListItem = {
  id: string;
  title: string;
  noteDate: string | null;
  sourceType: string | null;
  sourceTitle: string;
  overview: string;
  summary: string;
  cueCount: number;
  hasSummary: boolean;
  nextReviewDate: string | null;
  reviewedAt: string | null;
  tags: NoteTag[];
};

export type NotesListResponse = {
  page: number;
  totalPages: number;
  totalCount: number;
  data: NotebookListItem[];
};

export type NoteDetailResponse = {
  id: string;
  title: string;
  noteDate: string | null;
  sourceType: string | null;
  sourceTitle: string | null;
  overview: string | null;
  body: string | null;
  summary: string | null;
  nextReviewDate: string | null;
  reviewedAt: string | null;
  cues: Array<{ id: string; text: string; order: number }>;
  tags: NoteTag[];
};

export type ReviewNoteResponse = {
  id?: string;
  reviewedAt?: string | null;
  nextReviewDate?: string | null;
  message?: string;
};

export class NotesRemoteError extends Error {
  readonly status: number;
  readonly body: ApiErrorBody | null;

  constructor(
    message: string,
    options: { status: number; body?: ApiErrorBody | null },
  ) {
    super(message);
    this.name = "NotesRemoteError";
    this.status = options.status;
    this.body = options.body ?? null;
  }

  get fieldErrors(): ApiFieldError[] {
    return this.body?.errors ?? [];
  }
}

function buildNotesQuery(input: Partial<NotesQuery>) {
  const params = new URLSearchParams();

  if (input.query) params.set("query", input.query);
  if (input.from) params.set("from", input.from);
  if (input.to) params.set("to", input.to);
  if (input.tag && input.tag.length > 0) params.set("tag", input.tag.join(","));
  if (input.reviewDue) params.set("reviewDue", "true");
  params.set("page", String(input.page ?? 1));

  return params.toString();
}

function jsonHeaders() {
  return { "Content-Type": "application/json" };
}

async function parseJson<T>(response: Response): Promise<T | null> {
  if (response.status === 204) return null;
  return (await response.json().catch(() => null)) as T | null;
}

async function requestJson<T>(
  input: RequestInfo | URL,
  init: RequestInit,
  fallbackMessage: string,
): Promise<T> {
  const response = await fetch(input, init);

  if (!response.ok) {
    const body = await decodeApiErrorResponse(response);
    throw new NotesRemoteError(body?.message ?? fallbackMessage, {
      status: response.status,
      body,
    });
  }

  return (await parseJson<T>(response)) as T;
}

function notesApiBase(baseUrl?: string) {
  if (!baseUrl) return "/api";
  const normalizedBase = baseUrl.startsWith("http") ? baseUrl : `https://${baseUrl}`;
  return `${normalizedBase.replace(/\/$/, "")}/api`;
}

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

export async function fetchTagOptions(): Promise<NoteTag[]> {
  return requestJson<NoteTag[]>("/api/tags", {}, "タグ候補の読み込みに失敗しました");
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
