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

  it("validate runs agent --version", async () => {
    const calls: SpawnCall[] = [];
    const spawnFn = createMockSpawn((call, child) => {
      calls.push(call);
      finishMockChild(child, "agent 1.0.0");
    });

    const backend = new CursorAgentCliBackend(
      testSettings({ backend: "cursor-agent" }),
      () => "/vault",
      spawnFn,
    );

    await backend.validate();
    assert.equal(calls[0]?.command, "agent");
    assert.deepEqual(calls[0]?.args, ["--version"]);
    assert.equal(calls[0]?.cwd, "/vault");
  });

  it("passes CURSOR_API_KEY when settings.cursor.apiKey is set", async () => {
    const calls: SpawnCall[] = [];
    const spawnFn = createMockSpawn((call, child) => {
      calls.push(call);
      finishMockChild(child, "ok");
    });

    const backend = new CursorAgentCliBackend(
      testSettings({ backend: "cursor-agent", cursor: { apiKey: "crsr_test_key" } }),
      () => "/vault",
      spawnFn,
    );

    await collectStreamEvents(
      backend.send({
        session: testSession({ backend: "cursor-agent" }),
        userText: "hi",
        contextPrefix: "",
      }),
    );

    assert.equal(calls[0]?.env.CURSOR_API_KEY, "crsr_test_key");
  });

  it("send runs agent with --yolo --trust -p and composed prompt", async () => {
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
    assert.equal(calls[0]?.args[0], "--yolo");
    assert.equal(calls[0]?.args[1], "--trust");
    assert.equal(calls[0]?.args[2], "-p");
    assert.match(calls[0]?.args[3] ?? "", /What is in my note/);
    assert.match(calls[0]?.args[3] ?? "", /note body/);
    assert.equal(calls[0]?.cwd, "/vault");
    assert.ok(events.some((e) => e.type === "assistant-done" && e.text === "CLI answer"));
  });

  it("omits yolo flags when yoloMode is disabled", async () => {
    const calls: SpawnCall[] = [];
    const spawnFn = createMockSpawn((call, child) => {
      calls.push(call);
      finishMockChild(child, "ok");
    });

    const backend = new CursorAgentCliBackend(
      testSettings({ backend: "cursor-agent", cursorAgent: { yoloMode: false } }),
      () => "/vault",
      spawnFn,
    );

    await collectStreamEvents(
      backend.send({
        session: testSession({ backend: "cursor-agent" }),
        userText: "hi",
        contextPrefix: "",
      }),
    );

    assert.deepEqual(calls[0]?.args, ["-p", "hi"]);
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
