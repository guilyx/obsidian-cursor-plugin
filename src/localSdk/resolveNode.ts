import type { SpawnFn } from "./LocalSdkBridgeManager";

const MIN_NODE_MAJOR = 22;

export function parseNodeMajor(version: string): number {
  const match = version.trim().match(/^v?(\d+)/);
  return match ? Number(match[1]) : 0;
}

function captureVersion(spawnFn: SpawnFn, executable: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawnFn(executable, ["--version"], {
      cwd: process.cwd(),
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    child.stdout?.on("data", (chunk: Buffer) => {
      stdout += chunk.toString("utf8");
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0 && stdout.trim()) {
        resolve(stdout.trim());
        return;
      }
      reject(new Error(`node --version failed (${code ?? "unknown"})`));
    });
  });
}

/** Prefer a system Node 22+ binary; fall back to the current runtime (Obsidian/Electron). */
export async function resolveNodeExecutable(spawnFn: SpawnFn): Promise<string> {
  for (const candidate of ["node", "nodejs"]) {
    try {
      const version = await captureVersion(spawnFn, candidate);
      if (parseNodeMajor(version) >= MIN_NODE_MAJOR) {
        return candidate;
      }
    } catch {
      // try next candidate
    }
  }

  if (parseNodeMajor(process.version) >= MIN_NODE_MAJOR) {
    return process.execPath;
  }

  throw new Error(
    "Local SDK requires Node.js 22+. Install Node 22+ or use the Cursor Agent CLI backend.",
  );
}
