import path from "path";
import { RsdoctorWebpackPlugin } from "@rsdoctor/webpack-plugin";

const { NODE_ENV = "production" } = process.env;
const __dirname = path.dirname(new URL(import.meta.url).pathname);

module.exports = {
  entry: "./src/main.ts",
  mode: NODE_ENV,
  target: "node",
  plugins: [process.env.RSDOCTOR && new RsdoctorWebpackPlugin({})],
  output: {
    path: path.resolve(__dirname, "dist"),
    filename: "main.js",
    chunkFormat: "commonjs",
    library: {
      type: "commonjs",
    },
  },
  resolve: {
    extensions: [".ts", ".js"],
  },
  module: {
    rules: [{ test: /\.ts$/, loader: "ts-loader" }],
  },
  optimization: {
    splitChunks: false,
    runtimeChunk: false,
  },
};
