import { NextResponse } from "next/server";
import { prisma } from "@/server/infrastructure/prisma";
import { apiErrorResponse, createServerError } from "@/shared/http";

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
