import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ChatSessionManager } from "../src/session/ChatSessionManager.ts";

describe("ChatSessionManager", () => {
  it("clears agent ids that do not match the selected sdk runtime", () => {
    const mgr = new ChatSessionManager();
    mgr.load({
      sessions: [
        {
          id: "s1",
          title: "local",
          backend: "cursor-sdk",
          messages: [],
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-01T00:00:00.000Z",
          cursorAgentId: "agent-local",
        },
        {
          id: "s2",
          title: "cloud",
          backend: "cursor-sdk",
          messages: [],
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-01T00:00:00.000Z",
          cursorAgentId: "bc-cloud",
        },
      ],
      activeId: "s1",
    });

    mgr.clearCursorAgentIdsForRuntime("cloud");
    const sessions = mgr.listSessions();
    assert.equal(sessions.find((s) => s.id === "s1")?.cursorAgentId, undefined);
    assert.equal(sessions.find((s) => s.id === "s2")?.cursorAgentId, "bc-cloud");
  });
});
