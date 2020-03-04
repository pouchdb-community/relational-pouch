
let webpack = require('webpack');
//let deepScope = require('webpack-deep-scope-plugin').default;

let path = require('path');
let package = require('./package.json');

module.exports = (env, argv) => {
let nodeTarget = {
	target: "node",
	entry: "./src/index.ts",
	mode: argv.mode || 'development',
	output: {
	  path: path.resolve(__dirname, 'dist'),
	  filename: 'pouchdb.relational-pouch.node.js',
    libraryTarget: 'commonjs2',
    libraryExport: 'default',
  },
  externals: Object.keys(package.dependencies),
  plugins: [
  ],
  module: {
    rules: [
      {
        test: /\.m?[jt]s$/,
        exclude: /(node_modules|bower_components)/,
        use: [
          {
            loader: 'babel-loader',
            options: {
              presets: [
                ['@babel/preset-env',
                {
                  "targets": {
                    "node": "10"
                  },
                  "modules": false,
                  useBuiltIns: "usage",
                  corejs: 3,
                }],
              ],
            },
          },
          {
            loader: 'ts-loader',
            options: {
              transpileOnly: true,
              experimentalWatchApi: true,
            },
          },
        ],
      }
    ]
  },
  resolve: {
    extensions: ['tsx', '.ts', '.js', '.json'],
  },
//  externals: [
//    function(context, request, callback) {
//      if (/^http-debug$/.test(request)){
//        return callback(null, 'commonjs ' + request);
//      }
//      callback();
//    },
//  ],
};

let webTarget = {
	target: "web",
	entry: "./src/browser.ts",//TODO: this file could be exluded in tsc to not generate dist/browser.*
	mode: argv.mode || 'development',
//  stats: 'verbose',
	output: {
	  path: path.resolve(__dirname, 'dist'),
	  filename: 'pouchdb.relational-pouch.browser.js',
    libraryTarget: 'umd',
  },
  plugins: [
  ],
  module: {
    rules: [
      {
        test: /\.m?[jt]s$/,
        exclude: /(node_modules|bower_components)/,
        use: [
          {
            loader: 'babel-loader',
            options: {
              presets: [
                ['@babel/preset-env',
                {
                  "targets": ">2%, not ie 11",
                  "modules": false,
                  useBuiltIns: "usage",
                  corejs: 3,
                }],
              ],
            },
          },
          {
            loader: 'ts-loader',
            options: {
              transpileOnly: true,
              experimentalWatchApi: true,
            },
          },
        ],
      }
    ]
  },
  resolve: {
    extensions: ['tsx', '.ts', '.js', '.json'],
  },
//  externals: [
//    function(context, request, callback) {
//      if (/^http-debug$/.test(request)){
//        return callback(null, 'commonjs ' + request);
//      }
//      callback();
//    },
//  ],
};

var doSourcemapping = argv.mode != 'production';//also needs a change in run.js
if (doSourcemapping) {
  webTarget.devtool = 'source-map';//'inline-source-map',
  nodeTarget.devtool = 'source-map';
}

return [webTarget, nodeTarget,];
};
