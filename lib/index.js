'use strict';

var utils = require('./../pouch-utils');
var extend = utils.extend;
var Promise = utils.Promise;
var collections = require('./collections');
var collate = require('pouchdb-collate');
var serialize = collate.toIndexableString;
var deserialize = collate.parseIndexableString;
var uuid = require('./uuid');

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

    var id = obj.id || uuid();
    delete obj.id;
    doc._id = serialize([typeInfo.singular, id]);
    doc.data = obj;

    return doc;
  }

  function transformOutput(typeInfo, pouchDoc) {
    var obj = pouchDoc.data;
    obj.id = deserialize(pouchDoc._id)[1];
    obj.rev = pouchDoc._rev;
    return obj;
  }

  function getTypeInfo(type) {
    if (!keysToSchemas.has(type)) {
      throw createError('unknown type: ' + JSON.stringify(type));
    }

    return keysToSchemas.get(type);
  }

  function save(typeInfo, obj) {
    var pouchDoc;
    return Promise.resolve().then(function () {
      pouchDoc = transformInput(typeInfo, obj);
      return db.put(pouchDoc);
    }).then(function (pouchRes) {
      var res = {};
      res[typeInfo.plural] = [extend(true, obj, {
        id: deserialize(pouchRes.id)[1],
        rev: pouchRes.rev
      })];
      return res;
    });
  }

  function find(typeInfo) {

    var opts = {
      include_docs: true,
      startkey: serialize([typeInfo.singular]),
      endkey: serialize([typeInfo.singular, {}])
    };

    return db.allDocs(opts).then(function (pouchRes) {
      var res = {};
      res[typeInfo.plural] = pouchRes.rows.map(function (row) {
        return transformOutput(typeInfo, row.doc);
      });
      return res;
    });
  }

  db.rel = {
    save: function (type, obj) {
      return Promise.resolve().then(function () {
        var typeInfo = getTypeInfo(type);
        return save(typeInfo, obj);
      });
    },
    find: function (type) {
      return Promise.resolve().then(function () {
        var typeInfo = getTypeInfo(type);
        return find(typeInfo);
      });
    }
  };
};

/* istanbul ignore next */
if (typeof window !== 'undefined' && window.PouchDB) {
  window.PouchDB.plugin(exports);
}
