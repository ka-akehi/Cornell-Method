import { z } from "zod";
import { canvasDocumentSchema } from "./canvas.schema";
import { cueSchema } from "./cue.schema";
import {
  dateStringSchema,
  nullableDateStringSchema,
  todayDateString,
} from "./date.schema";
import { emptyStringToUndefined } from "./schema-helpers";
import { tagSchema } from "./tag.schema";

const SOURCE_TYPES = ["book", "lecture", "video", "article", "other"] as const;
const BODY_MODES = ["markdown", "canvas"] as const;

export const notebookInputSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(1, "タイトルは必須です")
      .max(120, "タイトルは120文字以内で入力してください"),
    noteDate: dateStringSchema,
    sourceType: z.preprocess(
      emptyStringToUndefined,
      z.enum(SOURCE_TYPES).optional(),
    ),
    sourceTitle: z.preprocess(
      (value) => value ?? "",
      z.string().max(120, "出典タイトルは120文字以内で入力してください"),
    ),
    bodyMode: z.enum(BODY_MODES).default("markdown"),
    body: z.preprocess((value) => value ?? "", z.string()),
    canvas: canvasDocumentSchema.optional(),
    summary: z.preprocess((value) => value ?? "", z.string()),
    nextReviewDate: nullableDateStringSchema.optional(),
    cues: z.array(cueSchema).default([]),
    tags: z.array(tagSchema).max(12, "タグは12件以内で入力してください").default([]),
  })
  .superRefine((input, context) => {
    if (input.noteDate > todayDateString()) {
      context.addIssue({
        code: "custom",
        path: ["noteDate"],
        message: "未来日は入力できません",
      });
    }

    if (input.nextReviewDate && input.nextReviewDate < input.noteDate) {
      context.addIssue({
        code: "custom",
        path: ["nextReviewDate"],
        message: "次回復習日は記載日以降の日付を入力してください",
      });
    }

    if (input.bodyMode === "canvas" && !input.canvas) {
      context.addIssue({
        code: "custom",
        path: ["canvas"],
        message: "bodyMode=canvasではcanvasが必須です",
      });
    }

    if (input.bodyMode === "markdown" && input.canvas) {
      context.addIssue({
        code: "custom",
        path: ["canvas"],
        message: "bodyMode=markdownではcanvasを指定できません",
      });
    }

    const tagNames = new Set<string>();
    input.tags.forEach((tag, index) => {
      if (tagNames.has(tag.name)) {
        context.addIssue({
          code: "custom",
          path: ["tags", index, "name"],
          message: "タグが重複しています",
        });
      }
      tagNames.add(tag.name);
    });
  });

export type NoteBodyMode = (typeof BODY_MODES)[number];
export type NotebookInput = z.infer<typeof notebookInputSchema>;
