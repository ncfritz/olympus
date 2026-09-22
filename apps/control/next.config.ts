import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The index is the control host's root, so it has no base path of its
  // own — unlike the consoles it lists (ADR 0021).
  transpilePackages: ["@ncfritz/olympus-console"],
  output: "standalone",
  outputFileTracingRoot: path.join(__dirname, "../.."),
};

export default nextConfig;
