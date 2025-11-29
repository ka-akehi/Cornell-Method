import { NextResponse } from "next/server";
import { addDays, isAfter, parseISO, startOfDay } from "date-fns";
import { prisma } from "@/lib/prisma";
import { NotebookInput, notebookInputSchema } from "@/lib/validation";

function versionMismatchResponse(field: string) {
  return NextResponse.json(
    {
      code: "conflict",
      message: "outdated version",
      errors: [{ field, message: "outdated" }],
    },
    { status: 409 },
  );
}

export async function GET(
  _request: Request,
  { params }: { params: { id: string } },
) {
  const notebook = await prisma.notebook.findUnique({
    where: { id: params.id },
    include: {
      draftState: true,
      review: true,
      tags: { include: { tag: true } },
      cueCards: { where: { deletedAt: null }, orderBy: { order: "asc" } },
      noteCards: { where: { deletedAt: null }, orderBy: { order: "asc" }, include: { links: true } },
    },
  });

  if (!notebook) {
    return NextResponse.json(
      { code: "not_found", message: "notebook not found" },
      { status: 404 },
    );
  }

  return NextResponse.json(notebook);
}

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } },
) {
  try {
    const json = await request.json();
    const parsed = notebookInputSchema.parse(json) as NotebookInput;

    const existing = await prisma.notebook.findUnique({
      where: { id: params.id },
      include: { draftState: true, cueCards: true, noteCards: true },
    });

    if (!existing || !existing.draftState) {
      return NextResponse.json(
        { code: "not_found", message: "notebook not found" },
        { status: 404 },
      );
    }

    // Optimistic locking
    if (parsed.draftOnly) {
      if (parsed.draft.autosaveVersion !== existing.draftState.autosaveVersion) {
        return versionMismatchResponse("draft.autosave_version");
      }
    } else {
      if (parsed.draft.version !== existing.draftState.version) {
        return versionMismatchResponse("draft.version");
      }
    }

    const noteDate = parseISO(parsed.notebook.noteDate);
    if (isAfter(startOfDay(noteDate), startOfDay(new Date()))) {
      return NextResponse.json(
        { code: "invalid_date", message: "未来日は入力できません" },
        { status: 400 },
      );
    }

    const updated = await prisma.$transaction(async (tx) => {
      // Update core notebook if not draft-only
      if (!parsed.draftOnly) {
        await tx.notebook.update({
          where: { id: params.id },
          data: {
            title: parsed.notebook.title,
            overview: parsed.notebook.overview,
            summary: parsed.notebook.summary,
            noteDate,
          },
        });
      }

      // Draft state update
      await tx.notebookDraftState.update({
        where: { notebookId: params.id },
        data: parsed.draftOnly
          ? {
              isDraft: true,
              draftUpdatedAt: new Date(),
              hiddenNotes: parsed.draft.hiddenNotes ?? [],
              autosaveVersion: { increment: 1 },
            }
          : {
              isDraft: parsed.draft.isDraft ?? false,
              draftUpdatedAt: new Date(),
              hiddenNotes: parsed.draft.hiddenNotes ?? [],
              version: { increment: 1 },
              autosaveVersion: 0,
            },
      });

      // Review progress: update review times if noteDate changed
      await tx.notebookReviewProgress.update({
        where: { notebookId: params.id },
        data: {
          firstReviewAt: addDays(noteDate, 1),
          secondReviewAt: addDays(noteDate, 7),
        },
      });

      // Tags: ensure upsert and connect
      const desiredTags = parsed.notebook.tags;
      const existingTags = await tx.tag.findMany({
        where: { name: { in: desiredTags.map((t) => t.name) } },
      });
      const tagMap = new Map(existingTags.map((t) => [t.name, t.id]));
      for (const tag of desiredTags) {
        if (!tagMap.has(tag.name)) {
          const created = await tx.tag.create({
            data: { name: tag.name, color: tag.color ?? "#f59e0b" },
          });
          tagMap.set(tag.name, created.id);
        }
      }
      await tx.notebookTag.deleteMany({ where: { notebookId: params.id } });
      await tx.notebookTag.createMany({
        data: desiredTags.map((t) => ({
          notebookId: params.id,
          tagId: tagMap.get(t.name)!,
        })),
      });

      // Cue cards: upsert and soft-delete missing
      const keptCueIds = new Set<string>();
      for (const cue of parsed.notebook.cues) {
        if (cue.id) {
          const updatedCue = await tx.cueCard.upsert({
            where: { id: cue.id },
            update: {
              marker: cue.marker,
              content: cue.content,
              order: cue.order,
              deletedAt: cue.deleted ? new Date() : null,
            },
            create: {
              notebookId: params.id,
              marker: cue.marker,
              content: cue.content,
              order: cue.order,
              deletedAt: cue.deleted ? new Date() : null,
            },
          });
          keptCueIds.add(updatedCue.id);
        } else if (!cue.deleted) {
          const created = await tx.cueCard.create({
            data: {
              notebookId: params.id,
              marker: cue.marker,
              content: cue.content,
              order: cue.order,
            },
          });
          keptCueIds.add(created.id);
        }
      }

      // Note cards: upsert and soft-delete missing
      const keptNoteIds = new Map<string, string>();
      for (const note of parsed.notebook.notes) {
        if (note.id) {
          const updatedNote = await tx.noteCard.upsert({
            where: { id: note.id },
            update: {
              content: note.content,
              order: note.order,
              isHidden: note.isHidden,
              deletedAt: note.deleted ? new Date() : null,
            },
            create: {
              notebookId: params.id,
              content: note.content,
              order: note.order,
              isHidden: note.isHidden,
              deletedAt: note.deleted ? new Date() : null,
            },
          });
          keptNoteIds.set(note.id, updatedNote.id);
        } else if (!note.deleted) {
          const created = await tx.noteCard.create({
            data: {
              notebookId: params.id,
              content: note.content,
              order: note.order,
              isHidden: note.isHidden,
            },
          });
          keptNoteIds.set(`new-${note.order}`, created.id);
        }
      }

      // Refresh links
      await tx.noteCueLink.deleteMany({
        where: { noteCard: { notebookId: params.id } },
      });
      const cueLookup = await tx.cueCard.findMany({
        where: { notebookId: params.id, deletedAt: null },
      });
      const cueMap = new Map(cueLookup.map((c) => [c.id, c.id]));

      for (const note of parsed.notebook.notes) {
        const noteKey = note.id ?? `new-${note.order}`;
        const noteId = keptNoteIds.get(noteKey);
        if (!noteId || note.deleted) continue;
        const cues = note.cueIds
          .map((cid) => cueMap.get(cid))
          .filter(Boolean) as string[];
        if (cues.length === 0) continue;
        await tx.noteCueLink.createMany({
          data: cues.map((cueId, order) => ({
            noteCardId: noteId,
            cueCardId: cueId,
            order,
          })),
        });
      }

      return tx.notebook.findUniqueOrThrow({
        where: { id: params.id },
        include: {
          draftState: true,
          review: true,
          tags: { include: { tag: true } },
          cueCards: { where: { deletedAt: null }, orderBy: { order: "asc" } },
          noteCards: {
            where: { deletedAt: null },
            orderBy: { order: "asc" },
            include: { links: true },
          },
        },
      });
    });

    return NextResponse.json(updated);
  } catch (error: any) {
    console.error(error);
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

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } },
) {
  const notebook = await prisma.notebook.findUnique({
    where: { id: params.id },
  });
  if (!notebook) {
    return NextResponse.json(
      { code: "not_found", message: "notebook not found" },
      { status: 404 },
    );
  }

  const now = new Date();

  await prisma.$transaction(async (tx) => {
    await tx.notebook.update({
      where: { id: params.id },
      data: { deletedAt: now },
    });
    await tx.softDeleteBuffer.create({
      data: {
        entityType: "notebook",
        entityId: params.id,
        undoExpiresAt: new Date(now.getTime() + 5_000),
      },
    });
  });

  return NextResponse.json({ ok: true });
}
