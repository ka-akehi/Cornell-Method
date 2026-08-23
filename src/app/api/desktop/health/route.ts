import { NextResponse } from "next/server";

const HEALTH_KIND = "cornell-desktop-health";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export function GET() {
  const nonce = process.env.CORNELL_DESKTOP_READY_NONCE;
  if (!nonce) {
    return NextResponse.json(
      { kind: HEALTH_KIND, status: "unavailable" },
      { status: 503, headers: { "cache-control": "no-store" } },
    );
  }

  return NextResponse.json(
    { kind: HEALTH_KIND, status: "ready", nonce },
    { headers: { "cache-control": "no-store" } },
  );
}
