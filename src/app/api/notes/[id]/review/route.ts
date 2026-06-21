import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  apiErrorStatus,
  createInvalidBodyError,
  createNotFoundError,
  createServerError,
  reviewUpdateSchema,
} from "@/lib/validation";

type RouteContext = {
  params: Promise<{ id: string }>;
};

function dateOnlyString(date: Date | null) {
  return date ? date.toISOString().slice(0, 10) : null;
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

export async function POST(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const json = await request.json().catch(() => null);
    const parsed = reviewUpdateSchema.safeParse(json);

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

    const reviewedAt = new Date();
    const notebook = await prisma.notebook.update({
      where: { id },
      data: {
        reviewedAt,
        nextReviewDate: parsed.data.nextReviewDate
          ? dateFromDateOnly(parsed.data.nextReviewDate)
          : null,
      },
      select: {
        id: true,
        reviewedAt: true,
        nextReviewDate: true,
      },
    });

    return NextResponse.json({
      id: notebook.id,
      reviewedAt: notebook.reviewedAt?.toISOString() ?? reviewedAt.toISOString(),
      nextReviewDate: dateOnlyString(notebook.nextReviewDate),
    });
  } catch (error) {
    console.error(error);
    return apiErrorResponse(createServerError());
  }
}
