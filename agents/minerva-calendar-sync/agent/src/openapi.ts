/**
 * Writes the management API's OpenAPI document to a directory (default:
 * ./openapi). Run with `pnpm openapi` after `pnpm build`. The application
 * is created but never initialized: no database, broker or provider is
 * contacted.
 */
import "source-map-support/register";
// First: AppModule's configuration requires these when it is loaded.
import "./openapiEnv";

import { NestFactory } from "@nestjs/core";
import * as fs from "fs";
import * as path from "path";
import { AppModule } from "./AppModule";
import { configureApp } from "./configureApp";
import { buildOpenApiDocument } from "./openapi/documentBuilder";

export const OPENAPI_FILE = "minerva-calendar-sync.json";

async function generate(outDir: string): Promise<void> {
  const app = await NestFactory.create(AppModule, { logger: ["error"] });
  configureApp(app);

  fs.mkdirSync(outDir, { recursive: true });
  const target = path.join(outDir, OPENAPI_FILE);
  const document = buildOpenApiDocument(app, false);
  fs.writeFileSync(target, `${JSON.stringify(document, null, 2)}\n`);
  console.log(`Wrote ${target}`);

  await app.close();
}

generate(process.argv[2] ?? "openapi")
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("OpenAPI generation failed", e);
    process.exit(1);
  });
