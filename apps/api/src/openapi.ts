/**
 * Writes the Olympus, Dionysus and Minerva OpenAPI documents to a directory
 * (default: ./openapi). Run with `pnpm openapi` after `pnpm build`.
 *
 * Replaces the Jest "test" that previously generated the specs in
 * postbuild. The application is created but never listens, and the AMQP
 * connection is stubbed so no broker is needed.
 */
import "source-map-support/register";
// First: AppModule validates the configuration when it is loaded.
import "./openapiEnv";

import { AmqpConnection } from "@golevelup/nestjs-rabbitmq";
import { NestFactory } from "@nestjs/core";
import * as fs from "fs";
import * as path from "path";
import { AppModule } from "./AppModule";
import { buildOpenApiDocument } from "./schema/documentBuilder";
import {
  DionysusApiConfig,
  MinervaApiConfig,
  OlympusApiConfig,
} from "./schema/schemas";

AmqpConnection.prototype.init = async () => {};
AmqpConnection.prototype.close = async () => {};

const DOCUMENTS = [
  { file: "olympus.json", config: OlympusApiConfig },
  { file: "dionysus.json", config: DionysusApiConfig },
  { file: "minerva.json", config: MinervaApiConfig },
];

async function generate(outDir: string): Promise<void> {
  const app = await NestFactory.create(AppModule, { logger: ["error"] });
  await app.init();

  fs.mkdirSync(outDir, { recursive: true });

  for (const { file, config } of DOCUMENTS) {
    const document = buildOpenApiDocument(app, config, false);
    const target = path.join(outDir, file);
    fs.writeFileSync(target, `${JSON.stringify(document, null, 2)}\n`);
    console.log(`Wrote ${target}`);
  }

  await app.close();
}

generate(process.argv[2] ?? "openapi")
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("OpenAPI generation failed", e);
    process.exit(1);
  });
