import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  getBasicAuthDecision,
  UNAUTHORIZED_API_ERROR_BODY,
} from "@/server/auth/basic-auth";

const UNAUTHORIZED_HEADERS = {
  "WWW-Authenticate": 'Basic realm="Cornell Method Notebook", charset="UTF-8"',
  "Cache-Control": "no-store",
  Vary: "Authorization",
};

const AUTHENTICATED_RESPONSE_HEADERS = {
  "Cache-Control": "private, no-store",
  Vary: "Authorization",
};

export function proxy(request: NextRequest) {
  const decision = getBasicAuthDecision({
    pathname: request.nextUrl.pathname,
    authorization: request.headers.get("authorization"),
    environment: process.env,
  });

  if (decision === "public" || decision === "allow") {
    if (decision === "public") {
      return NextResponse.next();
    }

    return NextResponse.next({ headers: AUTHENTICATED_RESPONSE_HEADERS });
  }

  if (decision === "deny-api") {
    return NextResponse.json(UNAUTHORIZED_API_ERROR_BODY, {
      status: 401,
      headers: UNAUTHORIZED_HEADERS,
    });
  }

  return new NextResponse("Unauthorized", {
    status: 401,
    headers: {
      ...UNAUTHORIZED_HEADERS,
      "Content-Type": "text/plain; charset=utf-8",
    },
  });
}

export const config = {
  // Keep the proxy at the application boundary so every API route is covered,
  // including future API paths that happen to contain a file extension.
  matcher: ["/:path*"],
};
