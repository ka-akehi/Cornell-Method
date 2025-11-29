import { NextResponse } from "next/server";
import { addDays, isAfter, parseISO, startOfDay } from "date-fns";
import { prisma } from "@/lib/prisma";
import {
  NotebookInput,
  notebookInputSchema,
  tagSchema,
} from "@/lib/validation";

const PAGE_SIZE = 50;
const DEFAULT_TAG_COLOR = "#f59e0b";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("query")?.trim();
  const tagsParam = searchParams.get("tags");
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const page = Number(searchParams.get("page") || "1");

  const tagList = tagsParam
    ? Array.from(new Set(tagsParam.split(",").filter(Boolean)))
    : [];

  const where: any = {
    deletedAt: null,
  };

  if (query) {
    where.OR = [
      { title: { contains: query } },
      { overview: { contains: query } },
      { summary: { contains: query } },
    ];
  }

  if (from) {
    where.noteDate = { ...(where.noteDate ?? {}), gte: parseISO(from) };
  }

  if (to) {
    where.noteDate = { ...(where.noteDate ?? {}), lte: parseISO(to) };
  }

  if (tagList.length > 0) {
    where.tags = {
      some: {
        tag: {
          name: { in: tagList },
        },
      },
    };
  }

  const totalCount = await prisma.notebook.count({ where });
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const data = await prisma.notebook.findMany({
    where,
    orderBy: { noteDate: "desc" },
    skip: (page - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
    include: {
      tags: { include: { tag: true } },
    },
  });

  return NextResponse.json({
    page,
    totalPages,
    totalCount,
    data,
  });
}

export async function POST(request: Request) {
  try {
    const json = await request.json();
    const parsed = notebookInputSchema.parse(json) as NotebookInput;

    const noteDate = parseISO(parsed.notebook.noteDate);
    if (isAfter(startOfDay(noteDate), startOfDay(new Date()))) {
      return NextResponse.json(
        { code: "invalid_date", message: "未来日は入力できません" },
        { status: 400 },
      );
    }

    const existingTags = await prisma.tag.findMany({
      where: { name: { in: parsed.notebook.tags.map((t) => t.name) } },
    });
    const existingMap = new Map(existingTags.map((t) => [t.name, t]));

    const createdTags = [];
    for (const tag of parsed.notebook.tags) {
      if (!existingMap.has(tag.name)) {
        const created = await prisma.tag.create({
          data: {
            name: tag.name,
            color: tag.color ?? DEFAULT_TAG_COLOR,
          },
        });
        existingMap.set(tag.name, created);
        createdTags.push(created);
      }
    }

    const notebook = await prisma.$transaction(async (tx) => {
      const nb = await tx.notebook.create({
        data: {
          title: parsed.notebook.title,
          overview: parsed.notebook.overview,
          summary: parsed.notebook.summary,
          noteDate,
          draftState: {
            create: {
              isDraft: parsed.draft.isDraft,
              draftUpdatedAt: new Date(),
              hiddenNotes: parsed.draft.hiddenNotes ?? [],
              version: parsed.draft.version ?? 0,
              autosaveVersion: parsed.draft.autosaveVersion ?? 0,
            },
          },
          review: {
            create: {
              reviewStatus: 0,
              firstReviewAt: addDays(noteDate, 1),
              secondReviewAt: addDays(noteDate, 7),
            },
          },
          cueCards: {
            create: parsed.notebook.cues
              .filter((c) => !c.deleted)
              .map((c) => ({
                marker: c.marker,
                content: c.content,
                order: c.order,
              })),
          },
          noteCards: {
            create: parsed.notebook.notes
              .filter((n) => !n.deleted)
              .map((n) => ({
                content: n.content,
                order: n.order,
                isHidden: n.isHidden,
              })),
          },
        },
        include: {
          cueCards: true,
          noteCards: true,
        },
      });

      // Link tags
      await tx.notebookTag.createMany({
        data: parsed.notebook.tags.map((tag) => ({
          notebookId: nb.id,
          tagId: existingMap.get(tag.name)!.id,
        })),
        skipDuplicates: true,
      });

      // Link notes to cues
      const cueIdMap = new Map<string, string>();
      parsed.notebook.cues.forEach((c, idx) => {
        const created = nb.cueCards[idx];
        if (created) {
          cueIdMap.set(c.id ?? c.marker, created.id);
        }
      });

      const noteIdMap = new Map<string, string>();
      parsed.notebook.notes.forEach((n, idx) => {
        const created = nb.noteCards[idx];
        if (created) {
          noteIdMap.set(n.id ?? `${idx}`, created.id);
        }
      });

      for (const note of parsed.notebook.notes) {
        const createdId = noteIdMap.get(note.id ?? `${note.order}`);
        if (!createdId) continue;
        const links = note.cueIds
          .map((cue) => cueIdMap.get(cue))
          .filter(Boolean) as string[];
        if (links.length > 0) {
          await tx.noteCueLink.createMany({
            data: links.map((cueId, order) => ({
              noteCardId: createdId,
              cueCardId: cueId,
              order,
            })),
          });
        }
      }

      return nb;
    });

    return NextResponse.json({ notebook, createdTags });
  } catch (error: any) {
    console.error(error);
    if (error?.issues) {
      return NextResponse.json(
        { code: "invalid_body", message: "validation error", errors: error.issues },
        { status: 400 },
      );
    }
    return NextResponse.json(
        { code: "server_error", message: "unexpected error" },
        { status: 500 },
    );
  }
}
