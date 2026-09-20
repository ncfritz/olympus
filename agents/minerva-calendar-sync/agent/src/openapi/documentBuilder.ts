import type { INestApplication } from "@nestjs/common";
import {
  DocumentBuilder,
  SwaggerModule,
  type OpenAPIObject,
} from "@nestjs/swagger";

/** Where the agent serves its document: /api-spec (UI) and /api-spec-json. */
export const API_SPEC_ROUTE = "api-spec";

/** The document's name: the `api` label of its request metrics (ADR 0017). */
export const API_NAME = "minerva-calendar-sync";

/**
 * The management API's OpenAPI document (ADR 0016): what the console
 * generates its client from, committed as openapi/minerva-calendar-sync.json
 * (`pnpm openapi`). With `register`, also served at /api-spec.
 */
export const buildOpenApiDocument = (
  app: INestApplication,
  register: boolean = true,
): OpenAPIObject => {
  const config = new DocumentBuilder()
    .setTitle("Minerva Calendar Sync API")
    .setDescription(
      "Management API of the Minerva calendar sync agent: connected calendar accounts, synced calendars and events, availability and its overrides, sync history and event publishing.",
    )
    .setVersion(process.env.npm_package_version || "Unknown")
    .setOpenAPIVersion("3.1.1")
    .setContact("Neil Fritz", "https://ncfritz.net", "ncfritz@ncfritz.net")
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);

  // Declare every tag an operation uses, so the document lists them all.
  const used = Object.values(document.paths).flatMap((pathItem) =>
    Object.values(pathItem).flatMap(
      (operation: { tags?: string[] }) => operation?.tags ?? [],
    ),
  );
  document.tags = [...new Set(used)].sort().map((name) => ({ name }));

  if (register) {
    SwaggerModule.setup(API_SPEC_ROUTE, app, document);
  }

  return document;
};
