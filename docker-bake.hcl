# Every image Olympus builds (ADR 0011). Run from the repository root,
# where `docker buildx bake` finds this file:
#
#   docker buildx bake                               # all images, tag "dev", local names
#   docker buildx bake --load api                    # one image into the local image store
#   REGISTRY=<registry> TAG=$(git rev-parse --short HEAD) \
#     GIT_REVISION=$(git rev-parse HEAD) docker buildx bake --push
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
  targets = ["api", "notification-agent", "asset-agent", "metadata-agent", "search-agent"]
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
