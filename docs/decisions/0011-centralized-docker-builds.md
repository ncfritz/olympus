# 0011. Build all images centrally on the Mac Mini

- **Status:** Accepted
- **Date:** 2026-09-18

## Context

Most images deploy to Docker on an M2 Mac Mini (arm64). One deploys to an
Intel Synology NAS (amd64), and building on the NAS is slow.

## Decision

- **Build everything on the Mac Mini** with `docker buildx bake` and a
  `docker-bake.hcl` in `infra/docker/` listing every image and its
  platform.
- **Cross-platform without full emulation.** Install and compile stages use
  `FROM --platform=$BUILDPLATFORM`, so TypeScript builds natively on arm64.
  Only the runtime stage targets `linux/amd64` for the NAS. Native modules
  (sharp, bcrypt, Prisma engines) are installed in the target-platform
  stage.
- **Small contexts.** `turbo prune <app> --docker`; Next.js
  `output: "standalone"`; `pnpm deploy --filter <app> --prod` for Nest apps.
- **Distribution** through a local registry (`registry:2`) on the Mac Mini
  with a certificate from the internal CA. Hosts pull from it.
- **Deployment** with Docker contexts over SSH and one compose file per
  host.

## Open

- Whether a self-hosted GitHub Actions runner on the Mac Mini triggers
  builds automatically.
- Registry hostname and storage location.
