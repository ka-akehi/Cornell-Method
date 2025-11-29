import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type EntityType = "notebook" | "cue" | "note";

export async function POST(request: Request) {
  const body = await request.json();
  const { entityType, entityId } = body as {
    entityType: EntityType;
    entityId: string;
  };

  if (!entityType || !entityId) {
    return NextResponse.json(
      { code: "invalid_body", message: "entityType and entityId are required" },
      { status: 400 },
    );
  }

  const buffer = await prisma.softDeleteBuffer.findFirst({
    where: { entityType, entityId },
  });

  if (!buffer) {
    return NextResponse.json(
      { code: "gone", message: "not found in buffer" },
      { status: 410 },
    );
  }

  if (buffer.undoExpiresAt < new Date()) {
    return NextResponse.json(
      { code: "gone", message: "undo expired" },
      { status: 410 },
    );
  }

  await prisma.$transaction(async (tx) => {
    if (entityType === "notebook") {
      await tx.notebook.update({
        where: { id: entityId },
        data: { deletedAt: null },
      });
    } else if (entityType === "cue") {
      await tx.cueCard.update({
        where: { id: entityId },
        data: { deletedAt: null },
      });
    } else if (entityType === "note") {
      await tx.noteCard.update({
        where: { id: entityId },
        data: { deletedAt: null },
      });
    }

    await tx.softDeleteBuffer.delete({ where: { id: buffer.id } });
  });

  return NextResponse.json({ ok: true });
}
