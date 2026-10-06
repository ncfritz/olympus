// eslint-disable-next-line @typescript-eslint/no-require-imports
const path = require("path");

const mode =
  process.env.NODE_ENV === "production" ? "production" : "development";

module.exports = {
  // The agent, the Takeout command (docs/plans/email-management, 1a) and
  // the Gmail command (1b).
  entry: {
    main: "./src/main.ts",
    takeout: "./src/takeout.ts",
    gmail: "./src/gmail.ts",
  },
  mode,
  target: "node",
  devtool: "source-map",
  output: {
    path: path.resolve(__dirname, "dist"),
    filename: "[name].js",
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
