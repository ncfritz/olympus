# Every image Olympus builds (ADR 0011). Run from the repository root,
# where `docker buildx bake` finds this file:
#
#   docker buildx bake                               # all images, tag "dev", local names
#   docker buildx bake --load api                    # one image into the local image store
#   REGISTRY=registry.internal.ncfritz.net TAG=$(git rev-parse --short HEAD) \
#     GIT_REVISION=$(git rev-parse HEAD) docker buildx bake --builder olympus --push
#
# The push uses the `olympus` builder (infra/docker/README.md, Pushing):
# Docker's default builder can't build two platforms.
#
# Without REGISTRY the images are named olympus/<name>:<TAG>, which is what
# the laptop runs. The asset agent is also built for the NAS (amd64); to
# --load it on one machine, pass --set asset-agent.platform=linux/arm64.

variable "REGISTRY" {
  default = ""
}

variable "TAG" {
  default = "dev"
}

variable "GIT_REVISION" {
  default = "unknown"
}

function "image" {
  params = [name]
  result = [notequal(REGISTRY, "") ? "${REGISTRY}/olympus/${name}:${TAG}" : "olympus/${name}:${TAG}"]
}

group "default" {
  targets = ["services", "hasura", "rabbitmq"]
}

group "services" {
  targets = [
    "api", "notification-agent", "asset-agent", "metadata-agent", "search-agent",
    "minerva-calendar-agent", "minerva-calendar-console", "control",
  ]
}

# The Node services share one Dockerfile.
target "_node" {
  context    = "."
  dockerfile = "infra/docker/node/Dockerfile"
  platforms  = ["linux/arm64"]
  args = {
    GIT_REVISION = GIT_REVISION
  }
}

target "api" {
  inherits = ["_node"]
  args     = { APP = "@ncfritz/olympus-api" }
  tags     = image("api")
}

target "notification-agent" {
  inherits = ["_node"]
  args = {
    APP            = "@ncfritz/olympus-notification-agent"
    EXTRA_CA_CERTS = "/app/ca_roots.pem"
  }
  tags = image("notification-agent")
}

target "asset-agent" {
  inherits  = ["_node"]
  platforms = ["linux/arm64", "linux/amd64"]
  args = {
    APP              = "@ncfritz/dionysus-asset-agent"
    EXTRA_CA_CERTS   = "/app/ca_roots.pem"
    RUNTIME_PACKAGES = "ffmpeg handbrake"
  }
  tags = image("asset-agent")
}

target "metadata-agent" {
  inherits = ["_node"]
  args = {
    APP            = "@ncfritz/dionysus-metadata-agent"
    EXTRA_CA_CERTS = "/app/ca_roots.pem"
  }
  tags = image("metadata-agent")
}

target "search-agent" {
  inherits = ["_node"]
  args = {
    APP            = "@ncfritz/dionysus-search-agent"
    EXTRA_CA_CERTS = "/app/ca_roots.pem"
  }
  tags = image("search-agent")
}

target "minerva-calendar-agent" {
  inherits = ["_node"]
  args = {
    APP = "@ncfritz/minerva-calendar-sync-agent"
    # Prisma's client and query engine, for this image's platform.
    POST_DEPLOY      = "node node_modules/prisma/build/index.js generate --schema prisma/schema.prisma"
    RUNTIME_PACKAGES = "openssl"
  }
  tags = image("minerva-calendar-agent")
}

target "minerva-calendar-console" {
  context    = "."
  dockerfile = "infra/docker/next/Dockerfile"
  platforms  = ["linux/arm64"]
  args = {
    APP          = "@ncfritz/minerva-calendar-sync-console"
    APP_DIR      = "agents/minerva-calendar-sync/console"
    PORT         = "4392"
    GIT_REVISION = GIT_REVISION
    # Where the control host publishes this console (ADR 0021). Next bakes
    # basePath in; the console asks for its agent under the same path.
    NEXT_PUBLIC_BASE_PATH = "/minerva/calendar"
  }
  tags = image("minerva-calendar-console")
}

# The suite's index at the root of the control host (ADR 0021).
target "control" {
  context    = "."
  dockerfile = "infra/docker/next/Dockerfile"
  platforms  = ["linux/arm64"]
  args = {
    APP          = "@ncfritz/olympus-control"
    APP_DIR      = "apps/control"
    PORT         = "4390"
    GIT_REVISION = GIT_REVISION
  }
  tags = image("control")
}

target "hasura" {
  context    = "."
  dockerfile = "infra/docker/hasura/Dockerfile"
  platforms  = ["linux/arm64"]
  args       = { GIT_REVISION = GIT_REVISION }
  tags       = image("hasura")
}

target "rabbitmq" {
  context   = "infra/docker/rabbitmq"
  platforms = ["linux/arm64"]
  tags      = image("rabbitmq")
}
