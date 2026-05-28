# Install dependencies only when needed
FROM node:26-alpine AS base

# Set up build to allow pulling from GitHub NPM repos
ARG github_token
ENV GITHUB_TOKEN=$github_token

RUN echo registry=https://registry.npmjs.org/ >> ~/.npmrc
RUN echo @ncfritz:registry=https://npm.pkg.github.com/ >> ~/.npmrc
RUN echo //npm.pkg.github.com/:_authToken=$GITHUB_TOKEN >> ~/.npmrc

# Install dependencies needed for a full build of the dependencies.
# We need to allow the postinstall scripts to run so native bindings are
# generated for better-sqlite3 (among others) and Alpine doesn't have the
# needed requirements by default.
RUN apk update
RUN apk upgrade
RUN apk add --no-cache pnpm
RUN apk add --no-cache python3 make gcc libc-dev g++ make py3-pip

# Install dependencies only when needed
FROM base AS deps
WORKDIR /app

# Install dependencies based on the preferred package manager
COPY package.json package-lock.json* ./
RUN npm ci

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NEXT_TELEMETRY_DISABLED=1

RUN npm run build

# Production image, copy all the files and run next
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nestjs

COPY --chown=nestjs:nodejs --from=builder /app/node_modules ./node_modules
COPY --chown=nestjs:nodejs . .

RUN npm run build

# Running `npm ci` removes the existing node_modules directory and passing in
# --omit=dev ensures that only the production dependencies are installed.
# This ensures that the node_modules directory is as optimized as possible
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force

# For dependencies that require scripts to be run diring the install process
# rebuild them directly after installation to generate any node bindings
# that they require
RUN npm rebuild better-sqlite3

USER root

ENV NODE_EXTRA_CA_CERTS=./ca_roots.pem

EXPOSE 3100

CMD ["node", "--env-file=production.env", "dist/main.js"]

