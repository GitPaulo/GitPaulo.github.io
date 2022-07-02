const webpack = require("webpack"); // eslint-disable-line no-unused-vars
const FaviconsWebpackPlugin = require("favicons-webpack-plugin");
const path = require("path");

module.exports = {
  context: __dirname,
  entry: {
    "main.bundle": "./js/main.js",
    "main.bundle.worker": "./node_modules/pdfjs-dist/build/pdf.worker.entry",
  },
  mode: "none",
  output: {
    path: path.join(__dirname, "./build"),
    publicPath: "build",
    filename: "[name].js",
  },
  module: {
    rules: [
      {
        test: /\.css$/,
        use: [{ loader: "style-loader" }, { loader: "css-loader" }],
      },
    ],
  },
  plugins: [new FaviconsWebpackPlugin("favicon.ico")],
};
