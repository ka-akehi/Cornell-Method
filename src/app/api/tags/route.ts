import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiErrorStatus, createServerError } from "@/lib/validation";

function apiErrorResponse(body: ReturnType<typeof createServerError>) {
  return NextResponse.json(body, { status: apiErrorStatus[body.code] });
}

export async function GET() {
  try {
    const tags = await prisma.tag.findMany({
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        color: true,
      },
    });
    return NextResponse.json(tags);
  } catch (error) {
    console.error(error);
    return apiErrorResponse(createServerError());
  }
}
