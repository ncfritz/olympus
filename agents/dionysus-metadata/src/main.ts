import { ValidationPipe } from "@nestjs/common";
import { NestFactory, PartialGraphHost } from "@nestjs/core";
import cookieParser from "cookie-parser";
import fs from "fs";
import moment from "moment";
import { WinstonModule } from "nest-winston";
import batchJobApi from "./api/batchJobApi";
import workflowApi from "./api/workflowApi";
import { PrometheusMetricsInterceptor } from "./middleware/PrometheusMetricsInterceptor";
import { AppModule } from "./module/AppModule";
import { getExecutions } from "./util/executionHolder";
import { logger } from "./util/logger";

import { onExit } from "signal-exit";
import { sendWorkflowNotification } from "./util/notification";

const timestamp = moment.utc();

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    snapshot: true,
    abortOnError: false,
    logger: WinstonModule.createLogger({
      instance: logger,
    }),
  });
  app.useGlobalPipes(new ValidationPipe());
  app.use(cookieParser());
  app.enableCors({
    origin: [
      "http://localhost:3000",
      "https://olympus.dev.ncfritz.net",
      "https://olympus.internal.ncfritz.net",
    ],
    credentials: true,
    methods: "GET,HEAD,PUT,PATCH,POST,DELETE",
  });
  app.useGlobalInterceptors(new PrometheusMetricsInterceptor());

  await app.listen(process.env.LISTEN_PORT || 3100);
}

bootstrap()
  .then(() => {
    logger.info("Installing signal handler...");
    onExit((code, signal) => {
      logger.error(
        `Exit handler triggered on signal ${signal} with code ${code}`,
      );
      (async () => {
        const outstandingTasks = getExecutions();
        logger.info(
          `${outstandingTasks.length} outstanding tasks, attempting graceful shutdown`,
        );

        for (const execution of outstandingTasks) {
          try {
            if (execution.type === "workflow") {
              await workflowApi.updateWorkflow(execution.id, {
                status: "failed",
              });
              await sendWorkflowNotification(execution.id, "failed");
            } else if (execution.type === "batch") {
              await batchJobApi.updateBatchJob(execution.id, {
                status: "failed",
              });
            }
          } catch (e) {
            logger.error(
              `Unable to finalize execution ${execution.type}/${execution.id}`,
              e,
            );
          }
        }
      })();
    });

    logger.info("🔥🔥🔥 Olympus Metadata Agent bootstrap complete.");
  })
  .catch((e) => {
    logger.error("🤯🤯🤯 Error during bootstrap!", e);

    fs.writeFileSync(
      `/logs/${timestamp.unix()}-graph.json`,
      PartialGraphHost.toString() ?? "",
    );
    process.exit(1);
  });
