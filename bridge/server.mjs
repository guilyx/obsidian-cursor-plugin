#!/usr/bin/env node
/**
 * ponytail: minimal bridge stub — real @cursor/sdk wiring is a follow-up.
 * Serves GET /health and mock agent/run/SSE for plugin integration tests.
 */
import http from "node:http";
import { randomUUID } from "node:crypto";

const PORT = Number(process.env.BRIDGE_PORT ?? 8765);
const HOST = process.env.BRIDGE_HOST ?? "127.0.0.1";
const TOKEN = process.env.BRIDGE_TOKEN ?? "dev-bridge-token";

const agents = new Map();

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

function authOk(req) {
  const header = req.headers.authorization ?? "";
  return header === `Bearer ${TOKEN}`;
}

function sendJson(res, status, body) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
}

function sendSse(res, events) {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });
  for (const evt of events) {
    res.write(`event: ${evt.type}\n`);
    res.write(`data: ${JSON.stringify(evt.data)}\n\n`);
  }
  res.write("event: done\ndata: {}\n\n");
  res.end();
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", `http://${HOST}`);

  if (url.pathname === "/health" && req.method === "GET") {
    sendJson(res, 200, { ok: true, version: "0.0.1-stub", sdk: "stub" });
    return;
  }

  if (!authOk(req)) {
    sendJson(res, 401, { error: "unauthorized" });
    return;
  }

  if (url.pathname === "/agents" && req.method === "POST") {
    const raw = await readBody(req);
    let body = {};
    try {
      body = raw ? JSON.parse(raw) : {};
    } catch {
      sendJson(res, 400, { error: "invalid_json" });
      return;
    }
    const agentId = `bc-stub-${randomUUID().slice(0, 8)}`;
    const runId = `run-stub-${randomUUID().slice(0, 8)}`;
    agents.set(agentId, { cwd: body.cwd, runId });
    sendJson(res, 201, { agentId, runId });
    return;
  }

  const streamMatch = url.pathname.match(/^\/agents\/([^/]+)\/runs\/([^/]+)\/stream$/);
  if (streamMatch && req.method === "GET") {
    const [, agentId] = streamMatch;
    if (!agents.has(agentId)) {
      sendJson(res, 404, { error: "agent_not_found" });
      return;
    }
    sendSse(res, [
      {
        type: "assistant",
        data: {
          text: "Bridge stub response — install full SDK bridge for vault file tools.",
        },
      },
      { type: "result", data: { status: "FINISHED", text: "Bridge stub complete." } },
    ]);
    return;
  }

  const cancelMatch = url.pathname.match(/^\/agents\/([^/]+)\/runs\/([^/]+)\/cancel$/);
  if (cancelMatch && req.method === "POST") {
    sendJson(res, 204, {});
    return;
  }

  sendJson(res, 501, { error: "not_implemented", path: url.pathname });
});

server.listen(PORT, HOST, () => {
  console.log(`obsidian-cursor-bridge stub on http://${HOST}:${PORT} (token: ${TOKEN.slice(0, 4)}…)`);
});
