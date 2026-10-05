# Minerva mail's classifier (ADR 0030), the one Python service. Built
# centrally with the rest (ADR 0011): /docker-bake.hcl's minerva-mail-ml
# target, with this directory as the context.

ARG PYTHON_VERSION=3.13
ARG UV_VERSION=0.11.32

FROM ghcr.io/astral-sh/uv:${UV_VERSION} AS uv

# ---- Dependencies, then the project, into /app/.venv from the lockfile.
FROM python:${PYTHON_VERSION}-slim AS build
COPY --from=uv /uv /bin/uv
ENV UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    UV_PYTHON_DOWNLOADS=never
WORKDIR /app
# The lockfile first, so a source change reuses the dependency layer.
COPY pyproject.toml uv.lock ./
RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --frozen --no-dev --no-install-project
COPY src ./src
RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --frozen --no-dev --no-editable

# ---- What runs.
FROM python:${PYTHON_VERSION}-slim AS runtime
ENV PATH="/app/.venv/bin:${PATH}" \
    PYTHONUNBUFFERED=1
WORKDIR /app
# Owned by root and readable but not writable by the service: what it
# writes (the feature store, from phase 3) goes to a volume.
COPY --from=build /app/.venv /app/.venv
RUN useradd --system --uid 10001 --no-create-home mailml
USER mailml
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
    CMD python -c "import os, urllib.request; urllib.request.urlopen(f'http://127.0.0.1:{os.environ.get(\"LISTEN_PORT\", \"3106\")}/health', timeout=4)" || exit 1
CMD ["minerva-mail-ml"]

ARG GIT_REVISION=unknown
LABEL org.opencontainers.image.title="minerva-mail-ml" \
      org.opencontainers.image.source="https://github.com/ncfritz/olympus" \
      org.opencontainers.image.revision="${GIT_REVISION}"
