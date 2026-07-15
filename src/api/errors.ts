/** Extract a human-readable message from Cursor API error JSON fields. */
export function formatApiErrorField(value: unknown): string | undefined {
  if (typeof value === "string" && value.trim()) {
    return value.trim();
  }
  if (value != null && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const nested = typeof obj.message === "string" ? obj.message.trim() : undefined;
    const code = typeof obj.code === "string" ? obj.code : undefined;
    if (nested) {
      return code ? `${code}: ${nested}` : nested;
    }
    return JSON.stringify(value);
  }
  return undefined;
}

export class CursorApiError extends Error {
  readonly status: number;
  readonly code?: string;

  constructor(status: number, body: string) {
    let message = `Cursor API error (${status})`;
    let code: string | undefined;
    try {
      const json = JSON.parse(body) as { message?: unknown; error?: unknown; code?: string };
      code = typeof json.code === "string" ? json.code : undefined;
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
    this.code = code;
  }
}

export function isCursorBillingLimitError(err: unknown): boolean {
  if (!(err instanceof CursorApiError)) {
    return false;
  }
  if (err.code === "usage_limit_exceeded") {
    return true;
  }
  return err.message.includes("usage_limit_exceeded") || err.message.includes("Usage-based pricing");
}
