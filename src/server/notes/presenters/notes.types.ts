import { Prisma } from "@prisma/client";

export type NotebookWithListRelations = Prisma.NotebookGetPayload<{
  include: {
    _count: { select: { cues: true } };
    tags: { include: { tag: true } };
    canvas: { select: { notebookId: true } };
  };
}>;

export type NotebookWithDetailRelations = Prisma.NotebookGetPayload<{
  include: {
    cues: true;
    tags: { include: { tag: true } };
    canvas: true;
  };
}>;

export type NotebookReviewUpdateRecord = Prisma.NotebookGetPayload<{
  select: {
    id: true;
    reviewedAt: true;
    nextReviewDate: true;
  };
}>;
