'use strict';

var utils = require('./../pouch-utils');
var extend = utils.extend;
var Promise = utils.Promise;
var collections = require('./collections');
var uuid = require('./uuid');

function createError(str) {
  var err = new Error(str);
  err.status = 400;
  return err;
}

var TYPE_UNDEF = '0';
var TYPE_NUM = '1';
var TYPE_STRING = '2';
var TYPE_OBJ = '3';

function serialize(type, id) {
  // simple collation that goes like this:
  // undefined < numbers < strings < object
  var res = type.replace('_', '') + '_';
  if (typeof id === 'number') {
    // zpad
    id = id.toString();
    while (id.length < 20) {
      id = '0' + id;
    }
    res += TYPE_NUM + '_' + id;
  } else if (typeof id === 'undefined') {
    // need lowest possible value
    res += TYPE_UNDEF;
  } else if (typeof id === 'object') {
    // need highest possible value
    res += TYPE_OBJ;
  } else { // string
    res += TYPE_STRING + '_' + id;
  }
  return res;
}
function deserialize(str) {
  // should only have to deserialize numbers and strings
  var idx = str.indexOf('_');
  var collationType = str.charAt(idx + 1);
  var id = str.substring(idx + 3);
  if (collationType === TYPE_NUM) {
    return parseInt(id, 10);
  }
  return id;
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
        if (relationType !== 'belongsTo' && relationType !== 'hasMany') {
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
    doc._id = serialize(typeInfo.singular, id);

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
    obj.id = deserialize(pouchDoc._id);
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
        id: deserialize(pouchRes.id),
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

  function find(type, idOrIds, foundObjects) {
    var typeInfo = getTypeInfo(type);

    var opts = {
      include_docs: true
    };

    if (typeof idOrIds === 'undefined' || idOrIds === null) {
      // find everything
      opts.startkey = serialize(typeInfo.singular);
      opts.endkey = serialize(typeInfo.singular, {});
    } else if (Array.isArray(idOrIds)) {
      // find multiple by ids
      opts.keys = idOrIds.map(function (id) {
        return serialize(typeInfo.singular, id);
      });
    } else {
    // find by single id
      opts.key = serialize(typeInfo.singular, idOrIds);
    }

    if (!foundObjects.has(type)) {
      foundObjects.set(type, new collections.Map());
    }

    return db.allDocs(opts).then(function (pouchRes) {
      var tasks = pouchRes.rows.filter(function (row) {
        return row.doc && !row.value.deleted;
      }).map(function (row) {
        var obj = transformOutput(typeInfo, row.doc);

        foundObjects.get(type).set(JSON.stringify(obj.id), obj);

        // fetch all relations
        var subTasks = [];
        Object.keys(typeInfo.relations || {}).forEach(function (field) {
          var relationDef = typeInfo.relations[field];
          var relationType = Object.keys(relationDef)[0];
          var relatedType = relationDef[relationType];
          if (relationType === 'belongsTo') {
            var relatedId = obj[field];
            if (typeof relatedId !== 'undefined') {
              subTasks.push(Promise.resolve().then(function () {

                // short-circuit if it's already in the foundObjects
                // else we could get caught in an infinite loop
                if (foundObjects.has(relatedType) &&
                    foundObjects.get(relatedType).has(JSON.stringify(relatedId))) {
                  return foundObjects.get(relatedType).get(JSON.stringify(relatedId));
                }

                // go fetch it
                return find(relatedType, relatedId, foundObjects);
              }));
            }
          } else { // hasMany
            var relatedIds = obj[field];
            if (typeof relatedIds !== 'undefined' && relatedIds.length) {
              subTasks.push(Promise.resolve().then(function () {

                // filter out all ids that are already in the foundObjects
                for (var i = relatedIds.length; i >= 0; i--) {
                  var relatedId = relatedIds[i];
                  if (foundObjects.has(relatedType) &&
                      foundObjects.get(relatedType).has(JSON.stringify(relatedId))) {
                    delete relatedIds[i];
                  }
                }
                relatedIds = relatedIds.filter(function (relatedId) {
                  return typeof relatedId !== 'undefined';
                });

                if (relatedIds.length) {
                  // are there still any left?
                  return find(relatedType, relatedIds, foundObjects);
                }
              }));
            }
          }
        });
        return Promise.all(subTasks);
      });
      return Promise.all(tasks).then(function () {
        var res = {};
        foundObjects.forEach(function (found, type) {
          var typeInfo = getTypeInfo(type);
          var list = res[typeInfo.plural] = [];
          found.forEach(function (obj) {
            list.push(obj);
          });
          list.sort(function (a, b) {
            return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
          });
        });
        return res;
      });
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
        return find(type, idOrIds, new collections.Map());
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
