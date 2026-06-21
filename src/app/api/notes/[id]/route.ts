import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  apiErrorStatus,
  createInvalidBodyError,
  createNotFoundError,
  createServerError,
  type NotebookInput,
  notebookInputSchema,
} from "@/lib/validation";

type RouteContext = {
  params: Promise<{ id: string }>;
};

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

function apiErrorResponse(
  body: ReturnType<typeof createServerError>,
  status = apiErrorStatus[body.code],
) {
  return NextResponse.json(body, { status });
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
    tags: notebook.tags
      .map(({ tag }) => ({
        id: tag.id,
        name: tag.name,
        color: tag.color,
      }))
      .sort((a, b) => a.name.localeCompare(b.name)),
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

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const notebook = await getNotebookDetail(id);

    if (!notebook) {
      return apiErrorResponse(createNotFoundError("ノートが見つかりません"));
    }

    return NextResponse.json(formatDetail(notebook));
  } catch (error) {
    console.error(error);
    return apiErrorResponse(createServerError());
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const json = await request.json().catch(() => null);
    const parsed = notebookInputSchema.safeParse(json);

    if (!parsed.success) {
      return apiErrorResponse(createInvalidBodyError(parsed.error));
    }

    const existing = await prisma.notebook.findFirst({
      where: {
        id,
        deletedAt: null,
      },
      select: { id: true },
    });

    if (!existing) {
      return apiErrorResponse(createNotFoundError("ノートが見つかりません"));
    }

    const input = parsed.data;
    await prisma.$transaction(async (tx) => {
      await tx.notebook.update({
        where: { id },
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
        },
      });

      await tx.cue.deleteMany({ where: { notebookId: id } });
      if (input.cues.length > 0) {
        await tx.cue.createMany({
          data: input.cues.map((cue, index) => ({
            notebookId: id,
            text: cue.text,
            order: cue.order ?? index,
          })),
        });
      }

      await tx.notebookTag.deleteMany({ where: { notebookId: id } });
      await createTagsAndLinks(tx, id, input.tags);
    });

    const notebook = await getNotebookDetail(id);
    return NextResponse.json(formatDetail(notebook!));
  } catch (error) {
    console.error(error);
    return apiErrorResponse(createServerError());
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const existing = await prisma.notebook.findFirst({
      where: {
        id,
        deletedAt: null,
      },
      select: { id: true },
    });

    if (!existing) {
      return apiErrorResponse(createNotFoundError("ノートが見つかりません"));
    }

    await prisma.notebook.delete({
      where: { id },
    });

    return new Response(null, { status: 204 });
  } catch (error) {
    console.error(error);
    return apiErrorResponse(createServerError());
  }
}
