import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  apiErrorStatus,
  createInvalidBodyError,
  createInvalidQueryError,
  createServerError,
  type NotebookInput,
  notebookInputSchema,
  notesQuerySchema,
} from "@/lib/validation";

const PAGE_SIZE = 50;

type NotebookWithListRelations = Prisma.NotebookGetPayload<{
  include: {
    _count: { select: { cues: true } };
    tags: { include: { tag: true } };
  };
}>;

type NotebookWithDetailRelations = Prisma.NotebookGetPayload<{
  include: {
    cues: true;
    tags: { include: { tag: true } };
  };
}>;

function dateOnlyString(date: Date | null) {
  return date ? date.toISOString().slice(0, 10) : null;
}

function dateTimeString(date: Date | null) {
  return date ? date.toISOString() : null;
}

function dateFromDateOnly(value: string) {
  return new Date(`${value}T00:00:00.000Z`);
}

function todayDate() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return dateFromDateOnly(`${year}-${month}-${day}`);
}

function apiErrorResponse(
  body: ReturnType<typeof createServerError>,
  status = apiErrorStatus[body.code],
) {
  return NextResponse.json(body, { status });
}

function formatTags(tags: NotebookWithDetailRelations["tags"]) {
  return tags
    .map(({ tag }) => ({
      id: tag.id,
      name: tag.name,
      color: tag.color,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

function formatListItem(notebook: NotebookWithListRelations) {
  return {
    id: notebook.id,
    title: notebook.title,
    noteDate: dateOnlyString(notebook.noteDate),
    sourceType: notebook.sourceType,
    sourceTitle: notebook.sourceTitle,
    overview: notebook.overview,
    summary: notebook.summary,
    cueCount: notebook._count.cues,
    hasSummary: notebook.summary.trim().length > 0,
    nextReviewDate: dateOnlyString(notebook.nextReviewDate),
    reviewedAt: dateTimeString(notebook.reviewedAt),
    tags: formatTags(notebook.tags),
  };
}

function formatDetail(notebook: NotebookWithDetailRelations) {
  return {
    id: notebook.id,
    title: notebook.title,
    noteDate: dateOnlyString(notebook.noteDate),
    sourceType: notebook.sourceType,
    sourceTitle: notebook.sourceTitle,
    overview: notebook.overview,
    body: notebook.body,
    summary: notebook.summary,
    nextReviewDate: dateOnlyString(notebook.nextReviewDate),
    reviewedAt: dateTimeString(notebook.reviewedAt),
    cues: notebook.cues
      .map((cue) => ({
        id: cue.id,
        text: cue.text,
        order: cue.order,
      }))
      .sort((a, b) => a.order - b.order),
    tags: formatTags(notebook.tags),
  };
}

async function createTagsAndLinks(
  tx: Prisma.TransactionClient,
  notebookId: string,
  tags: NotebookInput["tags"],
) {
  for (const tagInput of tags) {
    const tag = await tx.tag.upsert({
      where: { name: tagInput.name },
      update: {},
      create: {
        name: tagInput.name,
        color: tagInput.color ?? null,
      },
    });

    await tx.notebookTag.create({
      data: {
        notebookId,
        tagId: tag.id,
      },
    });
  }
}

async function getNotebookDetail(id: string) {
  return prisma.notebook.findFirst({
    where: {
      id,
      deletedAt: null,
    },
    include: {
      cues: { orderBy: { order: "asc" } },
      tags: { include: { tag: true } },
    },
  });
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const parsed = notesQuerySchema.safeParse({
      query: searchParams.get("query") ?? undefined,
      tag: searchParams.get("tag") ?? undefined,
      from: searchParams.get("from") ?? undefined,
      to: searchParams.get("to") ?? undefined,
      reviewDue: searchParams.get("reviewDue") ?? undefined,
      page: searchParams.get("page") ?? undefined,
    });

    if (!parsed.success) {
      return apiErrorResponse(createInvalidQueryError(parsed.error));
    }

    const input = parsed.data;
    const where: Prisma.NotebookWhereInput = {
      deletedAt: null,
    };

    if (input.query) {
      where.OR = [
        { title: { contains: input.query } },
        { overview: { contains: input.query } },
        { body: { contains: input.query } },
        { summary: { contains: input.query } },
        { cues: { some: { text: { contains: input.query } } } },
      ];
    }

    if (input.from || input.to) {
      where.noteDate = {
        ...(input.from ? { gte: dateFromDateOnly(input.from) } : {}),
        ...(input.to ? { lte: dateFromDateOnly(input.to) } : {}),
      };
    }

    if (input.tag.length > 0) {
      where.tags = {
        some: {
          tag: {
            name: { in: input.tag },
          },
        },
      };
    }

    if (input.reviewDue) {
      where.nextReviewDate = {
        lte: todayDate(),
      };
    }

    const totalCount = await prisma.notebook.count({ where });
    const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
    const notes = await prisma.notebook.findMany({
      where,
      orderBy: [{ noteDate: "desc" }, { updatedAt: "desc" }],
      skip: (input.page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        _count: { select: { cues: true } },
        tags: { include: { tag: true } },
      },
    });

    return NextResponse.json({
      page: input.page,
      totalPages,
      totalCount,
      data: notes.map(formatListItem),
    });
  } catch (error) {
    console.error(error);
    return apiErrorResponse(createServerError());
  }
}

export async function POST(request: Request) {
  try {
    const json = await request.json().catch(() => null);
    const parsed = notebookInputSchema.safeParse(json);

    if (!parsed.success) {
      return apiErrorResponse(createInvalidBodyError(parsed.error));
    }

    const input = parsed.data;
    const notebookId = await prisma.$transaction(async (tx) => {
      const notebook = await tx.notebook.create({
        data: {
          title: input.title,
          noteDate: dateFromDateOnly(input.noteDate),
          sourceType: input.sourceType ?? null,
          sourceTitle: input.sourceTitle,
          overview: input.overview,
          body: input.body,
          summary: input.summary,
          nextReviewDate: input.nextReviewDate
            ? dateFromDateOnly(input.nextReviewDate)
            : null,
          ...(input.cues.length > 0
            ? {
                cues: {
                  create: input.cues.map((cue, index) => ({
                    text: cue.text,
                    order: cue.order ?? index,
                  })),
                },
              }
            : {}),
        },
      });

      await createTagsAndLinks(tx, notebook.id, input.tags);
      return notebook.id;
    });

    const notebook = await getNotebookDetail(notebookId);
    return NextResponse.json(formatDetail(notebook!), { status: 201 });
  } catch (error) {
    console.error(error);
    return apiErrorResponse(createServerError());
  }
}
