// @ts-check
import { RsdoctorRspackPlugin } from "@rsdoctor/rspack-plugin";
import { defineConfig } from "@rspack/cli";
import { rspack } from "@rspack/core";
import { RunScriptWebpackPlugin } from "run-script-webpack-plugin";
import nodeExternals from "webpack-node-externals";

export default defineConfig({
  context: import.meta.dirname,
  target: "node",
  entry: {
    main:
      process.env.NODE_ENV === "production"
        ? "./src/main.ts"
        : ["@rspack/core/hot/poll?100", "./src/main.ts"],
  },
  output: {
    clean: true,
  },
  resolve: {
    extensions: ["...", ".ts", ".tsx", ".jsx"],
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        use: {
          loader: "builtin:swc-loader",
          options: {
            detectSyntax: "auto",
            jsc: {
              parser: {
                decorators: true,
              },
              transform: {
                legacyDecorator: true,
                decoratorMetadata: true,
              },
            },
          },
        },
      },
    ],
  },
  optimization: {
    minimizer: [
      new rspack.SwcJsMinimizerRspackPlugin({
        minimizerOptions: {
          compress: {
            keep_classnames: true,
            keep_fnames: true,
          },
          mangle: {
            keep_classnames: true,
            keep_fnames: true,
          },
        },
      }),
    ],
  },
  plugins: [
    process.env.NODE_ENV !== "production" &&
      new RunScriptWebpackPlugin({
        name: "main.js",
        autoRestart: false,
      }),
    process.env.RSDOCTOR &&
      new RsdoctorRspackPlugin({
        experiments: { enableNativePlugin: true },
      }),
  ],
  devServer: {
    devMiddleware: {
      writeToDisk: true,
    },
  },
  externals: [
    nodeExternals({
      allowlist: [/@rspack\/core\/hot\/poll/],
    }),
  ],
});
