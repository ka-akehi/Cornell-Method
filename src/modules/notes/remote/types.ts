import type {
  NoteBodyMode,
} from "@/modules/notes/contracts";
import type { CanvasDocumentV1 } from "@/shared/canvas";

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
  bodyMode: NoteBodyMode;
  hasCanvas: boolean;
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
  sourceTitle: string;
  bodyMode: NoteBodyMode;
  body: string | null;
  canvas: CanvasDocumentV1 | null;
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
