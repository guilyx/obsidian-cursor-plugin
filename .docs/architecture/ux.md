# UX specification

[← Documentation index](../index.md)

User-facing behaviour for the Cursor chat sidebar.

> Architecture: [System design](design.md) · Backends: [Backend selection](backend-selection.md)

## Placement

| Element | Location |
|---------|----------|
| Primary view | Right sidebar `ItemView` (`CURSOR_CHAT_VIEW`) |
| Ribbon | `message-square` icon — toggles / focuses chat |
| Commands | Palette entries under *Cursor Chat* |

Default: closed on startup unless `openChatOnStartup` is enabled.

## Layout (wireframe)

```
┌─────────────────────────────────────┐
│ Cursor Chat  [session ▾] [📎][⚙][+]│  ← attach, settings, new chat
│                              [⋯]   │  ← more menu (setup, delete)
├─────────────────────────────────────┤
│                                     │
│  ┌─ You ─────────────────────────┐ │
│  │ Summarize [[Meeting Notes]]   │ │
│  └───────────────────────────────┘ │
│                                     │
│  ┌─ Cursor ──────────────────────┐ │
│  │ Here is a summary…            │ │
│  │ • Decision: …                 │ │  ← streamed markdown
│  └───────────────────────────────┘ │
│                                     │
│  ┌─ tool: grep ──────────────────┐ │  ← optional, Phase 3
│  │ searching vault… ✓            │ │
│  └───────────────────────────────┘ │
│                                     │
├─────────────────────────────────────┤
│ Context: 📄 Plan.md · 12 lines sel  │  ← chips, tap to remove
├─────────────────────────────────────┤
│ Ask Cursor about your notes…        │
│                              [Stop]│  ← Stop while streaming
│                              [Send]│
└─────────────────────────────────────┘
```

## Interactions

### Send message

| Input | Action |
|-------|--------|
| `Enter` | Send (if not empty) |
| `Shift+Enter` | New line |
| `Send` button | Send |
| Empty send | No-op |

While streaming: composer may stay enabled for queue (v2) or disabled (v1).

### Stop generation

- Visible when run status is `CREATING` or `RUNNING`
- Calls API cancel + aborts local stream
- Partial assistant text remains in the thread

### New chat

- Clears UI; creates new local session
- Cursor agent created lazily on first send

### Context chips

| Chip source | Label |
|-------------|-------|
| Active note | `📄 filename.md` |
| Selection | `✂️ selection (N chars)` |
| @mention / file drop | `📎 [[Note]]` |
| Folder drop | `📁 folder-name` |

Click × on chip to exclude from next message.

### Drag and drop

Drop vault **notes** or **folders** onto the **message list**, composer, or context chip bar. Folders attach up to 20 markdown files into context.

### Quick switcher (header bar)

| Control | Action |
|---------|--------|
| Backend ▾ | Switch `cursor-sdk` / `cursor-agent` / `llm-gateway` (persists immediately) |
| Model | Edit model id for SDK or LLM gateway (empty = account default for SDK) |
| Mode ▾ | `agent` / `plan` when Cursor SDK backend is selected |

### Toolbar

| Control | Action |
|---------|--------|
| 📎 Attach | Open fuzzy picker (notes + folders) |
| ⚙ Settings | Open plugin settings tab |
| + | New chat |
| ⋯ More | Toggle active note, setup wizard, delete chat |

### @mentions

Typing `@` opens fuzzy file suggest (`FuzzySuggestModal` pattern). Selected file added as attachment chip.

### Selection command

**Cursor Chat: Send selection to chat**

1. Open or focus chat view
2. Insert selection into composer or send immediately (setting: `sendSelectionImmediately`)

Works in **source mode** only; in preview, notify user to switch mode.

## Message rendering

- **User messages:** plain text, preserve line breaks
- **Assistant messages:** Obsidian `MarkdownRenderer` (wikilinks in replies won't resolve unless user enables — acceptable v1)
- **Thinking blocks:** collapsed `<details>` when `showThinking` enabled
- **Tool calls:** monospace summary + expand for args/result JSON
- **Errors:** red callout with retry button

## States

| State | Indicator |
|-------|-----------|
| No API key | Empty state + *Open settings* CTA |
| Validating | Spinner on first open |
| Ready | Composer enabled |
| Streaming | Pulsing cursor in assistant bubble; Stop visible |
| Error | Inline banner + last user message preserved |
| Offline | Yellow banner, retry |

## Settings UX

### API key field

- Password-style input
- Helper link: *Get your key from Cursor Dashboard*
- **Test connection** → green ✓ with account email, or red error

### Model picker

- Dropdown from `/v1/models`
- Option: *Use account default* (omit model on API calls)

### Privacy notice (first run)

Modal copy (concise):

> Note content you include in messages is sent to Cursor's servers for processing. Review your team's privacy settings at cursor.com/privacy.

Buttons: **I understand** / **Open settings**

## Theming

Use Obsidian CSS variables exclusively:

```css
.cursor-chat-view {
  background: var(--background-primary);
  color: var(--text-normal);
}

.cursor-chat-user {
  background: var(--background-secondary);
  border-radius: var(--radius-m);
}

.cursor-chat-assistant {
  border-left: 3px solid var(--interactive-accent);
}

.cursor-chat-composer textarea {
  background: var(--background-modifier-form-field);
  border: 1px solid var(--background-modifier-border);
}
```

Support light and dark without separate themes.

## Accessibility

- Composer textarea: `aria-label="Message Cursor"`
- Stop button: `aria-label="Stop generation"`
- Message list: `role="log"` `aria-live="polite"` for streamed text
- Keyboard: `Ctrl+Shift+C` (configurable) focus composer

## Empty states

| Condition | Message |
|-----------|---------|
| No key | *Connect your Cursor API key to start chatting.* |
| No messages | *Ask questions about your notes. The active file is included automatically.* |
| No active file | *No note open — answers will be general.* |

## Link-out

Assistant responses may include `https://cursor.com/agents/bc-…` — render as external link *Open in Cursor web* for deep inspection of agent runs.
