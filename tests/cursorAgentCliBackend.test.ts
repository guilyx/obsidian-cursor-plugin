import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { CursorAgentCliBackend } from "../src/backends/CursorAgentCliBackend.ts";
import { collectStreamEvents } from "./helpers/collectEvents.ts";
import { createMockSpawn, finishMockChild, type SpawnCall } from "./helpers/mockSpawn.ts";
import { testSession, testSettings } from "./helpers/settings.ts";

describe("CursorAgentCliBackend", () => {
  it("validate requires local folder vault", async () => {
    const backend = new CursorAgentCliBackend(testSettings({ backend: "cursor-agent" }), () => null);
    await assert.rejects(() => backend.validate(), /local folder vault/);
  });

  it("validate runs agent --version in vault cwd", async () => {
    const calls: string[] = [];
    const spawnFn = createMockSpawn(({ command, args, cwd }, child) => {
      calls.push(`${command} ${args.join(" ")} @ ${cwd}`);
      finishMockChild(child, "1.0.0\n");
    });

    const backend = new CursorAgentCliBackend(
      testSettings({ backend: "cursor-agent", cursorAgent: { cliPath: "agent" } }),
      () => "/vault/path",
      spawnFn,
    );
    await backend.validate();
    assert.equal(calls[0], "agent --version @ /vault/path");
  });

  it("send runs agent -p with composed prompt", async () => {
    const calls: SpawnCall[] = [];
    const spawnFn = createMockSpawn((call, child) => {
      calls.push(call);
      finishMockChild(child, "CLI answer");
    });

    const backend = new CursorAgentCliBackend(
      testSettings({ backend: "cursor-agent" }),
      () => "/vault",
      spawnFn,
    );

    const events = await collectStreamEvents(
      backend.send({
        session: testSession({ backend: "cursor-agent" }),
        userText: "What is in my note?",
        contextPrefix: "## Vault context\n\nnote body\n\n---\n\n",
      }),
    );

    assert.equal(calls[0]?.command, "agent");
    assert.equal(calls[0]?.args[0], "-p");
    assert.match(calls[0]?.args[1] ?? "", /What is in my note/);
    assert.match(calls[0]?.args[1] ?? "", /note body/);
    assert.equal(calls[0]?.cwd, "/vault");
    assert.ok(events.some((e) => e.type === "assistant-done" && e.text === "CLI answer"));
  });

  it("send yields error when CLI returns empty output", async () => {
    const spawnFn = createMockSpawn((_call, child) => {
      finishMockChild(child, "");
    });

    const backend = new CursorAgentCliBackend(
      testSettings({ backend: "cursor-agent" }),
      () => "/vault",
      spawnFn,
    );

    const events = await collectStreamEvents(
      backend.send({
        session: testSession(),
        userText: "hi",
        contextPrefix: "",
      }),
    );

    assert.ok(events.some((e) => e.type === "error" && e.message.includes("empty output")));
  });
});
