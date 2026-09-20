# dionysus-asset-agents

`@ncfritz/dionysus-asset-agents`, imported from the dionysus-asset-agents
repository with its history.

Asynchronous agents for content and media asset handling. These agents support Dionysus workflows for fetching and
transcoding assets. When dealing with media assets, the storage of the asset blobs is generally separated from the
asynchronous processing agents, however, when dealing directly with the asset, the agents need to be deployed alongside
the storage. These agent's handlers can be disabled on a case-by-case basis using the `DISABLE_XXX_HANDLER`
environment variables.

### Available Handlers:

| Handler                                          | Description                                                                                      | Default Value |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------ | ------------- |
| DISABLE_CONTENT_DELETION_HANDLER                 | Handles deletion of content assets/metadata at the library level                                 | `true`        |
| DISABLE_CONTENT_HLS_HANDLER                      | Generates HLS segemnts for progressive streaming                                                 | `true`        |
| DISABLE_CONTENT_THUMBNAIL_HANDLER                | Generates thumbnails for content assets                                                          | `true`        |
| DISABLE_CONTENT_RAW_INGESTION_HANDLER            | Handles the full content asset workflow from download to transcode                               | `false`       |
| DISABLE_DIONYSUS_METADATA_HANDLER                | Extracts metadata from a media asset source or transcode                                         | `false`       |
| DISABLE_DIONYSUS_XCODE_PRE_CONFIGURATION_HANDLER | Attempts to detect audio/subtitle tracks from source media asset                                 | `false`       |
| DISABLE_DIONYSUS_XCODE_CONFIGURATION_HANDLER     | Generates a Handbrake CLI input JSON file for the transcode                                      | `false`       |
| DISABLE_DIONYSUS_XCODE_HANDLER                   | Tuns the actual media asset transcode                                                            | `false`       |
| DISABLE_DIONYSUS_VERIFY_XCODE_HANDLER            | When the transcode is manually configured, generates samples for verification proir to transcode | `false`       |
| DISABLE_DIONYSUS_CLEANUP_HANDLER                 | Cleans up a media asset workflow's artifacts                                                     | `false`       |
| DISABLE_DIONYSUS_DELETE_MEDIA_WORKFLOW_HANDLER   | Removed workflow staging artifacts                                                               | `false`       |
| DISABLE_DIONYSUS_START_DOWNLOAD_HANDLER,         | Downloads NZB metadata and enqueues a mmedia asset for download using NzbGet                     | `false`       |
| DISABLE_DIONYSUS_DOWNLOAD_UPDATE_HANDLER,        | Handles updates from NzbGet                                                                      | `false`       |
| DISABLE_DIONYSUS_DOWNLOAD_STATUS_HANDLER,        | Periodically polls for downloads in NzbGet and persists their status to the database             | `false`       |

## Development

Run from the repository root (`pnpm install` once):

- `pnpm --filter @ncfritz/dionysus-asset-agents dev`: watch mode,
  environment from `dev.env` (`dev:local` reads `local.env`).
- `pnpm --filter @ncfritz/dionysus-asset-agents build`, then `start` /
  `start:local` / `start:prod`.

Copy `dev.env.example` to `dev.env` (git-ignored) and fill in the values.
FFmpeg and HandBrakeCLI must be installed (`FFMPEG_PATH`, `FFPROBE_PATH`,
`HANDBRAKE_PATH`); `sharp` is a native module built at install.

## Layout

```
src/
  main.ts, AppModule.ts       handlers switched off by DISABLE_<HANDLER>
  config/configuration.ts     typed, validated configuration (see below)
  messaging.ts                queues, subscriptions and channel prefetch;
                              routes and payloads from @ncfritz/olympus-messages
  infra/                      RabbitModule, ProxyHttpModule (SOCKS)
  api/                        OlympusApiModule: ContentApi, MediaApi,
                              MetadataApi, NotificationApi
  tools/                      ToolsModule: Handbrake (HandBrakeCLI), FFmpeg
                              paths; HandBrake scan and job file types
  content/                    ContentModule: handlers/ (raw ingestion, HLS,
                              thumbnails, deletion), services/
                              (AssetWorkflow, ContentReporter),
                              extractors/ (one per site, local files)
  media/                      MediaModule: handlers/ (metadata, transcode
                              configuration and verification, transcode,
                              cleanup, deletion), services/ (MediaWorkflow,
                              MediaReporter), planning/ (pure: track
                              selection, HandBrake job, samples, library
                              paths)
  downloads/                  DownloadsModule: start and NZBGet update
                              handlers, DownloadStatusPoller, NZBGeek and
                              NZBGet clients, nzb/ (NZB parser)
```

