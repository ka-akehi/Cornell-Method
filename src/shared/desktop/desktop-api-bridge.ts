import { invoke } from "@tauri-apps/api/core";

const DESKTOP_API_COMMAND = "request_desktop_state_changing_api";
const STATE_CHANGING_METHODS = new Set(["POST", "PATCH", "DELETE"]);

type TauriWindow = Window & { __TAURI_INTERNALS__?: unknown };

type DesktopApiResponse = {
  status: number;
  body: string;
};

function hasTauriRuntime() {
  return (
    typeof window !== "undefined" &&
    Boolean((window as TauriWindow).__TAURI_INTERNALS__)
  );
}

function isRelativeApiPath(input: RequestInfo | URL): input is string {
  return typeof input === "string" && input.startsWith("/");
}

export async function requestDesktopStateChangingApi(
  input: RequestInfo | URL,
  init: RequestInit,
): Promise<Response | null> {
  const method = String(init.method ?? "GET").toUpperCase();
  if (!hasTauriRuntime() || !STATE_CHANGING_METHODS.has(method)) {
    return null;
  }
  if (!isRelativeApiPath(input)) {
    return null;
  }

  const url = new URL(input, window.location.href);
  if (
    url.origin !== window.location.origin ||
    (url.pathname !== "/api" && !url.pathname.startsWith("/api/"))
  ) {
    return null;
  }

  const body = init.body;
  if (body !== undefined && body !== null && typeof body !== "string") {
    return null;
  }

  const response = await invoke<DesktopApiResponse>(DESKTOP_API_COMMAND, {
    request: {
      path: `${url.pathname}${url.search}`,
      method,
      headers: Object.fromEntries(new Headers(init.headers).entries()),
      body: body ?? null,
    },
  });
  const responseBody = response.status === 204 ? undefined : response.body;
  return new Response(responseBody, { status: response.status });
}
