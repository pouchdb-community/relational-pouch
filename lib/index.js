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

exports.setSchema = function (schema) {
  var db = this;

  var keysToSchemas = new collections.Map();
  schema.forEach(function (type) {
    keysToSchemas.set(type.singular, type);
    keysToSchemas.set(type.plural, type);
  });

  // validate the relations
  schema.forEach(function (type) {
    if (type.relations) {
      Object.keys(type.relations).forEach(function (field) {
        var relationDef = type.relations[field];
        if (Object.keys(relationDef).length !== 1) {
          throw new Error('Invalid relationship definition for: ' + field);
        }
        var relationType = Object.keys(relationDef)[0];
        var relatedField = relationDef[relationType];
        if (!keysToSchemas.get(relatedField)) {
          throw new Error('Unknown entity type: ' + relatedField);
        }
        if (relationType !== 'belongsTo' || relationType !== 'hasMany') {
          throw new Error('Invalid relationship type for ' + field + ': ' + relationType);
        }
      });
    }
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

    if (typeInfo.relations) {
      Object.keys(typeInfo.relations).forEach(function (field) {
        var relationDef = typeInfo.relations[field];
        var relationType = Object.keys(relationDef)[0];

        if (relationType === 'belongsTo') {
          if (obj[field] && typeof obj[field].id !== 'undefined') {
            obj[field] = obj[field].id;
          }
        } else { // hasMany
          obj[field] = (obj[field] || []).map(function (dependent) {
            return dependent.id;
          }).filter(function (dependent) {
            return typeof dependent.id !== 'undefined';
          });
        }
      });
    }

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

  function save(type, obj) {
    var typeInfo = getTypeInfo(type);
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

  function del(type, obj) {
    var typeInfo = getTypeInfo(type);
    var pouchDoc;
    return Promise.resolve().then(function () {
      pouchDoc = transformInput(typeInfo, obj);
      pouchDoc = {
        _id : pouchDoc._id,
        _rev : pouchDoc._rev,
        _deleted: true
      };
      return db.put(pouchDoc);
    }).then(function () {
      return {deleted: true};
    });
  }

  function find(type, idOrIds) {
    var typeInfo = getTypeInfo(type);

    var opts = {
      include_docs: true
    };

    if (typeof idOrIds === 'undefined' || idOrIds === null) {
      // find everything
      opts.startkey = serialize([typeInfo.singular]);
      opts.endkey = serialize([typeInfo.singular, {}]);
    } else if (Array.isArray(idOrIds)) {
      // find multiple by ids
      opts.keys = idOrIds.map(function (id) {
        return serialize([typeInfo.singular, id]);
      });
    } else {
    // find by single id
      opts.key = serialize([typeInfo.singular, idOrIds]);
    }

    return db.allDocs(opts).then(function (pouchRes) {
      var res = {};
      res[typeInfo.plural] = pouchRes.rows.filter(function (row) {
        return row.doc && !row.value.deleted;
      }).map(function (row) {
        var obj = transformOutput(typeInfo, row.doc);

        if (!typeInfo.relations) {
          return obj;
        }
        // fetch all relations
        var tasks = [];
        Object.keys(typeInfo.relations).forEach(function (field) {
          var relationDef = typeInfo.relations[field];
          var relationType = Object.keys(relationDef)[0];
          var relatedObjectType = relationDef[relationType];
          var relatedTypeInfo = getTypeInfo(relatedObjectType);
          if (relationType === 'belongsTo') {
            var id = obj[field];
            if (typeof id !== 'undefined') {
              tasks.push(function () {

                return find(relatedTypeInfo, id).then(function (res) {
                  obj[field] = res[relatedTypeInfo.plural][0];
                });
              });
            }
          } else { // hasMany
            var ids = obj[field];
            if (typeof ids !== 'undefined' && ids.length) {
              tasks.push(function () {
                return find(relatedTypeInfo, ids).then(function (res) {
                  var map = {};
                  res[relatedTypeInfo.plural].forEach(function (subObj) {
                    map[JSON.stringify(subObj.id)] = subObj;
                  });
                  obj[field] = ids.map(function (id) {
                    return map[JSON.stringify(id)];
                  });
                });
              });
            }
          }
        });
        return Promise.all(tasks).then(function () {
          return obj;
        });
      });
      return res;
    });
  }

  db.rel = {
    save: function (type, obj) {
      return Promise.resolve().then(function () {
        return save(type, obj);
      });
    },
    find: function (type, idOrIds) {
      return Promise.resolve().then(function () {
        return find(type, idOrIds);
      });
    },
    del: function (type, obj) {
      return Promise.resolve().then(function () {
        return del(type, obj);
      });
    }
  };
};

/* istanbul ignore next */
if (typeof window !== 'undefined' && window.PouchDB) {
  window.PouchDB.plugin(exports);
}
