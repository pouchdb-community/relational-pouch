'use strict';

var utils = require('./../pouch-utils');
var extend = utils.extend;
var Promise = utils.Promise;
var collections = require('./collections');

function createError(str) {
  var err = new Error(str);
  err.status = 400;
  return err;
}

exports.initRelational = function (schema) {
  var db = this;

  var keysToSchemas = new collections.Map();
  schema.forEach(function (type) {
    keysToSchemas.set(type.singular, type);
    keysToSchemas.set(type.plural, type);
  });

  /**
   * Transform a relational "object" into
   * a PouchDB doc.
   */
  function transformInput(typeInfo, obj) {
    obj = extend(true, {}, obj);
    var doc = {};

    if (obj.rev) {
      doc._rev = obj.rev;
      delete obj.rev;
    }
    if (obj.id) {
      doc.idType = typeof obj.id;
      doc._id = obj.id.toString();
      delete obj.id;
    }

    doc.data = obj;

    return doc;
  }

  function transformOutputId(pouchDoc, id) {
    if (pouchDoc.idType === 'number') {
      return parseInt(id, 10);
    }
    return id;
  }

  function save(type, obj) {
    if (!keysToSchemas.has(type)) {
      throw createError('unknown type: ' + JSON.stringify(type));
    }

    var typeInfo = keysToSchemas.get(type);

    var pouchDoc;
    return Promise.resolve().then(function () {
      pouchDoc = transformInput(typeInfo, obj);
      if (typeof pouchDoc._id === 'undefined') {
        return db.post(pouchDoc);
      } else {
        return db.put(pouchDoc);
      }
    }).then(function (pouchRes) {
      var res = {};
      res[typeInfo.plural] = [extend(true, obj, {
        id: transformOutputId(pouchDoc, pouchRes.id),
        rev: pouchRes.rev
      })];
      return res;
    });
  }

  db.rel = {
    save: function (type, obj) {
      return Promise.resolve().then(function () { return save(type, obj); });
    }
  };
};

/* istanbul ignore next */
if (typeof window !== 'undefined' && window.PouchDB) {
  window.PouchDB.plugin(exports);
}
