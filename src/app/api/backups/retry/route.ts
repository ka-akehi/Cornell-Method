import { NextResponse } from "next/server";
import { exec } from "child_process";
import path from "path";

export async function POST() {
  const script = path.join(process.cwd(), "scripts", "backup-copy.js");
  return new Promise((resolve) => {
    exec(`node ${script}`, (error, stdout, stderr) => {
      if (error) {
        console.error(stderr);
        resolve(
          NextResponse.json(
            { code: "backup_failed", message: stderr || error.message },
            { status: 500 },
          ),
        );
      } else {
        resolve(NextResponse.json({ ok: true, log: stdout }));
      }
    });
  });
}
