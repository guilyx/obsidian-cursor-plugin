import type { ChatBackend } from "./ChatBackend";
import type { SendMessageInput, StreamEvent } from "../types/chat";
import type { CursorChatSettings } from "../settings/CursorSettings";
import { spawn, type ChildProcessWithoutNullStreams } from "child_process";

export type SpawnFn = (
  command: string,
  args: string[],
  options: { cwd: string; env: NodeJS.ProcessEnv; stdio: string[] },
) => ChildProcessWithoutNullStreams;

/**
 * Runs the Cursor Agent CLI (`agent -p`) against the vault directory.
 * Auth: `CURSOR_API_KEY` from settings (crsr_…), or fall back to `agent login` on the machine.
 */
export class CursorAgentCliBackend implements ChatBackend {
  constructor(
    private readonly settings: CursorChatSettings,
    private readonly getVaultPath: () => string | null,
    private readonly spawnFn: SpawnFn = spawn as unknown as SpawnFn,
  ) {}

  async validate(): Promise<void> {
    const vaultPath = this.getVaultPath();
    if (!vaultPath) {
      throw new Error("Cursor Agent requires a local folder vault.");
    }
    await this.runCli(["--version"], vaultPath, 15_000);
  }

  async *send(input: SendMessageInput): AsyncGenerator<StreamEvent> {
    const vaultPath = this.getVaultPath();
    if (!vaultPath) {
      yield { type: "error", message: "Cursor Agent requires a local folder vault." };
      return;
    }

    const prompt = input.contextPrefix
      ? `${input.contextPrefix}\n\n${input.userText}`
      : input.userText;

    const runId = `cli-${Date.now()}`;
    yield { type: "run-started", agentId: "cursor-agent-cli", runId };

    const abort = input.signal;
    let stdout = "";

    try {
      stdout = await this.runCli(["-p", prompt], vaultPath, 300_000, abort);
      if (stdout.trim()) {
        yield { type: "assistant-delta", text: stdout };
        yield { type: "assistant-done", text: stdout };
      } else {
        yield {
          type: "error",
          message:
            "Cursor Agent returned empty output. Set a Cursor API key in settings or run `agent login`.",
        };
      }
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === "AbortError") {
        if (stdout.trim()) {
          yield { type: "assistant-done", text: stdout };
        }
        return;
      }
      yield { type: "error", message: err instanceof Error ? err.message : String(err) };
    }
  }

  private cliEnv(): NodeJS.ProcessEnv {
    const env = { ...process.env };
    const key = this.settings.cursor.apiKey.trim();
    if (key) {
      env.CURSOR_API_KEY = key;
    }
    return env;
  }

  private runCli(
    args: string[],
    cwd: string,
    timeoutMs: number,
    signal?: AbortSignal,
  ): Promise<string> {
    const { cliPath } = this.settings.cursorAgent;
    return new Promise((resolve, reject) => {
      const child = this.spawnFn(cliPath, args, {
        cwd,
        env: this.cliEnv(),
        stdio: ["ignore", "pipe", "pipe"],
      }) as ChildProcessWithoutNullStreams;

      let stdout = "";
      let stderr = "";
      const timer = setTimeout(() => {
        child.kill("SIGTERM");
        reject(new Error(`Cursor Agent timed out after ${timeoutMs / 1000}s`));
      }, timeoutMs);

      const onAbort = (): void => {
        child.kill("SIGTERM");
        reject(new DOMException("Aborted", "AbortError"));
      };
      signal?.addEventListener("abort", onAbort, { once: true });

      child.stdout?.on("data", (chunk: Buffer) => {
        stdout += chunk.toString("utf8");
      });
      child.stderr?.on("data", (chunk: Buffer) => {
        stderr += chunk.toString("utf8");
      });

      child.on("error", (err: Error) => {
        clearTimeout(timer);
        signal?.removeEventListener("abort", onAbort);
        reject(new Error(`Failed to start "${cliPath}": ${err.message}. Install: curl https://cursor.com/install -fsS | bash`));
      });

      child.on("close", (code: number | null) => {
        clearTimeout(timer);
        signal?.removeEventListener("abort", onAbort);
        if (code === 0 || stdout.trim()) {
          resolve(stdout.trim());
          return;
        }
        reject(new Error(stderr.trim() || `Cursor Agent exited with code ${code ?? "unknown"}`));
      });
    });
  }
}
