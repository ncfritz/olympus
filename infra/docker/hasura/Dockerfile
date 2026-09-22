# Hasura with the schema it serves (ADR 0019): the repository's migrations
# and metadata are part of the image, and the engine's cli-migrations
# entrypoint applies them on start. Deploying an image is deploying its
# schema. The build context is the repository root.

ARG HASURA_VERSION=v2.39.1

FROM hasura/graphql-engine:${HASURA_VERSION}.cli-migrations-v3

COPY infra/hasura/migrations /hasura-migrations
COPY infra/hasura/metadata /hasura-metadata
COPY --chmod=755 infra/docker/hasura/entrypoint.sh /usr/local/bin/olympus-entrypoint.sh

ENTRYPOINT ["/usr/local/bin/olympus-entrypoint.sh"]
CMD ["graphql-engine", "serve"]

ARG GIT_REVISION=unknown
LABEL org.opencontainers.image.title="olympus-hasura" \
      org.opencontainers.image.source="https://github.com/ncfritz/olympus" \
      org.opencontainers.image.revision="${GIT_REVISION}"
