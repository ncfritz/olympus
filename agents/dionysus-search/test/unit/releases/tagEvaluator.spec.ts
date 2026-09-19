import { describe, expect, it } from "vitest";
import { parseTitle } from "../../../src/releases/detector";
import { evaluate } from "../../../src/releases/tag/tagEvaluator";
import {
  type TagDefinition,
  TagSource,
  type TagSpecification,
} from "../../../src/releases/tag/types";

const spec = (
  implementation: TagSource,
  value: string | number,
  options: { negate?: boolean; required?: boolean } = {},
): TagSpecification => ({
  name: `${implementation} ${value}`,
  implementation,
  negate: options.negate ?? false,
  required: options.required ?? false,
  fields: { value },
});

const tag = (...specifications: TagSpecification[]): TagDefinition => ({
  trash_id: "id",
  trash_scores: { default: 10 },
  name: "Tag",
  specifications,
});

const TITLE = parseTitle(
  "Dune.Part.Two.2024.2160p.WEB-DL.DDP5.1.Atmos.DV.H.265-FLUX",
);
const matches = (definition: TagDefinition) =>
  evaluate(TITLE, definition) !== undefined;

describe("evaluate", () => {
  it("scores a matching tag", () => {
    expect(
      evaluate(
        TITLE,
        tag(spec(TagSource.ReleaseTitleSpecification, "\\bDV\\b")),
      ),
    ).toEqual({
      name: "Tag",
      value: 10,
    });
  });

  it("matches when any condition of a type is met", () => {
    expect(
      matches(
        tag(
          spec(TagSource.ReleaseTitleSpecification, "\\bHDR10\\+"),
          spec(TagSource.ReleaseTitleSpecification, "\\bDV\\b"),
        ),
      ),
    ).toBe(true);
  });

  it("needs a met condition of every type", () => {
    const dvFromGroup = (source: number) =>
      tag(
        spec(TagSource.ReleaseTitleSpecification, "\\bDV\\b"),
        spec(TagSource.SourceSpecification, source),
      );
    expect(matches(dvFromGroup(7))).toBe(true); // WEB-DL
    expect(matches(dvFromGroup(9))).toBe(false); // Blu-ray
  });

  it("needs every required condition", () => {
    expect(
      matches(
        tag(
          spec(TagSource.ReleaseTitleSpecification, "\\bDV\\b"),
          spec(TagSource.ReleaseTitleSpecification, "\\bHDR10\\+", {
            required: true,
          }),
        ),
      ),
    ).toBe(false);
  });

  it("negates conditions", () => {
    expect(
      matches(
        tag(
          spec(TagSource.ReleaseTitleSpecification, "\\bDDP", {
            required: true,
          }),
          spec(TagSource.ReleaseTitleSpecification, "TrueHD", {
            negate: true,
            required: true,
          }),
        ),
      ),
    ).toBe(true);
  });

  it("matches resolution-only tags", () => {
    expect(
      matches(
        tag(spec(TagSource.ResolutionSpecification, 2160, { required: true })),
      ),
    ).toBe(true);
    expect(
      matches(
        tag(spec(TagSource.ResolutionSpecification, 1080, { required: true })),
      ),
    ).toBe(false);
  });

  it("never matches tags with language conditions", () => {
    expect(
      matches(
        tag(
          spec(TagSource.ReleaseTitleSpecification, "\\bDV\\b"),
          spec(TagSource.LanguageSpecification, 1),
        ),
      ),
    ).toBe(false);
  });
});
