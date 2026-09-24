import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  reportBootstrapFailure,
  writePartialGraph,
} from "../../../src/bootstrap/reportBootstrapFailure";

const graph = { toString: () => '{"nodes":[]}' };
const expected = path.join(os.tmpdir(), "olympus-partial-graph.json");

afterEach(() => {
  vi.restoreAllMocks();
});

describe("writePartialGraph", () => {
  it("writes to the temporary directory, not the working directory", () => {
    // The working directory in a container is /app, owned by root.
    expect(writePartialGraph(graph, "development")).toEqual({
      written: expected,
    });
    expect(fs.readFileSync(expected, "utf8")).toBe('{"nodes":[]}');
  });

  it("writes nothing in production", () => {
    const write = vi.spyOn(fs, "writeFileSync");
    expect(writePartialGraph(graph, "production")).toEqual({
      skipped: "production",
    });
    expect(write).not.toHaveBeenCalled();
  });

  it("returns the reason rather than throwing when it cannot write", () => {
    vi.spyOn(fs, "writeFileSync").mockImplementation(() => {
      throw new Error("EACCES: permission denied");
    });
    expect(writePartialGraph(graph, "development")).toEqual({
      failed: "EACCES: permission denied",
    });
  });

  it("does not throw when the graph itself cannot be rendered", () => {
    const broken = {
      toString: () => {
        throw new Error("no graph");
      },
    };
    expect(writePartialGraph(broken, "development")).toEqual({
      failed: "no graph",
    });
  });

  it("treats an absent graph as empty", () => {
    expect(
      writePartialGraph({ toString: () => undefined }, "development"),
    ).toHaveProperty("written");
  });
});

describe("reportBootstrapFailure", () => {
  const logger = () => {
    const messages: string[] = [];
    return { messages, error: (m: string) => messages.push(m) };
  };

  it("logs the error's stack", () => {
    const log = logger();
    const error = new Error("nope");
    const stacks: (string | undefined)[] = [];
    reportBootstrapFailure(error, graph, {
      error: (m, s) => {
        log.messages.push(m);
        stacks.push(s);
      },
    });
    expect(log.messages[0]).toContain("Error during bootstrap");
    expect(stacks[0]).toBe(error.stack);
  });

  // The whole point: it runs while the process is already failing.
  it("does not throw when the graph cannot be written", () => {
    vi.spyOn(fs, "writeFileSync").mockImplementation(() => {
      throw new Error("EACCES: permission denied");
    });
    const log = logger();
    expect(() =>
      reportBootstrapFailure(new Error("nope"), graph, log),
    ).not.toThrow();
    expect(log.messages.join("\n")).toContain("Could not write");
  });

  it("says where the graph went when it could be written", () => {
    const log = logger();
    reportBootstrapFailure(new Error("nope"), graph, log);
    expect(log.messages.join("\n")).toContain(expected);
  });
});
