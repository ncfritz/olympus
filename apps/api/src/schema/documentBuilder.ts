import { INestApplication, Type } from "@nestjs/common";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";

export type OpenApiDocumentConfig = {
  name: string;
  description?: string;
  route: string;
  title?: string;
  modules: Type<unknown>[];
};

export const buildOpenApiDocument = (
  app: INestApplication,
  config: OpenApiDocumentConfig,
  register: boolean = true,
) => {
  const documentConfig = new DocumentBuilder()
    .setTitle(config.title || `${config.name} API`)
    .setDescription(
      config.description || `API documentation for ${config.name}`,
    )
    .setVersion(process.env.npm_package_version || "Unknown")
    .setOpenAPIVersion("3.1.1")
    .setContact("Neil Fritz", "https://ncfritz.net", "ncfritz@ncfritz.net")
    .addTag(config.name)
    .build();
  const document = SwaggerModule.createDocument(app, documentConfig, {
    include: config.modules,
  });

  // Declare every tag an operation uses, so the document lists them all
  // (not only the document-level tag added above).
  const declared = new Set((document.tags ?? []).map((tag) => tag.name));
  const used = Object.values(document.paths).flatMap((pathItem) =>
    Object.values(pathItem).flatMap(
      (operation: { tags?: string[] }) => operation?.tags ?? [],
    ),
  );
  document.tags = [
    ...(document.tags ?? []),
    ...[...new Set(used)]
      .filter((name) => !declared.has(name))
      .sort()
      .map((name) => ({ name })),
  ];

  if (register) {
    SwaggerModule.setup(`${config.route}/api-spec`, app, document);
  }

  return document;
};
