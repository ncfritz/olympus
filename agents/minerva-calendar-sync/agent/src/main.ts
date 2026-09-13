import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import * as cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { buildOpenApiDocument } from './openapi';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const webAppUrl = app.get(ConfigService).get<string>('WEB_APP_URL');
  if (webAppUrl) {
    app.enableCors({ origin: webAppUrl, credentials: true });
  }

  app.use(cookieParser());
  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true }));

  const document = buildOpenApiDocument(app, new DocumentBuilder());
  SwaggerModule.setup('api/docs', app, document);

  await app.listen(3000);
}
bootstrap();
