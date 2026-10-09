import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The index is the control host's root, so it has no base path of its
  // own — unlike the consoles it lists (ADR 0021).
  transpilePackages: ["@ncfritz/olympus-console"],
  // `next dev` serves its scripts and HMR only to the hosts it knows; the
  // development control host (infra/docker/nginx/control-dev.conf) is one.
  // Without it the page renders and never hydrates.
  allowedDevOrigins: ["control.olympus.dev.ncfritz.net"],
  output: "standalone",
  outputFileTracingRoot: path.join(__dirname, "../.."),
};

export default nextConfig;
