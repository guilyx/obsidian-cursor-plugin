export type CursorRunStatus =
  | "CREATING"
  | "RUNNING"
  | "FINISHED"
  | "ERROR"
  | "CANCELLED"
  | "EXPIRED";

export type CursorConversationMode = "plan" | "agent";

export interface CursorMeResponse {
  apiKeyName: string;
  userEmail?: string;
}

export interface CursorModel {
  id: string;
  displayName?: string;
}

export interface CursorAgent {
  id: string;
  name?: string;
  status?: string;
  url?: string;
  latestRunId?: string;
}

export interface CursorRun {
  id: string;
  agentId: string;
  status: CursorRunStatus;
  result?: string;
}

export interface CreateAgentResponse {
  agent: CursorAgent;
  run: CursorRun;
}

export interface CreateRunResponse {
  run: CursorRun;
}

export interface CursorPrompt {
  text: string;
}

export interface CreateAgentRequest {
  name?: string;
  mode?: CursorConversationMode;
  model?: { id: string };
  prompt: CursorPrompt;
}

export interface CreateRunRequest {
  prompt: CursorPrompt;
  mode?: CursorConversationMode;
}
