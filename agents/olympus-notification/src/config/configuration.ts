import {
  AmqpConfig,
  ConfigValidationError,
  EnvReader,
  LoggingConfig,
  readAmqpConfig,
  readLoggingConfig,
  readRuntimeConfig,
  RuntimeConfig,
} from "@ncfritz/olympus-nest";
import { ConfigType, registerAs } from "@nestjs/config";

export { ConfigValidationError };

export type OlympusConfig = {
  /** Base URL for SDK calls, including `/v1`. */
  apiBaseUrl: string;
  /** Socket.IO server that relays notifications to browsers. */
  webSocketHost: string;
};

export type SynologyMailConfig = {
  host: string;
  user: string;
  password?: string;
};

export type SynologyChatConfig = {
  host: string;
  /** Webhook tokens of the `olympus` destinations; unset skips them. */
  olympusBotToken?: string;
  olympusChannelToken?: string;
};

export type GmailConfig = {
  user: string;
  appPassword?: string;
};

export type AgentConfig = {
  runtime: RuntimeConfig;
  amqp: AmqpConfig;
  logging: LoggingConfig;
  olympus: OlympusConfig;
  synologyMail: SynologyMailConfig;
  synologyChat: SynologyChatConfig;
  gmail: GmailConfig;
};

/**
 * The agent's configuration from environment variables (see
 * dev.env.example).
 * @throws ConfigValidationError listing every invalid or missing variable
 */
export const readConfig = (
  env: Record<string, string | undefined>,
): AgentConfig => {
  const read = new EnvReader(env);
  const runtime = readRuntimeConfig(read, "olympus-notification-agent", 3100);
  const config: AgentConfig = {
    runtime,
    amqp: readAmqpConfig(read, "/dionysus-dev"),
    logging: readLoggingConfig(read, runtime.isProduction),
    olympus: {
      apiBaseUrl: read.string("API_BASE_URL", "http://localhost:3001/v1"),
      webSocketHost: read.string("WSS_HOST", "ws://localhost:3000"),
    },
    synologyMail: {
      host: read.string("SYNO_SMTP_HOST", "192.168.15.21"),
      user: read.string("SYNO_SMTP_USER", "ncfritz"),
      password: read.optional("SYNO_SMTP_PASSWORD"),
    },
    synologyChat: {
      host: read.string("SYNO_CHAT_HOST", "https://nfs02.sea.ncfritz.net"),
      olympusBotToken: read.optional("SYNO_CHAT_OLYMPUS_BOT_TOKEN"),
      olympusChannelToken: read.optional("SYNO_CHAT_OLYMPUS_CHANNEL_TOKEN"),
    },
    gmail: {
      user: read.string("GMAIL_USER", "ncfritz@ncfritz.net"),
      appPassword: read.optional("GMAIL_APP_PASSWORD"),
    },
  };
  if (read.problems.length) throw new ConfigValidationError(read.problems);
  return config;
};

/*
 * Typed configuration namespaces. Inject one with
 * `@Inject(olympusConfig.KEY) olympus: OlympusConfigType`.
 */
export const runtimeConfig = registerAs(
  "runtime",
  () => readConfig(process.env).runtime,
);
export const amqpConfig = registerAs(
  "amqp",
  () => readConfig(process.env).amqp,
);
export const olympusConfig = registerAs(
  "olympus",
  () => readConfig(process.env).olympus,
);
export const synologyMailConfig = registerAs(
  "synologyMail",
  () => readConfig(process.env).synologyMail,
);
export const synologyChatConfig = registerAs(
  "synologyChat",
  () => readConfig(process.env).synologyChat,
);
export const gmailConfig = registerAs(
  "gmail",
  () => readConfig(process.env).gmail,
);

export type RuntimeConfigType = ConfigType<typeof runtimeConfig>;
export type AmqpConfigType = ConfigType<typeof amqpConfig>;
export type OlympusConfigType = ConfigType<typeof olympusConfig>;
export type SynologyMailConfigType = ConfigType<typeof synologyMailConfig>;
export type SynologyChatConfigType = ConfigType<typeof synologyChatConfig>;
export type GmailConfigType = ConfigType<typeof gmailConfig>;

export const ALL_CONFIG = [
  runtimeConfig,
  amqpConfig,
  olympusConfig,
  synologyMailConfig,
  synologyChatConfig,
  gmailConfig,
];
