import type {
  ApiErrorBody,
  ApiFieldError,
} from "@/shared/http";

export class NotesRemoteError extends Error {
  readonly status: number;
  readonly body: ApiErrorBody | null;

  constructor(
    message: string,
    options: { status: number; body?: ApiErrorBody | null },
  ) {
    super(message);
    this.name = "NotesRemoteError";
    this.status = options.status;
    this.body = options.body ?? null;
  }

  get fieldErrors(): ApiFieldError[] {
    return this.body?.errors ?? [];
  }
}
