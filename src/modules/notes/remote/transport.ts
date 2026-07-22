import { decodeApiErrorResponse } from "@/shared/http/client";
import { NotesRemoteError } from "./error";

export function jsonHeaders() {
  return { "Content-Type": "application/json" };
}

export async function parseJson<T>(response: Response): Promise<T | null> {
  if (response.status === 204) return null;
  return (await response.json().catch(() => null)) as T | null;
}

export async function requestJson<T>(
  input: RequestInfo | URL,
  init: RequestInit,
  fallbackMessage: string,
): Promise<T> {
  const response = await fetch(input, init);

  if (!response.ok) {
    const body = await decodeApiErrorResponse(response);
    throw new NotesRemoteError(body?.message ?? fallbackMessage, {
      status: response.status,
      body,
    });
  }

  return (await parseJson<T>(response)) as T;
}

export function notesApiBase(baseUrl?: string) {
  if (!baseUrl) return "/api";
  const normalizedBase = baseUrl.startsWith("http") ? baseUrl : `https://${baseUrl}`;
  return `${normalizedBase.replace(/\/$/, "")}/api`;
}
