import { z } from "zod";

export const tagNameRegex = /^[\p{Script=Hiragana}\p{Script=Katakana}A-Za-z0-9!"#$%&'()0=~|\-^¥@\[`{;:]+*},.\/<>?_]+$/u;

export const tagSchema = z.object({
  id: z.string().optional(),
  name: z
    .string()
    .trim()
    .min(1)
    .max(30)
    .regex(tagNameRegex, "invalid_chars"),
  color: z.string().optional(),
});

export const cueCardSchema = z.object({
  id: z.string().optional(),
  marker: z.string().min(1).max(50),
  content: z.string().default(""),
  order: z.number().int().nonnegative(),
  deleted: z.boolean().optional(),
});

export const noteCardSchema = z.object({
  id: z.string().optional(),
  content: z.string().default(""),
  order: z.number().int().nonnegative(),
  isHidden: z.boolean().default(false),
  cueIds: z.array(z.string()).default([]),
  deleted: z.boolean().optional(),
});

export const draftSchema = z.object({
  isDraft: z.boolean().default(true),
  hiddenNotes: z.unknown().optional(),
  version: z.number().int().nonnegative().default(0),
  autosaveVersion: z.number().int().nonnegative().default(0),
});

export const notebookInputSchema = z.object({
  notebook: z.object({
    id: z.string().optional(),
    title: z.string().min(1).max(120),
    overview: z.string().max(400).default(""),
    summary: z.string().default(""),
    noteDate: z.string(),
    tags: z.array(tagSchema).max(12).default([]),
    cues: z.array(cueCardSchema).default([]),
    notes: z.array(noteCardSchema).default([]),
  }),
  draft: draftSchema,
  draftOnly: z.boolean().optional(),
});

export type NotebookInput = z.infer<typeof notebookInputSchema>;
