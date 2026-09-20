import { Logger } from "@nestjs/common";

// The agent logs through Nest's Logger; TEST_NEST_LOGS=1 shows the output.
if (!process.env.TEST_NEST_LOGS) {
  Logger.overrideLogger(false);
}
