/**
 * Writes the app-facing OpenAPI document to ../../openapi/app-api.yaml —
 * the contract the web app (and, later, the separate-repo iOS app) generate
 * their typed clients against.
 *
 * Usage: pnpm openapi:generate
 */
import "dotenv/config";
import { writeFileSync } from "fs";
import { dump } from "js-yaml";
import { join } from "path";
import { DocumentBuilder } from "@nestjs/swagger";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "../src/app.module";
import { buildOpenApiDocument } from "../src/openapi";

const OUTPUT_PATH = join(__dirname, "..", "..", "..", "openapi", "app-api.yaml");

async function main(): Promise<void> {
  // SYNCED_CALENDARS/AUTH_OIDC_PROVIDERS must not drive any real syncing or
  // login here — this script only introspects controller/DTO metadata, so
  // empty config keeps it from touching live credentials at all (same
  // reasoning as the e2e test's env-setup). AUTH_JWT_SECRET only needs to be
  // *set* — AuthModule requires it at boot, but no token is ever issued here.
  process.env.SYNCED_CALENDARS = "[]";
  process.env.AUTH_OIDC_PROVIDERS ??= "[]";
  process.env.AUTH_JWT_SECRET ??= "openapi-generation-placeholder";

  const app = await NestFactory.create(AppModule, { logger: false });
  const document = buildOpenApiDocument(app, new DocumentBuilder());
  await app.close();

  writeFileSync(OUTPUT_PATH, dump(document, { noRefs: true }));
  console.log(`Wrote ${OUTPUT_PATH}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
