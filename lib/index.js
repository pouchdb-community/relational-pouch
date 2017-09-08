'use strict';

var utils = require('./pouch-utils');
var extend = utils.extend;
var Promise = utils.Promise;
var collections = require('./collections');
var uuid = require('./uuid');
var uniq = require('uniq');

function createError(str) {
  var err = new Error(str);
  err.status = 400;
  return err;
}

var MAX_INT_LENGTH = 16; // max int in JS is 9007199254740992
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
    while (id.length < MAX_INT_LENGTH) {
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

  // set default documentType
  schema.forEach(function (type) {
    type.documentType = type.documentType || type.singular;
  });

  // validate the relations
  schema.forEach(function (type) {
    if (type.relations) {
      if (!Object.keys(type.relations).length) {
        throw new Error('Invalid relations for: ' + type);
      }
      Object.keys(type.relations).forEach(function (field) {
        var relationDef = type.relations[field];
        if (Object.keys(relationDef).length !== 1) {
          throw new Error('Invalid relationship definition for: ' + field);
        }
        var relationType = Object.keys(relationDef)[0];
        var relatedField = relationDef[relationType];
        if (typeof relatedField !== 'string') {
          relatedField = relatedField.type;
        }
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
   * Transform a relational object into a PouchDB doc.
   */
  function toRawDoc(typeInfo, obj) {
    obj = extend(true, {}, obj);
    var doc = {};

    if (obj.rev) {
      doc._rev = obj.rev;
      delete obj.rev;
    }

    if (obj.attachments) {
      doc._attachments = obj.attachments;
      delete obj.attachments;
    }

    var id = obj.id || uuid();
    delete obj.id;
    doc._id = serialize(typeInfo.documentType, id);

    if (typeInfo.relations) {
      Object.keys(typeInfo.relations).forEach(function (field) {
        var relationDef = typeInfo.relations[field];
        var relationType = Object.keys(relationDef)[0];

        if (relationType === 'belongsTo') {
          if (obj[field] && typeof obj[field].id !== 'undefined') {
            obj[field] = obj[field].id;
          }
        } else { // hasMany
          var relatedType = relationDef[relationType];
          if (relatedType.options && relatedType.options.queryInverse) {
            delete obj[field];
            return;
          }
          if (obj[field]) {
            var dependents = obj[field].map(function (dependent) {
              if (dependent && typeof dependent.id !== 'undefined') {
                return dependent.id;
              }
              return dependent;
            });
            obj[field] = dependents;
          } else {
            obj[field] = [];
          }
        }
      });
    }

    doc.data = obj;

    return doc;
  }

  /**
   * Transform a PouchDB doc into a relational object.
   */
  function fromRawDoc(pouchDoc) {
    var obj = pouchDoc.data;
    obj.id = deserialize(pouchDoc._id);
    obj.rev = pouchDoc._rev;
    if (pouchDoc._attachments) {
      obj.attachments = pouchDoc._attachments;
    }
    return obj;
  }

  function getTypeInfo(type) {
    if (!keysToSchemas.has(type)) {
      throw createError('unknown type: ' + JSON.stringify(type));
    }

    return keysToSchemas.get(type);
  }

  function _save(type, obj) {
    var typeInfo = getTypeInfo(type);
    var pouchDoc;
    return Promise.resolve().then(function () {
      pouchDoc = toRawDoc(typeInfo, obj);
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

  function _del(type, obj) {
    var typeInfo = getTypeInfo(type);
    var pouchDoc;
    return Promise.resolve().then(function () {
      pouchDoc = toRawDoc(typeInfo, obj);
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

  function _find(type, idOrIds, foundObjects) {
    var typeInfo = getTypeInfo(type);

    var opts = {
      include_docs: true
    };

    if (typeof idOrIds === 'undefined' || idOrIds === null) {
      // find everything
      opts.startkey = serialize(typeInfo.documentType);
      opts.endkey = serialize(typeInfo.documentType, {});
    } else if (Array.isArray(idOrIds)) {
      // find multiple by ids
      opts.keys = idOrIds.map(function (id) {
        return serialize(typeInfo.documentType, id);
      });
    } else if (typeof idOrIds === 'object') {
      if (typeof idOrIds.startkey  === 'undefined' || idOrIds.startkey === null) {
        opts.startkey = serialize(typeInfo.documentType);
      } else {
        opts.startkey = serialize(typeInfo.documentType, idOrIds.startkey);
      }
      if (typeof idOrIds.endkey  === 'undefined' || idOrIds.endkey === null) {
        opts.endkey = serialize(typeInfo.documentType, {});
      } else {
        opts.endkey = serialize(typeInfo.documentType, idOrIds.endkey);
      }
      if (typeof idOrIds.limit !== 'undefined' && idOrIds.limit !== null) {
        opts.limit = idOrIds.limit;
      }
      if (typeof idOrIds.skip !== 'undefined' && idOrIds.skip !== null) {
        opts.skip = idOrIds.skip;
      }
    } else {
    // find by single id
      opts.key = serialize(typeInfo.documentType, idOrIds);
    }
    
    return db.allDocs(opts).then(_parseAlldocs.bind(db, type, foundObjects));
  }
  
  //true = deleted, false = exists, null = not in database
  function isDeleted(type, id) {
    var typeInfo = getTypeInfo(type);
    
    return db.get(serialize(typeInfo.documentType, id))
      .then(function (doc) { return !!doc._deleted; })
      .catch(function (err) { return err.reason === "deleted" ? true : null; });
  }
  
  function _parseAlldocs(type, foundObjects, pouchRes) {
  	return _parseRelDocs(type, foundObjects, pouchRes.rows.filter(function (row) {
      return row.doc && !row.value.deleted;
    }).map(function (row) {
      return row.doc;
    }));
  }
  
  function parseRelDocs(type, pouchDocs) {
  	return _parseRelDocs(type, new collections.Map(), pouchDocs);
  }
  
  function _parseRelDocs(type, foundObjects, pouchDocs) {
  	var typeInfo = getTypeInfo(type);
  	
  	if (!foundObjects.has(type)) {
      foundObjects.set(type, new collections.Map());
    }
    
  	return Promise.resolve().then(function() {
      var tasks = pouchDocs.map(function (doc) {
        var obj = fromRawDoc(doc);

        foundObjects.get(type).set(JSON.stringify(obj.id), obj);

        // fetch all relations
        var subTasks = [];
        Object.keys(typeInfo.relations || {}).forEach(function (field) {
          var relationDef = typeInfo.relations[field];
          var relationType = Object.keys(relationDef)[0];
          var relatedType = relationDef[relationType];
          var relationOptions = {};
          if (typeof relatedType !== 'string') {
            relationOptions = relatedType.options || {};
            if (relationOptions.async) {
              return;
            }
            if (relationOptions.queryInverse) {
              delete obj[field];
            }
            relatedType = relatedType.type;
          }
          if (relationType === 'belongsTo') {
            var relatedId = obj[field];
            if (typeof relatedId !== 'undefined') {
              subTasks.push(Promise.resolve().then(function () {

                // short-circuit if it's already in the foundObjects
                // else we could get caught in an infinite loop
                if (foundObjects.has(relatedType) &&
                    foundObjects.get(relatedType).has(JSON.stringify(relatedId))) {
                  return;
                }

                // signal that we need to fetch it
                return {
                  relatedType: relatedType,
                  relatedIds: [relatedId]
                };
              }));
            }
          } else { // hasMany
            if (relationOptions.queryInverse) {
              subTasks.push(_findHasMany(relatedType, relationOptions.queryInverse,
                                         obj.id, foundObjects)
                            .then(function () { return; }));
              return;
            }
            
            var relatedIds = extend(true, [], obj[field]);
            if (typeof relatedIds !== 'undefined' && relatedIds.length) {
              subTasks.push(Promise.resolve().then(function () {

                // filter out all ids that are already in the foundObjects
                for (var i = relatedIds.length - 1; i >= 0; i--) {
                  var relatedId = relatedIds[i];
                  if (foundObjects.has(relatedType) &&
                      foundObjects.get(relatedType).has(JSON.stringify(relatedId))) {
                    delete relatedIds[i];
                  }
                }
                relatedIds = relatedIds.filter(function (relatedId) {
                  return typeof relatedId !== 'undefined';
                });

                // just return the ids and the types. We'll find them all
                // in a single bulk operation in order to minimize HTTP requests
                if (relatedIds.length) {
                  return {
                    relatedType: relatedType,
                    relatedIds: relatedIds
                  };
                }
              }));
            }
          }
        });
        return Promise.all(subTasks);
      });
      return Promise.all(tasks);
    }).then(function (listsOfFetchTasks) {
      // fetch in as few http requests as possible
      var typesToIds = {};
      listsOfFetchTasks.forEach(function (fetchTasks) {
        fetchTasks.forEach(function (fetchTask) {
          if (!fetchTask) {
            return;
          }
          typesToIds[fetchTask.relatedType] =
            (typesToIds[fetchTask.relatedType] || []).concat(fetchTask.relatedIds);
        });
      });

      return utils.series(Object.keys(typesToIds).map(function (relatedType) {
        var relatedIds = uniq(typesToIds[relatedType]);
        return function () {return _find(relatedType, relatedIds, foundObjects); };
      })).then(function () {
        var res = {};
        foundObjects.forEach(function (found, type) {
          var typeInfo = getTypeInfo(type);
          var list = res[typeInfo.plural] = [];
          found.forEach(function (obj) {
            list.push(obj);
          });
          //list.sort(lexCompare);
        });
        return res;
      });
    });
  }

  function putAttachment(type, obj, attachmentId, attachment, attachmentType) {
    var dbDocId = serialize(type, obj.id);
    var typeInfo = getTypeInfo(type);
    return Promise.resolve().then(function () {
      return db.putAttachment(dbDocId, attachmentId, obj.rev, attachment, attachmentType);
    }).then(function (pouchRes) {
      var res = {};
      res[typeInfo.plural] = [extend(true, obj, {
        id: deserialize(pouchRes.id),
        rev: pouchRes.rev
      })];
      return res;
    });
  }

  function removeAttachment(type, obj, attachmentId) {
    var dbDocId = serialize(type, obj.id);
    var typeInfo = getTypeInfo(type);
    return Promise.resolve().then(function () {
      return db.removeAttachment(dbDocId, attachmentId, obj.rev);
    }).then(function (pouchRes) {
      var res = {};
      res[typeInfo.plural] = [extend(true, obj, {
        id: deserialize(pouchRes.id),
        rev: pouchRes.rev
      })];
      return res;
    });
  }

  function getAttachment(type, id, attachmentId, options) {
    options = options || {};
    return Promise.resolve().then(function () {
      return db.getAttachment(serialize(type, id), attachmentId, options);
    });
  }

  function save(type, obj) {
    return Promise.resolve().then(function () {
      return _save(type, obj);
    });
  }

  function find(type, idOrIds) {
    return Promise.resolve().then(function () {
      return _find(getTypeInfo(type).singular, idOrIds, new collections.Map());
    });
  }
  
  function _findHasMany(type, belongsToKey, belongsToId, foundObjects) {
  	var selector = {
            '_id': {
                '$gt': makeDocID({type: type}),
                '$lt': makeDocID({type: type, id: {}}),
            },
        };
    selector['data.' + belongsToKey] = belongsToId;
    
    //only use opts for return ids or whole doc? returning normal documents is not really good
    return db.find({ selector: selector }).then(function(findRes) {
    	return _parseRelDocs(type, foundObjects, findRes.docs);
    });
  }
  
  function findHasMany(type, belongsToKey, belongsToId) {
    return _findHasMany(type, belongsToKey, belongsToId, new collections.Map());
  }
  
  function del(type, obj) {
    return Promise.resolve().then(function () {
      return _del(type, obj);
    });
  }

  function parseDocID(str) {
    var idx = str.indexOf('_');
    var type = str.substring(0, idx);
    var relId = deserialize(str);

    var defaultType = keysToSchemas.get(type);
    if (!defaultType) {
      var matchingSchemaTypes = schema.filter(
        function (schemaType) { return schemaType.documentType === type; });
      if (matchingSchemaTypes.length > 0) {
        type = matchingSchemaTypes[0].singular;
      }
    }

    return {
      type: type,
      id: relId
    };
  }

  function makeDocID(obj) {
    var type = obj.type;

    var typeInfo = keysToSchemas.get(type);
    if (typeInfo) {
      type = typeInfo.documentType;
    }

    return serialize(type, obj.id);
  }

  db.rel = {
    save: save,
    find: find,
    findHasMany: findHasMany,
    del: del,
    getAttachment: getAttachment,
    putAttachment: putAttachment,
    removeAttachment: removeAttachment,
    parseDocID: parseDocID,
    makeDocID: makeDocID,
    parseRelDocs: parseRelDocs,
    isDeleted: isDeleted,
  };
};

/* istanbul ignore next */
if (typeof window !== 'undefined' && window.PouchDB) {
  window.PouchDB.plugin(exports)
    .plugin(require('pouchdb-find'))
    ;
}
