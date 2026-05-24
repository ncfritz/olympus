# dionysus-asset-agents

[![Release](https://github.com/ncfritz/dionysus-asset-agents/actions/workflows/release.yml/badge.svg)](https://github.com/ncfritz/dionysus-asset-agents/actions/workflows/release.yml)

Asynchronous agents for content and media asset handling.  These agents support Dionysus workflows for fetching and
transcoding assets.  When dealing with media assets, the storage of the asset blobs is generally separated from the 
asynchronous processing agents, however, when dealing directly with the asset, the agents need to be deployed alongside
the storage.  These agent's handlers can be disabled on a case-by-case basis using the `DISABLE_XXX_HANDLER`
environment variables.

### Available habndlers:
| Handler                                          | Description                                                                                      | Default Value |
|--------------------------------------------------|--------------------------------------------------------------------------------------------------|---------------|
| DISABLE_CONTENT_DELETION_HANDLER                 | Handles deletion of content assets/metadata at the library level                                 | true          |
| DISABLE_CONTENT_HLS_HANDLER                      | Generates HLS segemnts for progressive streaming                                                 | true          |
| DISABLE_CONTENT_THUMBNAIL_HANDLER                | Generates thumbnails for content assets                                                          | true          |
| DISABLE_CONTENT_RAW_INGESTION_HANDLER            | Handles the full content asset workflow from download to transcode                               | false         |
| DISABLE_DIONYSUS_METADATA_HANDLER                | Extracts metadata from a media asset source or transcode                                         | false         |
| DISABLE_DIONYSUS_XCODE_PRE_CONFIGURATION_HANDLER | Attempts to detect audio/subtitle tracks from source media asset                                 | false         |
| DISABLE_DIONYSUS_XCODE_CONFIGURATION_HANDLER     | Generates a Handbrake CLI input JSON file for the transcode                                      | false         |
| DISABLE_DIONYSUS_XCODE_HANDLER                   | Tuns the actual media asset transcode                                                            | false         |
| DISABLE_DIONYSUS_VERIFY_XCODE_HANDLER            | When the transcode is manually configured, generates samples for verification proir to transcode | false         |
| DISABLE_DIONYSUS_CLEANUP_HANDLER                 | Cleans up a media asset workflow's artifacts                                                     | false         |
| DISABLE_DIONYSUS_START_DOWNLOAD_HANDLER,         | Downloads NZB metadata and enqueues a mmedia asset for download using NzbGet                     | false         |
| DISABLE_DIONYSUS_DOWNLOAD_UPDATE_HANDLER,        | Handles updates from NzbGet                                                                      | false         |
| DISABLE_DIONYSUS_DOWNLOAD_STATUS_HANDLER,        | Periodically polls for downloads in NzbGet and persists their status to the database             | false         |
| DISABLE_TEST_HANDLER                             | Generic handler for testing purposes                                                             | true          |

## Development
* `npm run dev` - Starts the development server (watched for changes).  Environment variables are populated from
  `dev.env`
* `npm run dev:local` - Starts the development server (watched for changes).  Environment variables are populated from
  `local.env`
* `npm run start` - Starts the development server.  Environment variables are populated from
  `dev.env`
* `npm run start:local` - Starts the development server.  Environment variables are populated from
  `local.env`

## Monitoring
These agents expose a Prometheus metrics endpoint at `/metrics/` providing basic NodeJS memory, loop timing, and GC
statistics.  As sample Prometheus scrape configuration is as follows:

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
The Docker image will expose port 13007 for metrics scraping.  Environment variables should be specified in 
`production.env`.

### Environment Variables
Environment variables are used to configure the NestJS modules that connect to various external data sources:

##### Loki / Logging
| Variable               | Usage                                                    | Default Value |
|------------------------|----------------------------------------------------------|---------------|
| LOKI_URL               | The URL of the Loki server to push logs to               |               |
| LOKI_LEVEL             | The minimum log level to push to Loki                    | `debug`       |
| ENABLE_CONSOLE_LOGGING | Whether to log to the console                            | `true`        |
| CONSOLE_LOGGING_LEVEL  | The minimum log level to write to the console            | `debug`       |
| LISTEN_PORT            | The port to listen on, this is where metrics are exposed | `13007`       |

##### AMQP - RabbitMQ
| Variable      | Usage                                        | Default Value   |
|---------------|----------------------------------------------|-----------------|
| AMQP_PROTOCOL | How to connect to the AMQP broker            | `amqp`          |
| AMQP_HOST     | The host, or container name running RabbitMQ | `localhost`     |
| AMQP_PORT     | The port to connect on                       | `5672`          |
| AMQP_USER     | The user to authenticate with                | `admin`         |
| AMQP_PASSWORD | The password to use                          | `admin`         |
| AMQP_VHOST    | The virtual host to use                      | `/dionysus-dev` |

##### NordVPN/SOCKS
When downloading content assets, a SOCKS proxy is used for anonymity.  NordVPN provides multiple SOCKS proxies that
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

| Variable             | Usage                                                       | Default Value                       |
|----------------------|-------------------------------------------------------------|-------------------------------------|
| SOCKS_PROXY_HOST     | The SOCKS proxy host to use when downloading content assets | `los-angeles.us.socks.nordhold.net` |
| SOCKS_PROXY_PORT     | The SOCKS proxy port to use when downloading content assets | 1080                                |
| SOCKS_PROXY_USERNAME | The username to authenticate to the proxy with              |                                     |
| SOCKS_PROXY_PASSWORD | The password to authenticate to the proxy with              |                                     |

##### SSH configuration
| Variable                      | Usage                                                       | Default Value |
|-------------------------------|-------------------------------------------------------------|---------------|
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
|-----------------------------|---------------------------------------------------------------|---------------|
| LOCAL_DIRECTORY             | The path to write the entity cache                            |               |
| STAGING_DIRECTORY           | The path to write the entity cache                            |               |
| FFMPEG_PATH                 | The path to the `ffmpeg` binary                               |               |
| FFPROBE_PATH                | The path to the `ffprobe` binary                              |               |
| HANDBRAKE_PATH              | The path to the `HandbrakeCLI` binary                         |               |
| DEPLOYMENT_MODE             | Whether to run locally or in remote mode                      | local         |
| DIONYSUS_CDN_BASE_URL       | The path to write the entity cache                            |               |
| DIONYSUS_SKIP_SSH_UPLOAD    | When `true`, does not upload assets via SSH                   | false         |
| DIONYSUS_SKIP_CDN_DOWNLOAD  | When `true`, does not upload asset artifacts to the CDN       | false         |
| CONTENT_ASSETS_DIR          | The path to write transcoded assets and their metadata to     |               |
| CONTENT_ASSETS_DOWNLOAD_DIR | The path to write content downloads to                        |               |
| CONTENT_ASSETS_TEMP_DIR     | The path to use for temp storage when handling content assets |               |


##### Olympus
| Variable       | Usage                                          | Default Value |
|----------------|------------------------------------------------|---------------|
| API_BASE_URL   | The API key to use for accessing TMDB's APIs   |               |
