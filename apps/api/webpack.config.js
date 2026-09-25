// eslint-disable-next-line @typescript-eslint/no-require-imports
const path = require("path");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { RsdoctorWebpackPlugin } = require("@rsdoctor/webpack-plugin");

let mode = "development";

if (process.env.NODE_ENV === "production") {
  mode = "production";
}

console.log("--- Webpack Build Initializing ---");
console.log("Current Mode:", mode);

module.exports = {
  // main: the server. openapi: writes the OpenAPI documents (pnpm openapi).
  // authUser: the user directory CLI (pnpm auth:user). It ships in the image
  // on purpose — in production the Hasura admin secret is a file inside the
  // container, so `docker compose exec olympus-api node dist/authUser.js` is
  // how users are administered there.
  entry: {
    main: "./src/main.ts",
    openapi: "./src/openapi.ts",
    authUser: "./src/authUser.ts",
  },
  mode: mode,
  target: "node",
  plugins: [
    process.env.RSDOCTOR &&
      new RsdoctorWebpackPlugin({
        disableClientServer: false,
        features: ["loader", "bundle", "plugins", "resolver", "treeShaking"],
        output: {
          mode: "normal",
          options: {
            type: ["html", "json"],
            htmlOptions: {
              writeDataJson: true,
              reportHtmlName: "rsdoctor-report.html",
            },
            jsonOptions: {
              reportJsonName: "rsdoctor-data.json",
              writeDataJson: true,
            },
          },
        },
      }),
  ].filter(Boolean),
  output: {
    path: path.resolve(__dirname, "dist"),
    filename: "[name].js",
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
