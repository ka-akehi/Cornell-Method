import { NextResponse } from "next/server";
import { createNote, listNotes } from "@/server/notes/application";
import {
  createInvalidBodyError,
  createInvalidQueryError,
  createServerError,
  apiErrorResponse,
} from "@/shared/http";
import {
  notebookInputSchema,
  notesQuerySchema,
} from "@/modules/notes/contracts";

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

    return NextResponse.json(await listNotes(parsed.data));
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

    return NextResponse.json(await createNote(parsed.data), { status: 201 });
  } catch (error) {
    console.error(error);
    return apiErrorResponse(createServerError());
  }
}
