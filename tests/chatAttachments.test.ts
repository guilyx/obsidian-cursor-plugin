import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  attachmentChipLabel,
  attachmentKey,
  mergeAttachments,
  type ChatAttachment,
} from "../src/views/chatAttachments.ts";

describe("chatAttachments", () => {
  it("labels files and folders", () => {
    assert.equal(attachmentChipLabel({ kind: "file", path: "a.md", label: "a" }), "📎 a");
    assert.equal(attachmentChipLabel({ kind: "folder", path: "proj", label: "proj" }), "📁 proj");
  });

  it("dedupes by kind and path", () => {
    const a: ChatAttachment = { kind: "file", path: "x.md", label: "x" };
    const b: ChatAttachment = { kind: "folder", path: "notes", label: "notes" };
    const merged = mergeAttachments([a], [a, b]);
    assert.equal(merged.length, 2);
    assert.equal(attachmentKey(merged[0]), "file:x.md");
    assert.equal(attachmentKey(merged[1]), "folder:notes");
  });
});
