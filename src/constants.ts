export const VIEW_TYPE = "cursor-chat-view";
export const PLUGIN_ID = "obsidian-cursor-chat";
export const CURSOR_API_BASE = "https://api.cursor.com";

export const SYSTEM_PROMPT = `You are an assistant embedded in the user's Obsidian vault.
Answer using the provided note context. Prefer concise, markdown-friendly replies.
When referencing notes, use [[wikilink]] syntax when the path is known.`;
