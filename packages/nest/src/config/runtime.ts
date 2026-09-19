import type { EnvReader } from "./EnvReader";

export type RuntimeConfig = {
  /** NODE_ENV (development when unset). */
  nodeEnv: string;
  isProduction: boolean;
  /** Service name in logs and metric labels (APP_NAME). */
  appName: string;
  /** LISTEN_PORT: HTTP routes, metrics. */
  port: number;
};

/**
 * NODE_ENV, APP_NAME and LISTEN_PORT. The app name defaults to `name`, with
 * `-<NODE_ENV>` appended outside production.
 */
export const readRuntimeConfig = (
  read: EnvReader,
  name: string,
  defaultPort: number,
): RuntimeConfig => {
  const nodeEnv = read.string("NODE_ENV", "development");
  const isProduction = nodeEnv === "production";
  return {
    nodeEnv,
    isProduction,
    appName: read.string(
      "APP_NAME",
      `${name}${isProduction ? "" : `-${nodeEnv}`}`,
    ),
    port: read.port("LISTEN_PORT", defaultPort),
  };
};
