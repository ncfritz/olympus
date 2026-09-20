import { build } from "esbuild";
import * as path from "path";
import { describe, expect, it } from "vitest";

/** The main entry point is for the site too: it must bundle for a browser. */
describe("the main entry point", () => {
  it("bundles for the browser without Node built-ins", async () => {
    const result = await build({
      entryPoints: [path.join(__dirname, "../../src/index.ts")],
      bundle: true,
      platform: "browser",
      format: "esm",
      write: false,
      logLevel: "silent",
    });
    expect(result.errors).toEqual([]);
    expect(result.outputFiles[0].text).not.toMatch(
      /require\("(node:)?(fs|path|os|crypto|http)"\)/,
    );
  }, 30_000);
});
