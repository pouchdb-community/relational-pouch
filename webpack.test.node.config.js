
let webpack = require('webpack');
const ForkTsCheckerWebpackPlugin = require('fork-ts-checker-webpack-plugin');

let path = require('path');

let babelLoader = {
  loader: 'babel-loader',
  options: {
    presets: [
      ['@babel/preset-env',
      {
        "targets": {
          "node": "current"
        },
        "modules": false,
        useBuiltIns: "usage",
        corejs: 3,
      }],
    ],
    plugins: ["istanbul"],
  },
};

module.exports = (env, argv) => {
let nodeTarget = {
  stats: 'errors-only',
	target: "node",
	entry: "./test/test.js",
	mode: argv.mode || 'development',
	output: {
	  path: path.resolve(__dirname, 'test'),
	  filename: 'test-node.js',
    libraryTarget: 'commonjs2',
  },
  plugins: [
    new ForkTsCheckerWebpackPlugin(),
  ],
  module: {
    rules: [
      {
        test: /\.[tj]s$/,
        exclude: /(node_modules|bower_components)/,
        use: [
          babelLoader,
          {
            loader: 'ts-loader',
            options: {
              transpileOnly: true,
              experimentalWatchApi: true,
            },
          },
        ],
      },
//      {
//        test: /\.m?js$/,
//        exclude: /(node_modules|bower_components)/,
//        use: babelLoader,
//      },
    ]
  },
  resolve: {
    extensions: ['tsx', '.ts', '.js', '.json'],
  },
};

var doSourcemapping = argv.mode != 'production';//also needs a change in run.js
if (doSourcemapping) {
  nodeTarget.devtool = 'source-map';
}

return [nodeTarget,];
};
