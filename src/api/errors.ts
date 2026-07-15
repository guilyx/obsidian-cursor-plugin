export class CursorApiError extends Error {
  readonly status: number;

  constructor(status: number, body: string) {
    let message = `Cursor API error (${status})`;
    try {
      const json = JSON.parse(body) as { message?: unknown; error?: unknown };
      const fromMessage = formatApiErrorField(json.message);
      const fromError = formatApiErrorField(json.error);
      if (fromMessage) {
        message = fromMessage;
      } else if (fromError) {
        message = fromError;
      } else if (body) {
        message = `${message}: ${body.slice(0, 200)}`;
      }
    } catch {
      if (body) {
        message = `${message}: ${body.slice(0, 200)}`;
      }
    }
    super(message);
    this.name = "CursorApiError";
    this.status = status;
  }
}

function formatApiErrorField(value: unknown): string | undefined {
  if (typeof value === "string" && value.trim()) {
    return value;
  }
  if (value != null && typeof value === "object") {
    return JSON.stringify(value);
  }
  return undefined;
}
