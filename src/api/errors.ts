export class CursorApiError extends Error {
  constructor(
    readonly status: number,
    body: string,
  ) {
    let message = `Cursor API error (${status})`;
    try {
      const json = JSON.parse(body) as { message?: string; error?: string };
      if (json.message) message = json.message;
      else if (json.error) message = json.error;
      else if (body) message = `${message}: ${body.slice(0, 200)}`;
    } catch {
      if (body) message = `${message}: ${body.slice(0, 200)}`;
    }
    super(message);
    this.name = "CursorApiError";
  }
}
