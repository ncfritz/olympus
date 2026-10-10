import type { INestApplication } from "@nestjs/common";
import {
  DocumentBuilder,
  SwaggerModule,
  type OpenAPIObject,
} from "@nestjs/swagger";

/** Where the service serves its document: /api-spec (UI) and /api-spec-json. */
export const API_SPEC_ROUTE = "api-spec";

/** The document's name: the `api` label of its request metrics (ADR 0017). */
export const API_NAME = "harpocrates";

/**
 * The management API's OpenAPI document (ADR 0020, Surfaces): what
 * packages/sdk generates its `harpocrates` client from, committed as
 * openapi/harpocrates.json (`pnpm openapi`). With `register`, also served
 * at /api-spec.
 */
export const buildOpenApiDocument = (
  app: INestApplication,
  register: boolean = true,
): OpenAPIObject => {
  const config = new DocumentBuilder()
    .setTitle("Harpocrates API")
    .setDescription(
      "Management API of Harpocrates, the internal certificate authority: issuers, profiles, certificates, revocation and ACME accounts.",
    )
    .setVersion(process.env.npm_package_version || "Unknown")
    .setOpenAPIVersion("3.1.1")
    .setContact("Neil Fritz", "https://ncfritz.net", "ncfritz@ncfritz.net")
    .addBearerAuth()
    // The renewal listener's caller (ADR 0020): a certificate Harpocrates
    // issued, presented in the TLS handshake on 9443.
    // OpenAPI 3.1's mutualTLS, which @nestjs/swagger's 3.0 types lack.
    .addSecurity("clientCertificate", {
      type: "mutualTLS",
      description:
        "A current certificate Harpocrates issued, presented to the renewal listener (9443)",
    } as unknown as Parameters<DocumentBuilder["addSecurity"]>[1])
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
