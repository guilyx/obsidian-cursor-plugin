import { EventEmitter } from "node:events";

export interface MockChild extends EventEmitter {
  stdout: EventEmitter;
  stderr: EventEmitter;
  kill: (signal?: string) => void;
}

export interface SpawnCall {
  command: string;
  args: string[];
  cwd: string;
}

/** ponytail: minimal fake child_process for CLI backend tests. */
export function createMockSpawn(
  onSpawn: (call: SpawnCall, child: MockChild) => void,
): typeof import("node:child_process").spawn {
  return ((command: string, args: string[], options: { cwd: string }) => {
    const child = new EventEmitter() as MockChild;
    const stdout = new EventEmitter();
    const stderr = new EventEmitter();
    child.stdout = stdout;
    child.stderr = stderr;
    child.kill = () => {
      child.emit("close", 0);
    };
    onSpawn({ command, args, cwd: options.cwd }, child);
    return child as unknown as ReturnType<typeof import("node:child_process").spawn>;
  }) as typeof import("node:child_process").spawn;
}

/** Emit stdout/close after the backend attaches listeners. */
export function finishMockChild(child: MockChild, stdout: string, code = 0): void {
  setImmediate(() => {
    if (stdout) {
      child.stdout.emit("data", Buffer.from(stdout));
    }
    child.emit("close", code);
  });
}
