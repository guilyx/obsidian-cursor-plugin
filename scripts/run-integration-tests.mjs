#!/usr/bin/env node
/** Run live Cursor API integration tests (requires CURSOR_API_KEY). */
import esbuild from "esbuild";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const root = new URL("..", import.meta.url).pathname;
const entry = join(root, "tests", "cursorApi.integration.test.ts");
const out = join(root, "tests", ".bundled", "cursorApi.integration.test.js");

if (!process.env.CURSOR_API_KEY?.trim()) {
  console.log("CURSOR_API_KEY not set — skipping integration tests");
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

const result = spawnSync(process.execPath, ["--test", out], {
  stdio: "inherit",
  cwd: root,
  env: process.env,
});

process.exit(result.status ?? 1);
