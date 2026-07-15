import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseObsidianFileParam, parseWikiLinkText } from "../src/context/vaultDragPathParse.ts";

describe("vaultDragPath parsers", () => {
  it("parses wikilink text", () => {
    assert.equal(parseWikiLinkText("[[archive]]"), "archive");
    assert.equal(parseWikiLinkText("[[inbox/reviews|Reviews]]"), "inbox/reviews");
    assert.equal(parseWikiLinkText("plain"), null);
  });

  it("parses obsidian file param", () => {
    assert.equal(
      parseObsidianFileParam("obsidian://open?vault=Demo&file=inbox%2Freviews"),
      "inbox/reviews",
    );
    assert.equal(parseObsidianFileParam("obsidian://open?vault=Demo"), null);
  });
});
