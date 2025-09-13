const CopyPlugin = require("copy-webpack-plugin");
const TerserPlugin = require("terser-webpack-plugin");
const { NODE_ENV = "production" } = process.env;

module.exports = {
  target: "node",
  mode: NODE_ENV,
  entry: "./src/main.ts",
  output: {
    filename: "main.js",
    path: require("path").resolve(__dirname, "dist"),
  },
  resolve: {
    extensions: [".ts", ".js"],
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        use: "ts-loader",
        exclude: /node_modules/,
      },
    ],
  },
  externals: [],
  optimization: {
    minimize: NODE_ENV === "production",
    minimizer: [
      new TerserPlugin({
        extractComments: false,
      }),
    ],
  },
  plugins: [
    new CopyPlugin({
      patterns: [{ from: "templates", to: "templates" }],
    }),
  ],
};
