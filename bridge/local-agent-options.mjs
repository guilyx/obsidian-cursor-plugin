/**
 * Canonical local @cursor/sdk Agent.create options.
 * @see https://cursor.com/docs/sdk/typescript#usage-and-billing
 */
export function buildLocalAgentOptions({ apiKey, cwd, modelId = "composer-2.5", fast = true }) {
  return {
    apiKey,
    model: {
      id: modelId,
      params: [{ id: "fast", value: fast ? "true" : "false" }],
    },
    local: { cwd, settingSources: ["project", "user"] },
  };
}
