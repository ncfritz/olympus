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
};

/** The media tools' executables. */
export type ToolsConfig = {
  ffmpegPath?: string;
  ffprobePath?: string;
  handbrakePath?: string;
};

/** SFTP credentials of a file server. */
export type SftpServer = {
  host?: string;
  username?: string;
  password?: string;
};

export type MediaConfig = {
  /** Where "local" deployments keep workflow files (LOCAL_DIRECTORY). */
  localDirectory?: string;
  /** Shared working directory of media workflows (STAGING_DIRECTORY). */
  stagingDirectory?: string;
  /** "local" copies workflow files instead of using the CDN. */
  deploymentMode: "local" | "remote";
  cdnBaseUrl?: string;
  /** Remove a transcode's working files when it ends. */
  transcodeCleanup: boolean;
  /** Keep uploads local instead of SFTP (DIONYSUS_SKIP_SSH_UPLOAD). */
  skipSshUpload: boolean;
  /** Copy uploads to the local directory (DIONYSUS_SKIP_CDN_DOWNLOAD). */
  skipCdnDownload: boolean;
  cdn: SftpServer;
  library: SftpServer;
};

export type DownloadsConfig = {
  nzbGeekApiKey?: string;
  nzbGet: {
    host: string;
    port: number;
    username?: string;
    password?: string;
  };
  /** Keep every NZBGet event as JSON in eventsDirectory. */
  persistEvents: boolean;
  eventsDirectory?: string;
};

export type ContentConfig = {
  assetsDir?: string;
  downloadDir?: string;
  tempDir?: string;
  sftp: SftpServer;
};

/** SOCKS proxy for content page requests. */
export type ProxyConfig = {
  host: string;
  port: string;
  username: string;
  password: string;
};

export type AgentConfig = {
  runtime: RuntimeConfig;
  amqp: AmqpConfig;
  logging: LoggingConfig;
  olympus: OlympusConfig;
  tools: ToolsConfig;
  media: MediaConfig;
  downloads: DownloadsConfig;
  content: ContentConfig;
  proxy: ProxyConfig;
};

const sftpServer = (read: EnvReader, prefix: string): SftpServer => ({
  host: read.optional(`${prefix}_HOST`),
  username: read.optional(`${prefix}_USERNAME`),
  password: read.optional(`${prefix}_PASSWORD`),
});

/**
 * The agent's configuration from environment variables (see
 * dev.env.example).
 * @throws ConfigValidationError listing every invalid or missing variable
 */
export const readConfig = (
  env: Record<string, string | undefined>,
): AgentConfig => {
  const read = new EnvReader(env);
  const runtime = readRuntimeConfig(read, "dionysus-asset-agent", 3102);
  const config: AgentConfig = {
    runtime,
    amqp: readAmqpConfig(read, "/dionysus"),
    logging: readLoggingConfig(read, runtime.isProduction),
    olympus: {
      apiBaseUrl: read.string("API_BASE_URL", "http://localhost:3001/v1"),
    },
    tools: {
      ffmpegPath: read.optional("FFMPEG_PATH"),
      ffprobePath: read.optional("FFPROBE_PATH"),
      handbrakePath: read.optional("HANDBRAKE_PATH"),
    },
    media: {
      localDirectory: read.optional("LOCAL_DIRECTORY"),
      stagingDirectory: read.optional("STAGING_DIRECTORY"),
      deploymentMode:
        read.optional("DEPLOYMENT_MODE") === "local" ? "local" : "remote",
      cdnBaseUrl: read.optional("DIONYSUS_CDN_BASE_URL"),
      transcodeCleanup: read.boolean("TRANSCODE_CLEANUP", false),
      skipSshUpload: read.boolean("DIONYSUS_SKIP_SSH_UPLOAD", false),
      skipCdnDownload: read.boolean("DIONYSUS_SKIP_CDN_DOWNLOAD", false),
      cdn: sftpServer(read, "DIONYSUS_CDN_SSH"),
      library: sftpServer(read, "DIONYSUS_LIBRARY_SSH"),
    },
    downloads: {
      nzbGeekApiKey: read.optional("NZBGEEK_API_KEY"),
      nzbGet: {
        host: read.string("NZBGET_HOST", "localhost"),
        port: read.port("NZBGET_PORT", 6789),
        username: read.optional("NZBGET_USERNAME"),
        password: read.optional("NZBGET_PASSWORD"),
      },
      persistEvents: read.boolean("PERSIST_EVENTS", false),
      eventsDirectory: read.optional("EVENTS_DIRECTORY"),
    },
    content: {
      assetsDir: read.optional("CONTENT_ASSETS_DIR"),
      downloadDir: read.optional("CONTENT_ASSETS_DOWNLOAD_DIR"),
      tempDir: read.optional("CONTENT_ASSETS_TEMP_DIR"),
      sftp: sftpServer(read, "CONTENT_SSH"),
    },
    proxy: {
      host: read.string("SOCKS_PROXY_HOST", ""),
      port: read.string("SOCKS_PROXY_PORT", "1080"),
      username: read.string("SOCKS_PROXY_USERNAME", ""),
      password: read.string("SOCKS_PROXY_PASSWORD", ""),
    },
  };
  if (read.problems.length) throw new ConfigValidationError(read.problems);
  return config;
};

/*
 * Typed configuration namespaces. Inject one with
 * `@Inject(mediaConfig.KEY) media: MediaConfigType`.
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
export const toolsConfig = registerAs(
  "tools",
  () => readConfig(process.env).tools,
);
export const mediaConfig = registerAs(
  "media",
  () => readConfig(process.env).media,
);
export const downloadsConfig = registerAs(
  "downloads",
  () => readConfig(process.env).downloads,
);
export const contentConfig = registerAs(
  "content",
  () => readConfig(process.env).content,
);
export const proxyConfig = registerAs(
  "proxy",
  () => readConfig(process.env).proxy,
);

export type RuntimeConfigType = ConfigType<typeof runtimeConfig>;
export type AmqpConfigType = ConfigType<typeof amqpConfig>;
export type OlympusConfigType = ConfigType<typeof olympusConfig>;
export type ToolsConfigType = ConfigType<typeof toolsConfig>;
export type MediaConfigType = ConfigType<typeof mediaConfig>;
export type DownloadsConfigType = ConfigType<typeof downloadsConfig>;
export type ContentConfigType = ConfigType<typeof contentConfig>;
export type ProxyConfigType = ConfigType<typeof proxyConfig>;

export const ALL_CONFIG = [
  runtimeConfig,
  amqpConfig,
  olympusConfig,
  toolsConfig,
  mediaConfig,
  downloadsConfig,
  contentConfig,
  proxyConfig,
];