`pnpm --filter @ncfritz/dionysus-asset-agents test` runs the unit and
convention tests.

> The Dockerfile still expects the pre-monorepo layout (npm, GitHub
> Packages token). It is rebuilt with the Docker work in ADR 0011.

## Docker Image

This project ships with a `Dockerfile` for building a docker image. Because some requirements are hosted in a private
GitHub NPM repository, you will need to supply a `github_token` build argument so the builder can pull the required
dependencies.

To build the Docker image, run the following command:

```aiignore
docker build . --tag ncfritz/dionysus-asset-agents:latest --build-arg github_token=<your_github_token>
```

```bash
docker build --build-arg github_token=<your_github_token> -t dionysus-asset-agent .
```

## Monitoring

These agents expose Prometheus metrics at `/metrics`: Node's memory, event loop and GC
statistics, and `http_client_request_duration_seconds` for their calls to the Olympus API and
other services (ADR 0017). As sample Prometheus scrape configuration is as follows:

```yaml
scrape_configs:
  - job_name: nodejs
    metrics_path: /metrics
    params:
      module: [http_2xx]
    static_configs:
      - targets:
          - localhost:13007
```

## Docker Image

The Docker image will expose port 3100 for metrics scraping. Environment variables should be specified in
`production.env`.

### Environment Variables

Environment variables are used to configure the NestJS modules that connect to various external data sources:

##### General

| Variable    | Usage                                                    | Default Value |
| ----------- | -------------------------------------------------------- | ------------- |
| LISTEN_PORT | The port to listen on, this is where metrics are exposed | `3100`        |

##### Loki / Logging

| Variable               | Usage                                         | Default Value                 |
| ---------------------- | --------------------------------------------- | ----------------------------- |
| LOKI_URL               | The URL of the Loki server to push logs to    |                               |
| LOKI_LOGGING_LEVEL     | The minimum log level to push to Loki         | `info`                        |
| ENABLE_CONSOLE_LOGGING | Whether to log to the console                 | `true` (dev) / `false` (prod) |
| CONSOLE_LOGGING_LEVEL  | The minimum log level to write to the console | `info`                        |
| FILE_LOGGING_ENABLED   | Whether to log to a file                      | `false` (dev) / `true` (prod) |
| FILE_LOGGING_LEVEL     | The minimum log level to write to a file      | `info`                        |
| FILE_LOGGING_PATH      | The path to write logs to                     | `./logs`                      |

##### AMQP - RabbitMQ

| Variable      | Usage                                        | Default Value   |
| ------------- | -------------------------------------------- | --------------- |
| AMQP_PROTOCOL | How to connect to the AMQP broker            | `amqp`          |
| AMQP_HOST     | The host, or container name running RabbitMQ | `localhost`     |
| AMQP_PORT     | The port to connect on                       | `5672`          |
| AMQP_USER     | The user to authenticate with                | `admin`         |
| AMQP_PASSWORD | The password to use                          | `admin`         |
| AMQP_VHOST    | The virtual host to use                      | `/dionysus-dev` |

##### NordVPN/SOCKS

When downloading content assets, a SOCKS proxy is used for anonymity. NordVPN provides multiple SOCKS proxies that
can be used:

1. `nl.socks.nordhold.net`
1. `se.socks.nordhold.net`
1. `us.socks.nordhold.net`
1. `amsterdam.nl.socks.nordhold.net`
1. `atlanta.us.socks.nordhold.net`
1. `chicago.us.socks.nordhold.net`
1. `dallas.us.socks.nordhold.net`
1. `los-angeles.us.socks.nordhold.net`
1. `new-york.us.socks.nordhold.net`
1. `phoenix.us.socks.nordhold.net`
1. `san-francisco.us.socks.nordhold.net`
1. `stockholm.se.socks.nordhold.net`

