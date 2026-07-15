import type { SdkRuntime } from "../settings/CursorSettings";

/** Cloud Agents REST API ids (`POST /v1/agents`). */
export function isCloudCursorAgentId(agentId: string): boolean {
  return agentId.startsWith("bc-");
}

/** Local @cursor/sdk agent ids (`Agent.create({ local })`). */
export function isLocalCursorAgentId(agentId: string): boolean {
  return agentId.startsWith("agent-");
}

export function agentIdMatchesSdkRuntime(agentId: string, runtime: SdkRuntime): boolean {
  return runtime === "local" ? isLocalCursorAgentId(agentId) : isCloudCursorAgentId(agentId);
}
