import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // A self-contained server for the Docker image (ADR 0019): `.next/standalone`
  // holds server.js and only the node_modules it needs.
  output: "standalone",
  // The workspace root, so tracing follows pnpm's links out of this package.
  outputFileTracingRoot: path.join(__dirname, "../../.."),
};

export default nextConfig;
