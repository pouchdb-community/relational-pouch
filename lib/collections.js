'use strict';
exports.Map = LazyMap; // TODO: use ES6 map
exports.Set = LazySet; // TODO: use ES6 set
// based on https://github.com/montagejs/collections
function LazyMap() {
  this.store = {};
}
/* istanbul ignore next */
LazyMap.prototype.mangle = function (key) {
  if (typeof key !== "string") {
    throw new TypeError("key must be a string but Got " + key);
  }
  return '$' + key;
};
/* istanbul ignore next */
LazyMap.prototype.unmangle = function (key) {
  return key.substring(1);
};
/* istanbul ignore next */
LazyMap.prototype.get = function (key) {
  var mangled = this.mangle(key);
  if (mangled in this.store) {
    return this.store[mangled];
  } else {
    return void 0;
  }
};
/* istanbul ignore next */
LazyMap.prototype.set = function (key, value) {
  var mangled = this.mangle(key);
  this.store[mangled] = value;
  return true;
};
/* istanbul ignore next */
LazyMap.prototype.has = function (key) {
  var mangled = this.mangle(key);
  return mangled in this.store;
};
/* istanbul ignore next */
LazyMap.prototype.delete = function (key) {
  var mangled = this.mangle(key);
  if (mangled in this.store) {
    delete this.store[mangled];
    return true;
  }
  return false;
};
/* istanbul ignore next */
LazyMap.prototype.forEach = function (cb) {
  var self = this;
  var keys = Object.keys(self.store);
  keys.forEach(function (key) {
    var value = self.store[key];
    key = self.unmangle(key);
    cb(value, key);
  });
};

/* istanbul ignore next */
function LazySet() {
  this.store = new LazyMap();
}
/* istanbul ignore next */
LazySet.prototype.add = function (key) {
  return this.store.set(key, true);
};
/* istanbul ignore next */
LazySet.prototype.has = function (key) {
  return this.store.has(key);
};
/* istanbul ignore next */
LazySet.prototype.delete = function (key) {
  return this.store.delete(key);
};