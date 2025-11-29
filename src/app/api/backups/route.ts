import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export async function GET() {
  const backupDir = path.join(process.cwd(), "backup");
  if (!fs.existsSync(backupDir)) {
    return NextResponse.json({ backups: [] });
  }
  const backups = fs
    .readdirSync(backupDir)
    .filter((f) => f.endsWith(".db"))
    .sort()
    .reverse()
    .slice(0, 3)
    .map((file) => ({
      file,
      path: path.join("backup", file),
    }));

  return NextResponse.json({ backups });
}
