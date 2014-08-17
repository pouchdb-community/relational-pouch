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

  function find(type, idOrIds, foundObjects) {
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
      var tasks = pouchRes.rows.filter(function (row) {
        return row.doc && !row.value.deleted;
      }).map(function (row) {
        var obj = transformOutput(typeInfo, row.doc);

        if (!foundObjects.has(type)) {
          foundObjects.set(type, new collections.Map());
        }
        foundObjects.get(type).set(JSON.stringify(obj.id), obj);

        // fetch all relations
        var subTasks = [];
        Object.keys(typeInfo.relations || {}).forEach(function (field) {
          var relationDef = typeInfo.relations[field];
          var relationType = Object.keys(relationDef)[0];
          var relatedType = relationDef[relationType];
          var relatedTypeInfo = getTypeInfo(relatedType);
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
                return find(relatedType, relatedId, foundObjects).then(function (res) {
                  obj[field] = res[relatedTypeInfo.plural][0];
                });
              }));
            }
          } else { // hasMany
            var relatedIds = obj[field];
            if (typeof relatedIds !== 'undefined' && relatedIds.length) {
              subTasks.push(Promise.resolve().then(function () {

                // filter out all ids that are already in the foundObjects
                var map = new collections.Map();
                for (var i = relatedIds.length; i >= 0; i--) {
                  var relatedId = relatedIds[i];
                  if (foundObjects.has(relatedType) &&
                      foundObjects.get(relatedType).has(JSON.stringify(relatedId))) {
                    map.set(JSON.stringify(relatedId),
                      foundObjects.get(relatedType).get(JSON.stringify(relatedId)));
                    delete relatedIds[i];
                  }
                }
                relatedIds = relatedIds.filter(function (relatedId) {
                  return typeof relatedId !== 'undefined';
                });

                if (relatedIds.length) {
                  // are there still any left?
                  return find(relatedType, relatedIds, foundObjects).then(function (res) {

                    res[relatedTypeInfo.plural].forEach(function (subObj) {
                      map.set(JSON.stringify(subObj.id), subObj);
                    });
                    obj[field] = relatedIds.map(function (id) {
                      return map.get(JSON.stringify(id));
                    });
                  });
                }
              }));
            }
          }
        });
        return Promise.all(subTasks).then(function () {
          return obj;
        });
      });
      return Promise.all(tasks).then(function (results) {
        res[typeInfo.plural] = results;
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
