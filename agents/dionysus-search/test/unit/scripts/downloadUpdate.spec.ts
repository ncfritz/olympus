import * as fs from "fs";
import { createRequire } from "module";
import * as path from "path";
import { describe, expect, it } from "vitest";

/**
 * The NZBGet extension scripts (Python) publish DownloadUpdateMessage
 * without the TypeScript types; check their payloads against the schema
 * generated from those types (@ncfritz/olympus-messages/schemas).
 */
const SCRIPTS = path.resolve(__dirname, "../../../scripts");
const SCHEMA = JSON.parse(
  fs.readFileSync(
    createRequire(__filename).resolve(
      "@ncfritz/olympus-messages/schemas/download-update.schema.json",
    ),
    "utf8",
  ),
) as {
  definitions: Record<
    string,
    {
      properties?: Record<string, { const?: string }>;
      required?: string[];
    }
  >;
};

/** The event schemas by their `type` constant. */
const EVENTS = Object.fromEntries(
  Object.values(SCHEMA.definitions)
    .filter((definition) => definition.properties?.type?.const)
    .map((definition) => [definition.properties!.type.const!, definition]),
);

/** The dict literal, exchange and routing key of a script's publish_message. */
const publishCall = (script: string) => {
  const source = fs.readFileSync(path.join(SCRIPTS, script, "main.py"), "utf8");
  const call = source.match(
    /publish_message\(\{([\s\S]*?)\},\s*"([^"]+)",\s*"([^"]+)"\)/,
  );
  if (!call) throw new Error(`${script}: no publish_message({...}) call`);
  const [, body, exchange, routingKey] = call;
  const entries = [...body.matchAll(/^\s*"(\w+)":\s*(.+?),?\s*$/gm)].map(
    ([, key, value]) => [key, value] as const,
  );
  return { entries, exchange, routingKey };
};

describe.each([
  ["dionysus-scan", "scan"],
  ["dionysus-queue", "queue"],
  ["dionysus-post-process", "post-process"],
])("%s", (script, type) => {
  const { entries, exchange, routingKey } = publishCall(script);
  const event = EVENTS[type];

  it("publishes on the download update route", () => {
    expect([exchange, routingKey]).toEqual(["download.update", "update.queue"]);
  });

  it(`sends a ${type} event`, () => {
    expect(entries).toContainEqual(["type", `"${type}"`]);
  });

  it("sends exactly the schema's fields", () => {
    expect(entries.map(([key]) => key).sort()).toEqual(
      Object.keys(event.properties!).sort(),
    );
  });

  it("sends every required field", () => {
    const keys = new Set(entries.map(([key]) => key));
    expect((event.required ?? []).filter((key) => !keys.has(key))).toEqual([]);
  });
});
