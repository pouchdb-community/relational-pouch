#!/usr/bin/env node

'use strict';

var COUCH_HOST = process.env.COUCH_HOST || 'http://127.0.0.1:5984';
var HTTP_PORT = 8001;

var Promise = require('bluebird');
var request = require('request');
var http_server = require("http-server");
var fs = require('fs');
var indexfile = "./test/test.js";
var dotfile = "./test/.test-bundle.js";
var outfile = "./test/test-bundle.js";
var webpack = require('webpack');
var path = require('path');
var b = webpack({
  target: "web",
	entry: "./test/test.js",
	mode: 'development',
	devtool: 'source-map',
	output: {
	  path: path.resolve(__dirname, '../test'),
	  filename: 'test-bundle.js',
    libraryTarget: 'umd',
  },
  plugins: [
  ],
  module: {
    rules: [
      {
        enforce: 'pre',
        test: /\.js$/,
        exclude: /node_modules/,
        loader: 'eslint-loader',
      },
      {
        test: /\.m?js$/,
        exclude: /(node_modules|bower_components)/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: [
              ['@babel/preset-env',
              {
                "targets": "last 1 Chrome versions",
                "modules": false,
                useBuiltIns: "usage",
                corejs: 3,
              }],
            ],
          },
        }
      }
    ]
  },
}).watch({}, (error, stats) => {
  if (error) {
    console.error(error);
    return;
  }
  
  let logOptions = {all: false, colors: true, assets: true, errors: true, errorDetails: true, warnings: true, errorStack: true};
  if (!stats.hasErrors()) {
    console.log('Updated');
    console.log(stats.toString(logOptions));
    filesWritten = true;
    checkReady();
  } else {
    const info = stats.toJson();
    console.error(stats.toString(logOptions));//children: false, entrypoints: false, hash: false, modules: false, , chunks: false
  }
});

var filesWritten = false;
var serverStarted = false;
var readyCallback;

function startServers(callback) {
  readyCallback = callback;
  // enable CORS globally, because it's easier this way

  var corsValues = {
    '/_config/httpd/enable_cors': 'true',
    '/_config/cors/origins': '*',
    '/_config/cors/credentials': 'true',
    '/_config/cors/methods': 'PROPFIND, PROPPATCH, COPY, MOVE, DELETE, ' +
      'MKCOL, LOCK, UNLOCK, PUT, GETLIB, VERSION-CONTROL, CHECKIN, ' +
      'CHECKOUT, UNCHECKOUT, REPORT, UPDATE, CANCELUPLOAD, HEAD, ' +
      'OPTIONS, GET, POST',
    '/_config/cors/headers':
      'Cache-Control, Content-Type, Depth, Destination, ' +
        'If-Modified-Since, Overwrite, User-Agent, X-File-Name, ' +
        'X-File-Size, X-Requested-With, accept, accept-encoding, ' +
        'accept-language, authorization, content-type, origin, referer'
  };

  Promise.all(Object.keys(corsValues).map(function (key) {
    var value = corsValues[key];
    return request({
      method: 'put',
      url: COUCH_HOST + key,
      body: JSON.stringify(value)
    });
  })).then(function () {
    return http_server.createServer().listen(HTTP_PORT);
  }).then(function () {
    console.log('Tests: http://127.0.0.1:' + HTTP_PORT + '/test/index.html');
    serverStarted = true;
    checkReady();
  }).catch(function (err) {
    if (err) {
      console.log(err);
      process.exit(1);
    }
  });
}

function checkReady() {
  if (filesWritten && serverStarted && readyCallback) {
    readyCallback();
  }
}

if (require.main === module) {
  startServers();
} else {
  module.exports.start = startServers;
}
