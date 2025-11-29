import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type");

  const where =
    type === "day"
      ? {
          reviewStatus: 0,
          firstReviewAt: { lte: new Date() },
        }
      : {
          reviewStatus: 1,
          secondReviewAt: { lte: new Date() },
        };

  const data = await prisma.notebookReviewProgress.findMany({
    where,
    include: {
      notebook: {
        include: {
          tags: { include: { tag: true } },
        },
      },
    },
  });

  return NextResponse.json(data);
}

export async function PATCH(request: Request) {
  const body = await request.json();
  const { notebookId, status } = body as {
    notebookId: string;
    status: number;
  };

  if (!notebookId || status === undefined) {
    return NextResponse.json(
      { code: "invalid_body", message: "notebookId and status required" },
      { status: 400 },
    );
  }

  const data =
    status === 1
      ? {
          reviewStatus: 1,
          firstReviewCompletedAt: new Date(),
        }
      : {
          reviewStatus: 2,
          secondReviewCompletedAt: new Date(),
        };

  const updated = await prisma.notebookReviewProgress.update({
    where: { notebookId },
    data,
  });

  return NextResponse.json(updated);
}
