#!/usr/bin/env node
/** Run live Cursor API + local SDK integration tests (requires valid CURSOR_API_KEY). */
import esbuild from "esbuild";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const root = new URL("..", import.meta.url).pathname;
const entry = join(root, "tests", "cursorApi.integration.test.ts");
const out = join(root, "tests", ".bundled", "cursorApi.integration.test.js");
const bridgeDir = join(root, "bridge");

const apiKey = process.env.CURSOR_API_KEY?.trim();
if (!apiKey) {
  console.log("CURSOR_API_KEY not set — skipping integration tests");
  process.exit(0);
}

const probe = await fetch("https://api.cursor.com/v1/me", {
  headers: { Authorization: `Bearer ${apiKey}` },
});
if (!probe.ok) {
  const body = await probe.text().catch(() => "");
  console.log(
    `CURSOR_API_KEY invalid or unauthorized (${probe.status}) — skipping integration tests${body ? `: ${body.slice(0, 120)}` : ""}`,
  );
  process.exit(0);
}

await esbuild.build({
  entryPoints: [entry],
  outfile: out,
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node22",
  logLevel: "silent",
});

const apiResult = spawnSync(process.execPath, ["--test", out], {
  stdio: "inherit",
  cwd: root,
  env: process.env,
});

const sdkResult = spawnSync("npm", ["run", "test:integration"], {
  stdio: "inherit",
  cwd: bridgeDir,
  env: process.env,
  shell: true,
});

const exitCode =
  (apiResult.status ?? 1) !== 0
    ? (apiResult.status ?? 1)
    : (sdkResult.status ?? 1) !== 0
      ? (sdkResult.status ?? 1)
      : 0;

process.exit(exitCode);
