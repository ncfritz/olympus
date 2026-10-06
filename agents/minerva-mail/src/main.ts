import "source-map-support/register";

import {
  createClientCertificateListener,
  createWinstonLogger,
  reportBootstrapFailure,
} from "@ncfritz/olympus-nest";
import { Logger, VersioningType } from "@nestjs/common";
import { NestFactory, PartialGraphHost } from "@nestjs/core";
import { WinstonModule } from "nest-winston";
import { AppModule } from "./AppModule";
import type { ServicesRequest } from "./auth/ServicesOnlyGuard";
import { readConfig } from "./config/configuration";

const logger = new Logger("Bootstrap");

async function bootstrap(): Promise<void> {
  // Fails fast, listing every invalid variable, before anything connects.
  const config = readConfig(process.env);

  const app = await NestFactory.create(AppModule, {
    snapshot: true,
    abortOnError: false,
    logger: WinstonModule.createLogger({
      instance: createWinstonLogger(config.logging, config.runtime.appName),
    }),
  });

  app.enableVersioning({ type: VersioningType.URI });

  // The plain listener serves /metrics; everything else is refused there
  // (ServicesOnlyGuard).
  await app.listen(config.runtime.port);

  // The management API, for the Olympus API alone (ADR 0028's pattern):
  // linking mailboxes to Gmail. Unset, nothing can be linked.
  if (config.services) {
    createClientCertificateListener(app, config.services, {
      name: "ServicesListener",
      onRequest: (request) => {
        (request as ServicesRequest).listener = "services";
      },
    });
  } else {
    logger.warn(
      "No services listener: TLS_CERT, TLS_KEY and TLS_CA_SERVICES are unset, so no mailbox can be linked",
    );
  }
}

bootstrap()
  .then(() => {
    logger.log("Minerva mail agent bootstrap complete.");
  })
  .catch((e: unknown) => {
    reportBootstrapFailure(e, PartialGraphHost, logger);
    process.exit(1);
  });
