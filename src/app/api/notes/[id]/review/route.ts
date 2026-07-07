import { NextResponse } from "next/server";
import { reviewNote } from "@/server/notes/application";
import {
  createInvalidBodyError,
  createNotFoundError,
  createServerError,
  apiErrorResponse,
} from "@/shared/http";
import {
  reviewUpdateSchema,
} from "@/modules/notes/contracts";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const json = await request.json().catch(() => null);
    const parsed = reviewUpdateSchema.safeParse(json);

    if (!parsed.success) {
      return apiErrorResponse(createInvalidBodyError(parsed.error));
    }

    const result = await reviewNote(id, parsed.data);

    if (!result) {
      return apiErrorResponse(createNotFoundError("ノートが見つかりません"));
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error(error);
    return apiErrorResponse(createServerError());
  }
}
