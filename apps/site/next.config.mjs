import CopyPlugin from "copy-webpack-plugin";
import { createRequire } from "module";
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
  webpack: (config) => {
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
      // Required here rather than imported at the top of this file, because
      // @rsdoctor/webpack-plugin brings a native binding (@rspack/resolver) and
      // an import would make every build depend on one being published for the
      // platform doing the building. The image builds on Alpine, where that is
      // a less travelled path than glibc, and a bundle analyser nobody asked
      // for is no reason for a build to fail.
      const { RsdoctorWebpackPlugin } = createRequire(import.meta.url)(
        "@rsdoctor/webpack-plugin",
      );
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
