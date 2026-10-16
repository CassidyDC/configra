import { fileURLToPath } from "node:url";

/**
 * Editable Webpack build configuration with module-relative source and output paths.
 *
 * @type {import("webpack").Configuration}
 */
export default {
  entry: fileURLToPath(new URL("./__ENTRY__", import.meta.url)),
  output: { path: fileURLToPath(new URL("./dist", import.meta.url)), filename: "index.js" },
  resolve: { extensions: [".js", ".jsx", ".ts", ".tsx"] },
  module: {
    rules: [
      {
        test: /\.[cm]?[jt]sx?$/,
        exclude: /node_modules/,
        use: { loader: "babel-loader", options: { presets: __PRESETS__ } },
      },
    ],
  },
};