| Variable             | Usage                                                       | Default Value            |
| -------------------- | ----------------------------------------------------------- | ------------------------ |
| SOCKS_PROXY_HOST     | The SOCKS proxy host to use when downloading content assets | none: requests go direct |
| SOCKS_PROXY_PORT     | The SOCKS proxy port to use when downloading content assets | `1080`                   |
| SOCKS_PROXY_USERNAME | The username to authenticate to the proxy with              |                          |
| SOCKS_PROXY_PASSWORD | The password to authenticate to the proxy with              |                          |

##### SSH configuration

| Variable                      | Usage                                                       | Default Value |
| ----------------------------- | ----------------------------------------------------------- | ------------- |
| CONTENT_SSH_HOST              | The SSH host to use when uploading content assets           |               |
| CONTENT_SSH_USERNAME          | The username to use when uploading content assets           |               |
| CONTENT_SSH_PASSWORD          | The password to authenticate to the SSH host with           |               |
| DIONYSUS_LIBRARY_SSH_HOST     | The SSH host to use when uploading/downloading media assets |               |
| DIONYSUS_LIBRARY_SSH_USERNAME | The username to use when uploading/downloading media assets |               |
| DIONYSUS_LIBRARY_SSH_PASSWORD | The password to use when uploading/downloading media assets |               |
| DIONYSUS_CDN_SSH_HOST         | The SSH host to use when uploading media asset artifacts    |               |
| DIONYSUS_CDN_SSH_USERNAME     | The username to use when uploading media asset artifacts    |               |
| DIONYSUS_CDN_SSH_PASSWORD     | The password to use when uploading media asset artifacts    |               |

##### Dionysus

| Variable                    | Usage                                                         | Default Value |
| --------------------------- | ------------------------------------------------------------- | ------------- |
| LOCAL_DIRECTORY             | The path to write the entity cache                            |               |
| PERSIST_EVENTS              | The path to write the entity cache                            |               |
| STAGING_DIRECTORY           | The path to write the entity cache                            |               |
| FFMPEG_PATH                 | The path to the `ffmpeg` binary                               |               |
| FFPROBE_PATH                | The path to the `ffprobe` binary                              |               |
| HANDBRAKE_PATH              | The path to the `HandbrakeCLI` binary                         |               |
| DEPLOYMENT_MODE             | Whether to run locally or in remote mode                      | `local`       |
| DIONYSUS_CDN_BASE_URL       | The path to write the entity cache                            |               |
| DIONYSUS_SKIP_SSH_UPLOAD    | When `true`, does not upload assets via SSH                   | `false`       |
| DIONYSUS_SKIP_CDN_DOWNLOAD  | When `true`, does not upload asset artifacts to the CDN       | `false`       |
| CONTENT_ASSETS_DIR          | The path to write transcoded assets and their metadata to     |               |
| CONTENT_ASSETS_DOWNLOAD_DIR | The path to write content downloads to                        |               |
| CONTENT_ASSETS_TEMP_DIR     | The path to use for temp storage when handling content assets |               |

##### Olympus

| Variable     | Usage                                   | Default Value              |
| ------------ | --------------------------------------- | -------------------------- |
| API_BASE_URL | Base URL for SDK calls, including `/v1` | `http://localhost:3001/v1` |

##### NzbGeek/NzbGet

| Variable        | Usage                                             | Default Value |
| --------------- | ------------------------------------------------- | ------------- |
| NZBGEEK_API_KEY | The API key to use when authenticating to NzbGeek |               |
| NZBGET_HOST     | The NzbGet host to enqueue downloads with         | `localhost`   |
| NZBGET_PORT     | The port NzbGet is listening on                   | `6789`        |
| NZBGET_USERNAME | The username to authenticate to NzbGet with       |               |
| NZBGET_PASSWORD | The password to authenticate to NzbGet with       |               |
