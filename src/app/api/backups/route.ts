import { NextResponse } from "next/server";
import { createBackup, listBackups } from "@/lib/backup";
import { apiErrorStatus, createServerError } from "@/lib/validation";

export async function GET() {
  try {
    return NextResponse.json({ backups: listBackups() });
  } catch (error) {
    const body = createServerError(
      error instanceof Error ? error.message : undefined,
    );
    return NextResponse.json(body, { status: apiErrorStatus[body.code] });
  }
}

export async function POST() {
  try {
    const backup = createBackup();
    return NextResponse.json({ ok: true, backup });
  } catch (error) {
    const body = createServerError(
      error instanceof Error ? error.message : undefined,
    );
    return NextResponse.json(body, { status: apiErrorStatus[body.code] });
  }
}
