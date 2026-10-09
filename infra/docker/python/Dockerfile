# The Python services: Harpocrates's signer (ADR 0011, 0020). The build
# context is the repository root (see /.dockerignore); /docker-bake.hcl
# passes the project's directory and module.
#
# Everything happens on the image's own platform: the wheels (cryptography,
# argon2) are native, and there is no compile step to run natively first.

ARG PYTHON_VERSION=3.13
ARG UV_VERSION=0.12.13

FROM ghcr.io/astral-sh/uv:${UV_VERSION} AS uv

# ---- The locked production environment, then the project into it.
FROM python:${PYTHON_VERSION}-slim AS build
ARG APP_DIR
COPY --from=uv /uv /bin/uv
ENV UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    UV_PYTHON_DOWNLOADS=never \
    UV_PROJECT_ENVIRONMENT=/app/.venv
WORKDIR /src
RUN test -n "${APP_DIR}" || { echo "APP_DIR (the project's directory) is required" >&2; exit 1; }
# Dependencies first, so a source change reuses them.
COPY ${APP_DIR}/pyproject.toml ${APP_DIR}/uv.lock ${APP_DIR}/.python-version ./
RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --locked --no-dev --no-install-project
COPY ${APP_DIR}/src ./src
# Installed, not linked to /src: the runtime stage copies only the venv.
RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --locked --no-dev --no-editable

# ---- What runs.
FROM python:${PYTHON_VERSION}-slim AS runtime
# Owned by root and readable but not writable by the service: what it
# writes goes to volumes. A fixed id, so a volume's ownership can be set
# on the host.
RUN groupadd --system --gid 10001 service \
    && useradd --system --uid 10001 --gid service --no-create-home service \
    && install -d -o service -g service -m 0750 /run/service
# /run/service is where a service puts its sockets. A named volume mounted
# there starts as a copy of it, owner and mode included, so the service can
# bind in it and its group's members (another container, with group_add
# 10001) can reach what it binds.
COPY --from=build /app/.venv /app/.venv
ENV PATH=/app/.venv/bin:${PATH} \
    PYTHONUNBUFFERED=1
ARG MODULE
ENV MODULE=${MODULE}
USER service
# Over the Unix socket: there is no port to probe.
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
    CMD ["sh", "-c", "exec python -m \"$MODULE\" health"]
CMD ["sh", "-c", "exec python -m \"$MODULE\" serve"]

ARG APP_DIR
ARG GIT_REVISION=unknown
LABEL org.opencontainers.image.title="${APP_DIR}" \
      org.opencontainers.image.source="https://github.com/ncfritz/olympus" \
      org.opencontainers.image.revision="${GIT_REVISION}"
