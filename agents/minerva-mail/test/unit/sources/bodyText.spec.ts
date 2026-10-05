import { describe, expect, it } from "vitest";
import { htmlToText, snippetOf } from "../../../src/sources/bodyText";

describe("htmlToText", () => {
  it("drops tags, styles and scripts, and keeps blocks as lines", () => {
    expect(
      htmlToText(
        "<html><head><style>p{}</style></head><body><p>One &amp; two</p><script>x()</script><div>Three&nbsp;four&#33;</div></body></html>",
      ),
    ).toBe("One & two\nThree four!");
  });
});

describe("snippetOf", () => {
  it("collapses whitespace and keeps 200 characters", () => {
    const text = `A  b\n\nc ${"x".repeat(300)}`;
    const snippet = snippetOf(text);
    expect(snippet.startsWith("A b c x")).toBe(true);
    expect(Array.from(snippet)).toHaveLength(200);
  });

  it("does not split a character", () => {
    expect(snippetOf("😀".repeat(250))).toBe("😀".repeat(200));
  });
});
