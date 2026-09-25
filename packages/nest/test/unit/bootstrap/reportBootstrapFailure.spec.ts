import { existsSync, mkdtempSync, readdirSync, readFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { describe, expect, it } from "vitest";
import {
  reportBootstrapFailure,
  writePartialGraph,
} from "../../../src/bootstrap/reportBootstrapFailure";

const graph = { toString: () => '{"nodes":[]}' };
const FILE = "olympus-partial-graph.json";

const directory = () => mkdtempSync(join(tmpdir(), "graph-"));
// A directory that does not exist: the write fails for real, which is what
// happened on the NAS. `fs` cannot be spied on — it is a namespace import.
const missing = () => join(directory(), "nope");

describe("writePartialGraph", () => {
  it("writes the graph where it is told to", () => {
    const dir = directory();
    expect(
      writePartialGraph(graph, { environment: "development", directory: dir }),
    ).toEqual({
      written: join(dir, FILE),
    });
    expect(readFileSync(join(dir, FILE), "utf8")).toBe('{"nodes":[]}');
  });

  it("defaults to the temporary directory, not the working directory", () => {
    // In a container the working directory is /app, owned by root.
    const result = writePartialGraph(graph, { environment: "development" });
    expect(result).toEqual({ written: join(tmpdir(), FILE) });
  });

  it("writes nothing in production", () => {
    const dir = directory();
    expect(
      writePartialGraph(graph, { environment: "production", directory: dir }),
    ).toEqual({
      skipped: "production",
    });
    expect(readdirSync(dir)).toEqual([]);
  });

  it("returns the reason rather than throwing when it cannot write", () => {
    const dir = missing();
    const result = writePartialGraph(graph, {
      environment: "development",
      directory: dir,
    });
    expect(result).toMatchObject({ failed: expect.stringContaining("ENOENT") });
    expect(existsSync(dir)).toBe(false);
  });

  it("does not throw when the graph itself cannot be rendered", () => {
    const broken = {
      toString: () => {
        throw new Error("no graph");
      },
    };
    expect(
      writePartialGraph(broken, {
        environment: "development",
        directory: directory(),
      }),
    ).toEqual({ failed: "no graph" });
  });

  it("treats an absent graph as empty", () => {
    const dir = directory();
    expect(
      writePartialGraph(
        { toString: () => undefined },
        { environment: "development", directory: dir },
      ),
    ).toHaveProperty("written");
    expect(readFileSync(join(dir, FILE), "utf8")).toBe("");
  });
});

describe("reportBootstrapFailure", () => {
  const recorder = () => {
    const messages: string[] = [];
    const stacks: (string | undefined)[] = [];
    return {
      messages,
      stacks,
      error: (message: string, stack?: string) => {
        messages.push(message);
        stacks.push(stack);
      },
    };
  };

  it("logs the error's stack", () => {
    const log = recorder();
    const error = new Error("nope");
    reportBootstrapFailure(error, graph, log, {
      environment: "development",
      directory: directory(),
    });
    expect(log.messages[0]).toContain("Error during bootstrap");
    expect(log.stacks[0]).toBe(error.stack);
  });

  it("says where the graph went", () => {
    const log = recorder();
    const dir = directory();
    reportBootstrapFailure(new Error("nope"), graph, log, {
      environment: "development",
      directory: dir,
    });
    expect(log.messages.join("\n")).toContain(join(dir, FILE));
  });

  // The whole point: this runs while the process is already failing, and on
  // the NAS its own EACCES became the last line of the log.
  it("does not throw when the graph cannot be written", () => {
    const log = recorder();
    expect(() =>
      reportBootstrapFailure(new Error("nope"), graph, log, {
        environment: "development",
        directory: missing(),
      }),
    ).not.toThrow();
    expect(log.messages.join("\n")).toContain("Could not write");
    expect(log.messages[0]).toContain("Error during bootstrap");
  });

  it("logs nothing about the graph in production", () => {
    const log = recorder();
    reportBootstrapFailure(new Error("nope"), graph, log, {
      environment: "production",
    });
    expect(log.messages).toHaveLength(1);
  });
});
