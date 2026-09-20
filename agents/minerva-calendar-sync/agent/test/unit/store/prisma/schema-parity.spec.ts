import { readFileSync } from "fs";
import { join } from "path";

const API_ROOT = join(__dirname, "..", "..", "..", "..");

/** Everything from the first model declaration onward — the generator/datasource header and its explanatory comments deliberately differ between the two files. */
function modelsOnly(schema: string): string {
  return schema.slice(schema.search(/^model /m)).trim();
}

// prisma/postgres/schema.prisma exists only because Prisma can't share
// model definitions across two `datasource` blocks with different
// `provider`s in one file, so its models are a hand-maintained copy of
// prisma/schema.prisma's. This is the guard against the two silently
// drifting apart — if it fails, whichever file was just edited needs the
// same change applied to the other one.
it("prisma/schema.prisma and prisma/postgres/schema.prisma define identical models", () => {
  const sqliteSchema = readFileSync(
    join(API_ROOT, "prisma", "schema.prisma"),
    "utf-8",
  );
  const postgresSchema = readFileSync(
    join(API_ROOT, "prisma", "postgres", "schema.prisma"),
    "utf-8",
  );

  expect(modelsOnly(postgresSchema)).toBe(modelsOnly(sqliteSchema));
});
