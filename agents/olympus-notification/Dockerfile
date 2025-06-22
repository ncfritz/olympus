# Install dependencies only when needed
FROM node:20-alpine AS base

# Set up build to allow pulling from GitHub NPM repos
ARG github_token
ENV GITHUB_TOKEN=$github_token

RUN echo registry=https://registry.npmjs.org/ >> ~/.npmrc
RUN echo @ncfritz:registry=https://npm.pkg.github.com/ >> ~/.npmrc
RUN echo //npm.pkg.github.com/:_authToken=$GITHUB_TOKEN >> ~/.npmrc

# Install FFMPEG
RUN apk update
RUN apk upgrade
RUN apk add --no-cache ffmpeg

# Install dependencies only when needed
FROM base AS deps
WORKDIR /app

# Install dependencies based on the preferred package manager
COPY package.json package-lock.json* ./
RUN npm ci --ignore-scripts

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NEXT_TELEMETRY_DISABLED 1

RUN npm run build

# Production image, copy all the files and run next
FROM base AS runner
WORKDIR /app

ENV NODE_ENV production
ENV NEXT_TELEMETRY_DISABLED 1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nestjs

COPY --chown=nestjs:nodejs --from=builder /app/node_modules ./node_modules
COPY --chown=nestjs:nodejs . .

RUN npm run build

# Running `npm ci` removes the existing node_modules directory and passing in
# --only=production ensures that only the production dependencies are installed.
# This ensures that the node_modules directory is as optimized as possible
RUN npm ci --only=production --ignore-scripts && npm cache clean --force

USER nestjs

EXPOSE 3100

CMD node dist/main.js 

