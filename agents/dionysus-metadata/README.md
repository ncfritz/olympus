# dionysus-metadata-agents

[![Release](https://github.com/ncfritz/dionysus-metadata-agents/actions/workflows/release.yml/badge.svg)](https://github.com/ncfritz/dionysus-metadata-agents/actions/workflows/release.yml)

Asynchronous agents for fetching TMDB metadata and pushing it to Dionysus.  These agents use a multi-phase process for
queueing metadata sets and fetching metadata for individual TMDB entities.

1. **Batch Download/Enqueue** - The first step in the download process uses TMDB's
  [daily ID exports](https://developer.themoviedb.org/docs/daily-id-exports) to fetch the full set of entity IDs across 
  multiple TMDB data sets.  Each ID encountered is enqueued so the full set of metadata can be fetched.  This ID 
  download is intended to run on a daily or other regular cadence.  System TTLs provide an incremental fetch capability 
  to prevent overwhelming the TMDB API. 
  
    The set of entity types that are handled as batch downloads is as follows:
   * Production Companies
   * TV Networks
   * Collections
   * People
   * TV Series
   * Movies
1. **Entity Download** - As TMDB only provides ID based exports, we need to use their API to fetch the full details for 
  each entity.  This process utilizes TTL and jitter to provide fetch backoff to ensure that API limits are not breached
  and we are good tenants.  Each entity has an associated *MetadataFetchJob* in Dionysus which has a TTL and jitter
  associated with it.  Each run of the batch download process results in a fetch job notification being published for 
  each ID present in the data set.  This ensures that each entity is checked for freshness at a regular interval and 
  new entities are incrementally added to the data set.  As an entity is fetched, the metadata is persisted to Dionysus,
  the TTL and jitter for the entity calculated, and the values persisted to the *MetadataFetchJob*.  On subsequent runs, 
  the TTL and jitter are used to determine if an entity is stale - marking it for metadata re-fetch.  TTL and jitter 
  are calculated based on entity properties - i.e. release date for movies, whether a TV series or season has ended, 
  etc.  Entities that are likely to be updated are given a relatively short TTL of three days to two weeks, while older 
  entities are typically assigned a TTL of 30 to 90 days.
1. **Batch Export** - Some TMDB entities do not have ID exports but represent a largely static list that is served by 
  an API.  These entities are handled similarly to the batch download process, however, no messages for metadata 
  fetching are published as the entity metadata is persisted during the batch run.  The metadata handled in this 
  process are still assigned a *MetadataFetchJob* with a TTL and jitter.
    
    The set of entity types that are handled as batch exports is as follows:
    * Certifications
    * Countries
    * Genres
    * Keywords
    * Languages

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
          - localhost:13001
```

## Docker Image
The Docker image will expose port 3100 for metrics scraping.  Environment variables should be specified in 
`production.env`.

### Environment Variables
Environment variables are used to configure the NestJS modules that connect to various external data sources:

##### General
| Variable               | Usage                                                    | Default Value |
|------------------------|----------------------------------------------------------|---------------|
| LISTEN_PORT            | The port to listen on, this is where metrics are exposed | `3100`        |

##### Loki / Logging
| Variable               | Usage                                         | Default Value                 |
|------------------------|-----------------------------------------------|-------------------------------|
| LOKI_URL               | The URL of the Loki server to push logs to    |                               |
| LOKI_LOGGING_LEVEL     | The minimum log level to push to Loki         | `info`                        |
| ENABLE_CONSOLE_LOGGING | Whether to log to the console                 | `true` (dev) / `false` (prod) |
| CONSOLE_LOGGING_LEVEL  | The minimum log level to write to the console | `info`                        |
| FILE_LOGGING_ENABLED   | Whether to log to a file                      | `false` (dev) / `true` (prod) |
| FILE_LOGGING_LEVEL     | The minimum log level to write to a file      | `info`                        |
| FILE_LOGGING_PATH      | The path to write logs to                     | `./logs`                      |

##### AMQP - RabbitMQ
| Variable      | Usage                                        | Default Value   |
|---------------|----------------------------------------------|-----------------|
| AMQP_PROTOCOL | How to connect to the AMQP broker            | `amqp`          |
| AMQP_HOST     | The host, or container name running RabbitMQ | `localhost`     |
| AMQP_PORT     | The port to connect on                       | `5672`          |
| AMQP_USER     | The user to authenticate with                | `admin`         |
| AMQP_PASSWORD | The password to use                          | `admin`         |
| AMQP_VHOST    | The virtual host to use                      | `/dionysus-dev` |

##### Dionysus
| Variable            | Usage                                 | Default Value |
|---------------------|---------------------------------------|---------------|
| DIONYSUS_CACHE_PATH | The path to write the entity cache    |               |

##### Olympus
| Variable   | Usage                                              | Default Value            |
|------------|----------------------------------------------------|--------------------------|
| API_HOST   | The Olympus API host                               | `http://localhost:3001`  |              

##### TMDB
| Variable       | Usage                                          | Default Value |
|----------------|------------------------------------------------|---------------|
| TMDB_API_KEY   | The API key to use for accessing TMDB's APIs   |               |
