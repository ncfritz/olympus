import { Logger } from "@nestjs/common";

// TMDB dates ("1999-03-31") are parsed in local time; test in UTC.
process.env.TZ = "UTC";

// Handlers log through Nest's Logger; TEST_NEST_LOGS=1 shows the output.
if (!process.env.TEST_NEST_LOGS) {
  Logger.overrideLogger(false);
}
