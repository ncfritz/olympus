// eslint-disable-next-line @typescript-eslint/no-require-imports
const path = require("path");

const mode =
  process.env.NODE_ENV === "production" ? "production" : "development";

module.exports = {
  entry: "./src/main.ts",
  mode,
  target: "node",
  devtool: "source-map",
  output: {
    path: path.resolve(__dirname, "dist"),
    filename: "main.js",
    chunkFormat: "commonjs",
    library: {
      type: "commonjs",
    },
  },
  resolve: {
    extensions: [".ts", ".js", ".json"],
  },
  module: {
    rules: [{ test: /\.ts$/, loader: "ts-loader" }],
  },
  optimization: {
    splitChunks: false,
    runtimeChunk: false,
  },
};
