# olympus-api
The Olympis REST API

## Docker Image
The API can be run as a Docker container and will expose port 3000.

### Environment Vairables
Environment variables are used to configure the NestJS modules that 
connect to various external data sources:

##### General
| Variable            | Usage                                                                                                                                                                    | Default Value |
|---------------------|--------------------------------------------------------------------------------------------------------------------------------------------------------------------------|---------------|
| ENABLE_API_EXPLORER | Enables the Swagger explorer interface.  This MUST be set to `true` if `NODE_ENV` is `production`.  By default the explorer is disabled when running in production mode. |               |

##### Hasura
| Variable        | Usage                                      | Default Value |
|-----------------|--------------------------------------------|---------------|
| HASURA_PROTOCOL | How to connect to Hasura                   | `http`        |
| HASURA_HOST     | The host, or container name running Hasura | `localhost`   |
| HASURA_PORT     | The port to connect on                     | `8080`        |
| HASURA_PASSWORD | The admin password to use                  | `admin`       |

##### AMQP - RabbitMQ
| Variable      | Usage                                        | Default Value |
|---------------|----------------------------------------------|---------------|
| AMQP_PROTOCOL | How to connect to the AMQP broker            | `amqp`        |
| AMQP_HOST     | The host, or container name running RabbitMQ | `localhost`   |
| AMQP_PORT     | The port to connect on                       | `5672`        |
| AMQP_USER     | The user to authenticate with                | `admin`       |
| AMQP_PASSWORD | The password to use                          | `admin`       |
| AMQP_VHOST    | The virtual host to use                      | `/dionysus`   |