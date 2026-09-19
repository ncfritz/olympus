import {
  FilterDefinition,
  FilterType,
  SortDirection,
} from "@ncfritz/olympus-model";
import { BadRequestException } from "@nestjs/common";
import { describe, expect, it } from "vitest";
import {
  buildFilterExpression,
  buildPaginationExpression,
  parseFilterDefinition,
} from "../../../src/utils/filterUtil";

const eq = (name: string, value: FilterDefinition["value"]) => ({
  name,
  type: FilterType.EQUALS,
  value,
});
const encode = (definition: unknown) =>
  Buffer.from(JSON.stringify(definition)).toString("base64");

describe("buildFilterExpression", () => {
  it("returns undefined without a filter", () => {
    expect(buildFilterExpression(undefined)).toBeUndefined();
    expect(buildFilterExpression("")).toBeUndefined();
  });

  it("builds a single comparison", () => {
    expect(buildFilterExpression(eq("author", "ncfritz"))).toBe(
      'where: {author: {_eq: "ncfritz"}}',
    );
  });

  it("formats numbers and booleans unquoted", () => {
    expect(buildFilterExpression(eq("count", 3))).toBe(
      "where: {count: {_eq: 3}}",
    );
    expect(buildFilterExpression(eq("flagged", true))).toBe(
      "where: {flagged: {_eq: true}}",
    );
  });

  it("nests dotted field names into relationships", () => {
    expect(buildFilterExpression(eq("genre.name", "Drama"))).toBe(
      'where: {genre: {name: {_eq: "Drama"}}}',
    );
    expect(buildFilterExpression(eq("a.b.c", 1))).toBe(
      "where: {a: {b: {c: {_eq: 1}}}}",
    );
  });

  it("passes every value to array operators", () => {
    expect(
      buildFilterExpression({
        name: "status",
        type: FilterType.IN,
        value: ["queued", "running"],
      }),
    ).toBe('where: {status: {_in: ["queued", "running"]}}');
  });

  it("uses the first value for scalar operators given an array", () => {
    expect(buildFilterExpression(eq("status", ["queued", "running"]))).toBe(
      'where: {status: {_eq: "queued"}}',
    );
  });

  it("joins nested definitions with and/or", () => {
    expect(
      buildFilterExpression({
        name: "_",
        type: FilterType.AND,
        value: [eq("a", 1), eq("b", "x")],
      }),
    ).toBe('where: {_and: [{a: {_eq: 1}}, {b: {_eq: "x"}}]}');
    expect(
      buildFilterExpression({
        name: "_",
        type: FilterType.OR,
        value: [eq("a", 1), eq("a", 2)],
      }),
    ).toBe("where: {_or: [{a: {_eq: 1}}, {a: {_eq: 2}}]}");
  });

  it("builds existence filters", () => {
    const exists = (value: boolean) => ({
      name: "tags",
      type: FilterType.EXISTS,
      value,
    });
    expect(buildFilterExpression(exists(true))).toBe("where: {tags: {}}");
    expect(buildFilterExpression(exists(false))).toBe(
      "where: {_not: { tags: {}}}",
    );
  });

  it("unwraps a single nested definition", () => {
    expect(
      buildFilterExpression({
        name: "_",
        type: FilterType.AND,
        value: eq("a", 1),
      }),
    ).toBe("where: {a: {_eq: 1}}");
  });

  it("accepts a base64-encoded definition", () => {
    expect(buildFilterExpression(encode(eq("author", "ncfritz")))).toBe(
      'where: {author: {_eq: "ncfritz"}}',
    );
  });

  describe("rejects input that could alter the GraphQL document", () => {
    it("escapes quotes in string values", () => {
      expect(buildFilterExpression(eq("title", 'a"} }, x: {_eq: "b'))).toBe(
        'where: {title: {_eq: "a\\"} }, x: {_eq: \\"b"}}',
      );
    });

    it.each([
      "title}}",
      "title: {_eq: 1}, other",
      "1title",
      "title.",
      "ti tle",
    ])("rejects field name %j", (name) => {
      expect(() => buildFilterExpression(eq(name, 1))).toThrow(
        BadRequestException,
      );
    });

    it("rejects unknown operators", () => {
      expect(() =>
        buildFilterExpression({
          name: "a",
          type: "eq}, b: {_eq" as FilterType,
          value: 1,
        }),
      ).toThrow(BadRequestException);
    });

    it("rejects malformed base64 / JSON", () => {
      expect(() => buildFilterExpression("not-json")).toThrow(
        BadRequestException,
      );
    });
  });
});

describe("parseFilterDefinition", () => {
  it("passes objects through and decodes strings", () => {
    const definition = eq("a", 1);
    expect(parseFilterDefinition(definition)).toBe(definition);
    expect(parseFilterDefinition(encode(definition))).toEqual(definition);
    expect(parseFilterDefinition(undefined)).toBeUndefined();
  });
});

describe("buildPaginationExpression", () => {
  const params = {
    pageSize: 10,
    startPage: 2,
    sortField: "createdTime",
    sortDirection: SortDirection.DESC,
  };

  it("builds limit, offset and order", () => {
    expect(buildPaginationExpression(params)).toBe(
      "limit: 10, offset: 20, order_by: [{createdTime: desc}]",
    );
  });

  it("accepts page numbers passed as query strings", () => {
    expect(
      buildPaginationExpression({
        ...params,
        pageSize: "5" as unknown as number,
        startPage: "3" as unknown as number,
      }),
    ).toBe("limit: 5, offset: 15, order_by: [{createdTime: desc}]");
  });

  it("adds a fallback sort on a different field", () => {
    expect(
      buildPaginationExpression({
        ...params,
        fallbackSort: { sortField: "id", sortDirection: SortDirection.ASC },
      }),
    ).toBe("limit: 10, offset: 20, order_by: [{createdTime: desc}, {id: asc}]");
  });

  it("ignores a fallback sort on the same field", () => {
    expect(
      buildPaginationExpression({
        ...params,
        fallbackSort: {
          sortField: "createdTime",
          sortDirection: SortDirection.ASC,
        },
      }),
    ).toBe("limit: 10, offset: 20, order_by: [{createdTime: desc}]");
  });

  it.each([
    { sortField: "createdTime: desc}, {x" },
    { sortDirection: "desc}]" as SortDirection },
    { pageSize: -1 },
    { pageSize: "10; drop" as unknown as number },
    { startPage: 1.5 },
  ])("rejects %j", (override) => {
    expect(() => buildPaginationExpression({ ...params, ...override })).toThrow(
      BadRequestException,
    );
  });
});
