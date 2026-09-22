import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Where this console is published under the control host (ADR 0021),
  // baked in at build time because `basePath` is a build-time setting.
  // Empty in the workspace, so `pnpm dev` still serves it at the root.
  basePath: process.env.NEXT_PUBLIC_BASE_PATH || "",
  // The control shell is "use client" React consumed as source.
  transpilePackages: ["@ncfritz/olympus-console"],
  // A self-contained server for the Docker image (ADR 0019): `.next/standalone`
  // holds server.js and only the node_modules it needs.
  output: "standalone",
  // The workspace root, so tracing follows pnpm's links out of this package.
  outputFileTracingRoot: path.join(__dirname, "../../.."),
};

export default nextConfig;
