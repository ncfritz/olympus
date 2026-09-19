// Writes JSON Schemas for the messages that non-TypeScript services
// publish (the Python NZBGet scripts), generated from the TS types.
// `pnpm schemas`; test/unit/schemas.spec.ts fails when they are stale.
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createGenerator } from "ts-json-schema-generator";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

export const SCHEMAS = {
  "download-update.schema.json": {
    path: join(root, "src/downloads.ts"),
    type: "DownloadUpdateMessage",
  },
};

export const generate = (file) => {
  const { path, type } = SCHEMAS[file];
  const schema = createGenerator({
    path,
    type,
    tsconfig: join(root, "tsconfig.json"),
    skipTypeCheck: true,
  }).createSchema(type);
  return `${JSON.stringify(schema, null, 2)}\n`;
};

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  for (const file of Object.keys(SCHEMAS)) {
    writeFileSync(join(root, "schemas", file), generate(file));
    console.log(`Wrote schemas/${file}`);
  }
}
