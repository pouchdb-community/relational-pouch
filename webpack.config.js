
let webpack = require('webpack');
let VirtualModulePlugin = require('virtual-module-webpack-plugin');
//let deepScope = require('webpack-deep-scope-plugin').default;

let path = require('path');

module.exports = (env, argv) => {
let nodeTarget = {
	target: "node",
	entry: "./lib/index.js",
	mode: argv.mode || 'development',
	output: {
	  path: path.resolve(__dirname, 'dist'),
	  filename: 'pouchdb.relational-pouch.node.js',
    libraryTarget: 'commonjs2',
  },
  plugins: [
  ],
  module: {
    rules: [
      {
        test: /\.m?js$/,
        exclude: /(node_modules|bower_components)/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: [
              ['@babel/preset-env',
              {
                "targets": {
                  "node": "current"
                },
                "modules": false,
              }],
            ],
          },
        }
      }
    ]
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
	entry: "./lib/index.js",
	mode: argv.mode || 'development',
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
        test: /\.m?js$/,
        exclude: /(node_modules|bower_components)/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: [
              ['@babel/preset-env',
              {
                "targets": "> 0.25%, not dead",
                "modules": false,
              }],
            ],
          },
        }
      }
    ]
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

let webTests = {
  target: "web",
	entry: "./test/test.js",
	mode: argv.mode || 'development',
	output: {
	  path: path.resolve(__dirname, 'tests'),
	  filename: 'test-bundle.js.js',
    libraryTarget: 'umd',
  },
  plugins: [
  ],
  module: {
    rules: [
      {
        test: /\.m?js$/,
        exclude: /(node_modules|bower_components)/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: [
              ['@babel/preset-env',
              {
                "targets": "> 0.25%, not dead",
                "modules": false,
              }],
            ],
          },
        }
      }
    ]
  },
};

var doSourcemapping = true;//also needs a change in run.js
if (doSourcemapping) {
  webTarget.devtool = 'source-map';//'inline-source-map',
  nodeTarget.devtool = 'source-map';
}

return [webTarget, nodeTarget, webTests];
};
