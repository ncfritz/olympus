import { INestApplication } from "@nestjs/common";
import { DocumentBuilder, OpenAPIObject, SwaggerModule } from "@nestjs/swagger";

/**
 * Single source of truth for the app-facing OpenAPI document's metadata —
 * shared between main.ts (live Swagger UI) and scripts/generate-openapi.ts
 * (the openapi/app-api.yaml file the web/iOS clients generate against).
 */
export function buildOpenApiDocument(app: INestApplication, builder: DocumentBuilder): OpenAPIObject {
  const config = builder
    .setTitle("Minerva Calendar Sync API")
    .setDescription("Read API over synchronized calendar events and calendar sync status.")
    .setVersion("0.1.0")
    .addTag("events")
    .addTag("calendars")
    .addTag("calendar-auth")
    .addTag("auth")
    .addBearerAuth()
    .build();

  return SwaggerModule.createDocument(app, config);
}
