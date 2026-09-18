import { NextResponse } from "next/server";
import {
  deleteNote,
  getNoteDetail,
  NoteDateImmutableError,
  updateNote,
} from "@/server/notes/application";
import {
  createApiError,
  createInvalidBodyError,
  createNotFoundError,
  createServerError,
  apiErrorResponse,
} from "@/shared/http";
import { notebookInputSchema } from "@/modules/notes/contracts";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const notebook = await getNoteDetail(id);

    if (!notebook) {
      return apiErrorResponse(createNotFoundError("ノートが見つかりません"));
    }

    return NextResponse.json(notebook);
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

    const notebook = await updateNote(id, parsed.data);

    if (!notebook) {
      return apiErrorResponse(createNotFoundError("ノートが見つかりません"));
    }

    return NextResponse.json(notebook);
  } catch (error) {
    if (error instanceof NoteDateImmutableError) {
      return apiErrorResponse(
        createApiError("invalid_body", {
          errors: [{ field: "noteDate", message: error.message }],
        }),
      );
    }

    console.error(error);
    return apiErrorResponse(createServerError());
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    if (!(await deleteNote(id))) {
      return apiErrorResponse(createNotFoundError("ノートが見つかりません"));
    }

    return new Response(null, { status: 204 });
  } catch (error) {
    console.error(error);
    return apiErrorResponse(createServerError());
  }
}
