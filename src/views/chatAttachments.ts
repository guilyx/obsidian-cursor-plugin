export type ChatAttachment =
  | { kind: "file"; path: string; label: string }
  | { kind: "folder"; path: string; label: string };

export function attachmentKey(att: ChatAttachment): string {
  return `${att.kind}:${att.path}`;
}

export function attachmentChipLabel(att: ChatAttachment): string {
  return att.kind === "folder" ? `📁 ${att.label}` : `📎 ${att.label}`;
}

export function mergeAttachments(existing: ChatAttachment[], incoming: ChatAttachment[]): ChatAttachment[] {
  const seen = new Set(existing.map(attachmentKey));
  const merged = [...existing];
  for (const att of incoming) {
    const key = attachmentKey(att);
    if (!seen.has(key)) {
      seen.add(key);
      merged.push(att);
    }
  }
  return merged;
}
