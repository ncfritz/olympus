import { INestApplication } from "@nestjs/common";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";

export type OpenApiDocumentConfig = {
  name: string;
  description?: string;
  route: string;
  title?: string;
  modules: any[];
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

  if (register) {
    SwaggerModule.setup(`${config.route}/api-spec`, app, document);
  }

  return document;
};
