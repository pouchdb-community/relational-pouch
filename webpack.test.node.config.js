
let webpack = require('webpack');

let path = require('path');

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
                useBuiltIns: "usage",
                corejs: 3,
              }],
            ],
            plugins: ["istanbul"],
          },
        }
      },
    ]
  },
};

var doSourcemapping = argv.mode != 'production';//also needs a change in run.js
if (doSourcemapping) {
  nodeTarget.devtool = 'source-map';
}

return [nodeTarget,];
};
