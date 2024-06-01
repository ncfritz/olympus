import { BundleAnalyzerPlugin } from "webpack-bundle-analyzer";
import CopyPlugin from "copy-webpack-plugin";
import path from "path";
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  reactStrictMode: true,
  eslint: {
    ignoreDuringBuilds: true,
  },
  experimental: {
    esmExternals: 'loose',
  },
  swcMinify: true,
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
    { buildId, dev, isServer, defaultLoaders, nextRuntime, webpack }
  ) => {
    const fileLoaderRule = config.module.rules.find((rule) =>
      rule.test?.test?.('.svg'),
    );

    config.plugins.push(new CopyPlugin({
      patterns: [
        {
          from: path.join(__dirname, 'node_modules/tinymce'),
          to: path.join(__dirname, 'public/assets/libs/tinymce')
        },
      ]
    }
    ));

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
    /*config.plugins = [
      new BundleAnalyzerPlugin({
        analyzerMode: "static",
        openAnalyzer: false,
        reportFilename: "webpack.html",
        generateStatsFile: true,
        statsFilename: "webpack.json",
      }),
    ];*/

    fileLoaderRule.exclude = /\.svg$/i

    return config;
  }
};

export default nextConfig;
