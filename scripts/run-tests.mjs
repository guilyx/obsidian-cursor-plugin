#!/usr/bin/env node
/**
 * Bundle TypeScript tests with esbuild, then run node:test.
 * ponytail: avoids --experimental-strip-types limits on parameter properties.
 */
import esbuild from "esbuild";
import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const root = new URL("..", import.meta.url).pathname;
const testsDir = join(root, "tests");
const outDir = join(testsDir, ".bundled");

const testFiles = (await readdir(testsDir)).filter(
  (f) => f.endsWith(".test.ts") && !f.endsWith(".integration.test.ts"),
);
const entryPoints = testFiles.map((f) => join(testsDir, f));

await esbuild.build({
  entryPoints,
  outdir: outDir,
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node22",
  logLevel: "silent",
});

const bundled = testFiles.map((f) => join(outDir, f.replace(/\.ts$/, ".js")));

const result = spawnSync(process.execPath, ["--test", ...bundled], {
  stdio: "inherit",
  cwd: root,
});

process.exit(result.status ?? 1);
