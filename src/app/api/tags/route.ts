import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { tagSchema } from "@/lib/validation";

export async function GET() {
  const tags = await prisma.tag.findMany({
    orderBy: { name: "asc" },
  });
  return NextResponse.json(tags);
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = tagSchema.parse(body);
    const created = await prisma.tag.upsert({
      where: { name: parsed.name },
      update: { color: parsed.color },
      create: { name: parsed.name, color: parsed.color },
    });
    return NextResponse.json(created);
  } catch (error: any) {
    if (error?.issues) {
      return NextResponse.json(
        { code: "invalid_body", message: "validation error", errors: error.issues },
        { status: 400 },
      );
    }
    return NextResponse.json(
      { code: "server_error", message: "unexpected error" },
      { status: 500 },
    );
  }
}
