import { NextResponse } from "next/server";
import { chromium } from "playwright";
import { prisma } from "@/lib/prisma";
import { format, parseISO } from "date-fns";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  if (!from || !to) {
    return NextResponse.json(
      { code: "invalid_range", message: "from/to are required" },
      { status: 400 },
    );
  }

  const fromDate = parseISO(from);
  const toDate = parseISO(to);

  const notebooks = await prisma.notebook.findMany({
    where: {
      deletedAt: null,
      noteDate: { gte: fromDate, lte: toDate },
    },
    orderBy: { noteDate: "asc" },
    include: {
      cueCards: { where: { deletedAt: null }, orderBy: { order: "asc" } },
      noteCards: {
        where: { deletedAt: null },
        orderBy: { order: "asc" },
        include: { links: true },
      },
      tags: { include: { tag: true } },
    },
  });

  const html = renderHtml(notebooks);

  const browser = await chromium.launch({
    headless: true,
  });
  const page = await browser.newPage({ viewport: { width: 1200, height: 1800 } });
  await page.setContent(html, { waitUntil: "networkidle" });
  const pdfBuffer = await page.pdf({
    format: "A4",
    margin: { top: "0.5in", right: "0.5in", bottom: "0.5in", left: "0.5in" },
  });
  await browser.close();

  const filename = `学習記録-${format(fromDate, "yyyyMMdd")}-${format(toDate, "yyyyMMdd")}.pdf`;

  return new NextResponse(pdfBuffer, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${encodeURIComponent(filename)}"`,
    },
  });
}

function renderHtml(notebooks: any[]) {
  const sections = notebooks
    .map((n) => {
      const cues = n.cueCards
        .map(
          (c: any) => `<li class="cue">
            <span class="cue-marker">${c.marker}</span>
            <div class="cue-text">${escapeHtml(c.content)}</div>
          </li>`,
        )
        .join("");

      const notes = n.noteCards
        .map(
          (note: any) => `<li class="note-card">
            <div class="note-content">${escapeHtml(note.content)}</div>
          </li>`,
        )
        .join("");

      const tags = n.tags
        .map(
          (t: any) =>
            `<span class="tag" style="background:${t.tag.color ?? "#f59e0b"}">${escapeHtml(t.tag.name)}</span>`,
        )
        .join("");

      const dateLabel = format(n.noteDate, "yyyy/MM/dd");

      return `<section class="page">
        <header class="page-head">
          <div>
            <p class="eyebrow">Cornell Note</p>
            <h1>${escapeHtml(n.title)}</h1>
            <p class="muted">${escapeHtml(n.overview ?? "")}</p>
          </div>
          <div class="meta">
            <div><span class="meta-label">日付</span><span>${dateLabel}</span></div>
            <div><span class="meta-label">タグ</span><span>${tags}</span></div>
          </div>
        </header>
        <div class="grid">
          <div class="cue-col">
            <h2>キーワード / 質問</h2>
            <ul>${cues}</ul>
          </div>
          <div class="note-col">
            <h2>ノート</h2>
            <ul>${notes}</ul>
          </div>
        </div>
        <div class="summary">
          <h2>サマリー & 次アクション</h2>
          <p>${escapeHtml(n.summary ?? "")}</p>
        </div>
        <footer class="footer">日付: ${dateLabel}</footer>
      </section>`;
    })
    .join("<div class='page-break'></div>");

  return `<!doctype html>
    <html>
      <head>
        <meta charset="utf-8" />
        <style>
          * { box-sizing: border-box; }
          body { font-family: system-ui, -apple-system, sans-serif; color: #1f2937; margin: 0; padding: 0; }
          .page { page-break-after: always; padding: 24px; }
          .page-head { display: flex; justify-content: space-between; gap: 16px; border-bottom: 1px dashed #e5e7eb; padding-bottom: 12px; }
          .eyebrow { text-transform: uppercase; letter-spacing: 0.2em; color: #9ca3af; font-size: 12px; margin: 0; }
          h1 { margin: 4px 0; font-size: 24px; }
          .muted { color: #6b7280; margin: 0; white-space: pre-wrap; }
          .meta { display: grid; gap: 4px; font-size: 14px; color: #374151; min-width: 180px; }
          .meta-label { color: #9ca3af; margin-right: 6px; }
          .grid { display: grid; grid-template-columns: 0.3fr 0.7fr; gap: 16px; margin-top: 12px; }
          .cue-col, .note-col { border: 1px solid #e5e7eb; border-radius: 12px; padding: 12px; background: #f9fafb; }
          .cue-col h2, .note-col h2, .summary h2 { margin: 0 0 8px; font-size: 14px; color: #6b7280; }
          .cue { list-style: none; border-left: 4px solid #d6d3d1; padding: 6px 8px; margin-bottom: 8px; background: #fff; border-radius: 8px; }
          .cue-marker { font-size: 12px; color: #9ca3af; display: block; }
          .cue-text { font-size: 14px; white-space: pre-wrap; }
          .note-card { list-style: none; background: #fff; border: 1px solid #e5e7eb; border-radius: 10px; padding: 8px; margin-bottom: 8px; }
          .note-content { font-size: 14px; white-space: pre-wrap; }
          .summary { margin-top: 12px; border: 1px solid #fcd34d; background: #fffbeb; padding: 12px; border-radius: 12px; }
          .summary p { margin: 0; white-space: pre-wrap; }
          .tag { display: inline-block; color: #1f2937; padding: 2px 8px; border-radius: 9999px; font-size: 12px; margin-right: 4px; }
          .footer { margin-top: 8px; text-align: right; color: #9ca3af; font-size: 12px; }
          .page-break { page-break-after: always; }
        </style>
      </head>
      <body>${sections}</body>
    </html>`;
}

function escapeHtml(str: string) {
  return (str ?? "").replace(/[&<>"']/g, (c) => {
    switch (c) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '"':
        return "&quot;";
      case "'":
        return "&#39;";
      default:
        return c;
    }
  });
}
