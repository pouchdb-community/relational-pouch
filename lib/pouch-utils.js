'use strict';

/* istanbul ignore next */
exports.once = function (fun) {
  var called = false;
  return exports.getArguments(function (args) {
    if (called) {
      console.trace();
      throw new Error('once called  more than once');
    } else {
      called = true;
      fun.apply(this, args);
    }
  });
};
/* istanbul ignore next */
exports.getArguments = function (fun) {
  return function () {
    var len = arguments.length;
    var args = new Array(len);
    var i = -1;
    while (++i < len) {
      args[i] = arguments[i];
    }
    return fun.call(this, args);
  };
};

// execute some promises in a chain
exports.series = function (promiseFactories) {
  var chain = Promise.resolve();
  var overallRes = new Array(promiseFactories.length);
  promiseFactories.forEach(function (promiseFactory, i) {
    chain = chain.then(promiseFactories[i]).then(function (res) {
      overallRes[i] = res;
    });
  });
  return chain.then(function () {
    return overallRes;
  });
};

exports.inherits = require('inherits');
