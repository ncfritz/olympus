const path = require("path");
const { BundleAnalyzerPlugin } = require("webpack-bundle-analyzer");
const { NODE_ENV = "production" } = process.env;

module.exports = {
  entry: "./src/main.ts",
  mode: NODE_ENV,
  target: "node",
  plugins: [
    new BundleAnalyzerPlugin({
      analyzerMode: "static",
      generateStatsFile: true,
      openAnalyzer: false,
      reportFilename: "./docs/bundle-report.html",
      statsFilename: "./docs/bundle-stats.json",
    }),
  ],
  output: {
    path: path.resolve(__dirname, "dist"),
    filename: "main.js",
  },
  resolve: {
    extensions: [".ts", ".js"],
  },
  module: {
    rules: [{ test: /\.ts$/, loader: "ts-loader" }],
  },
};
