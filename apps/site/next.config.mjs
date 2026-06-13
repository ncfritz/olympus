import { RsdoctorWebpackPlugin } from "@rsdoctor/webpack-plugin";
import CopyPlugin from "copy-webpack-plugin";
import path from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";
import packageJson from "./package.json" with { type: "json" };

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/** @type {import('next').NextConfig} */
const nextConfig = {
  env: {
    version: packageJson.version,
  },
  allowedDevOrigins: ["olympus.dev.ncfritz.net", "olympus.local"],
  output: "standalone",
  // Disable this to prevent double rendering of effects - this may be helpful to detect side effects
  // but can also introduce side effects depending on how state management is coupled with effects.
  reactStrictMode: false,
  eslint: {
    ignoreDuringBuilds: true,
  },
  transpilePackages: [
    "react-country-flag",
    "antd",
    "@ant-design/plots",
    "@ant-design/icons",
    "@ant-design/icons-svg",
    "@ant-design/pro-components",
    "@ant-design/pro-layout",
    "@ant-design/pro-list",
    "@ant-design/pro-descriptions",
    "@ant-design/pro-form",
    "@ant-design/pro-skeleton",
    "@ant-design/pro-field",
    "@ant-design/pro-utils",
    "@ant-design/pro-provider",
    "@ant-design/pro-card",
    "@ant-design/pro-table",
    "@deck.gl/core",
    "@deck.gl/extensions",
    "@deck.gl/geo-layers",
    "@deck.gl/google-maps",
    "@deck.gl/layers",
    "@deck.gl/mesh-layers",
    "@deck.gl/react",
    "plyr",
    "plyr-react",
    "rc-pagination",
    "rc-picker",
    "rc-util",
    "rc-table",
    "rc-tree",
    "rc-tooltip",
    "react-syntax-highlighter",
  ],
  webpack: (
    config,
    { buildId, dev, isServer, defaultLoaders, nextRuntime, webpack },
  ) => {
    const fileLoaderRule = config.module.rules.find((rule) =>
      rule.test?.test?.(".svg"),
    );

    config.plugins.push(
      new CopyPlugin({
        patterns: [
          {
            from: path.join(__dirname, "node_modules/tinymce"),
            to: path.join(__dirname, "public/assets/libs/tinymce"),
          },
        ],
      }),
    );

    config.module.rules.push(
      {
        ...fileLoaderRule,
        test: /\.svg$/i,
        resourceQuery: /url/, // *.svg?url
      },
      {
        test: /\.svg$/i,
        issuer: fileLoaderRule.issuer,
        resourceQuery: { not: [...fileLoaderRule.resourceQuery.not, /url/] }, // exclude if *.svg?url
        use: ["@svgr/webpack"],
      },
    );

    if (process.env.RSDOCTOR) {
      if (config.name === "client") {
        config.plugins.push(
          new RsdoctorWebpackPlugin({
            disableClientServer: true,
          }),
        );
      } else if (config.name === "server") {
        config.plugins.push(
          new RsdoctorWebpackPlugin({
            disableClientServer: true,
            output: {
              reportDir: "./.next/server",
            },
          }),
        );
      }
    }

    fileLoaderRule.exclude = /\.svg$/i;

    return config;
  },
};

export default nextConfig;
