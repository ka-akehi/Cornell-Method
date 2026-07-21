import type { NotebookInput } from "@/modules/notes/contracts";
import type { CanvasDocumentV1 } from "@/shared/canvas";

export type SourceType = NonNullable<NotebookInput["sourceType"]>;

export type NoteEditorCue = {
  id?: string;
  text: string;
  order: number;
};

export type NoteEditorTag = {
  id?: string;
  name: string;
  color?: string | null;
};

export type NoteEditorInitial = Partial<
  Omit<NotebookInput, "sourceType" | "cues" | "tags" | "bodyMode" | "canvas"> & {
    id: string;
    bodyMode?: NotebookInput["bodyMode"];
    canvas?: NotebookInput["canvas"] | null;
    sourceType: SourceType | null | "";
    cues: Array<Partial<NoteEditorCue> & { content?: string; marker?: string }>;
    tags: NoteEditorTag[];
    notes: Array<{ content?: string }>;
  }
>;

export type NoteEditorFormState = {
  id?: string;
  title: string;
  noteDate: string;
  sourceType: SourceType | "";
  sourceTitle: string;
  tags: NoteEditorTag[];
  cues: NoteEditorCue[];
  bodyMode: NonNullable<NotebookInput["bodyMode"]>;
  body: string;
  canvas: CanvasDocumentV1 | null;
  summary: string;
  nextReviewDate: string;
};

export const sourceTypeOptions: Array<{ value: SourceType; label: string }> = [
  { value: "book", label: "書籍" },
  { value: "lecture", label: "講義" },
  { value: "video", label: "動画" },
  { value: "article", label: "記事" },
  { value: "other", label: "その他" },
];
