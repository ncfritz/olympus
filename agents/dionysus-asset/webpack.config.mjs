import path from "path";
import nodeExternals from "webpack-node-externals";

module.exports = {
  entry: "./src/main.ts",
  target: "es2020",
  experiments: {
    outputModule: true,
  },
  externals: [nodeExternals()],
  module: {
    rules: [
      {
        test: /\.ts$/,
        use: "ts-loader",
        exclude: /node_modules/,
      },
    ],
  },
  resolve: {
    extensions: [".ts", ".js"],
  },
  output: {
    library: {
      type: "module",
    },
    path: path.resolve(__dirname, "dist"),
    filename: "main.js",
  },
};
