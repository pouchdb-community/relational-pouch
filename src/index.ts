
import uuid from './uuid';
import uniq from 'uniq';

type RelDB = ReturnType<typeof createRel>;

function createError(str) {
  let err:any = new Error(str);
  err.status = 400;
  return err;
}

const MAX_INT_LENGTH = 16; // max int in JS is 9007199254740992
const TYPE_UNDEF = '0';
const TYPE_NUM = '1';
const TYPE_STRING = '2';
const TYPE_OBJ = '3';

function serialize(type, id = undefined) {
  // simple collation that goes like this:
  // undefined < numbers < strings < object
  let res = type.replace('_', '') + '_';
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
  let idx = str.indexOf('_');
  let collationType = str.charAt(idx + 1);
  let id = str.substring(idx + 3);
  if (collationType === TYPE_NUM) {
    return parseInt(id, 10);
  }
  return id;
}

function setSchema<T extends {} = {}>(this: PouchDB.Database<T>, schema) {
  let db = this as PouchDB.RelDatabase<T>;// & {rel:any} 

  let keysToSchemas = new Map();
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
        let relationDef = type.relations[field];
        if (Object.keys(relationDef).length !== 1) {
          throw new Error('Invalid relationship definition for: ' + field);
        }
        let relationType = Object.keys(relationDef)[0];
        let relatedField = relationDef[relationType];
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
  
  db.rel = createRel(db as PouchDB.Database<T>, keysToSchemas, schema);
  
  return db;
}

function createRel(db:PouchDB.Database, keysToSchemas:any, schema:any) {
  /**
   * Transform a relational object into a PouchDB doc.
   */
  function toRawDoc(typeInfo, obj) {
    obj = Object.assign({}, obj);
    let doc:any = {};

    if (obj.rev) {
      doc._rev = obj.rev;
      delete obj.rev;
    }

    if (obj.attachments) {
      doc._attachments = obj.attachments;
      delete obj.attachments;
    }

    let id = obj.id || uuid();
    delete obj.id;
    doc._id = serialize(typeInfo.documentType, id);

    if (typeInfo.relations) {
      Object.keys(typeInfo.relations).forEach(function (field) {
        let relationDef = typeInfo.relations[field];
        let relationType = Object.keys(relationDef)[0];

        if (relationType === 'belongsTo') {
          if (obj[field] && typeof obj[field].id !== 'undefined') {
            obj[field] = obj[field].id;
          }
        } else { // hasMany
          let relatedType = relationDef[relationType];
          if (relatedType.options && relatedType.options.queryInverse) {
            delete obj[field];
            return;
          }
          if (obj[field]) {
            let dependents = obj[field].map(function (dependent) {
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
    let obj = pouchDoc.data;
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

  async function _save(type, obj) {
    let typeInfo = getTypeInfo(type);
    let pouchDoc = toRawDoc(typeInfo, obj);
    let pouchRes = await db.put(pouchDoc);
    let res = {
      id: deserialize(pouchRes.id),
      rev: pouchRes.rev
    };
    return res;
  }

  async function _del(type, obj) {
    let typeInfo = getTypeInfo(type);
    let pouchDoc = toRawDoc(typeInfo, obj);
    //TODO: only map id + rev, not relationships or extra option to only set _deleted to support filtered replication
    pouchDoc = {
      _id : pouchDoc._id,
      _rev : pouchDoc._rev,
      _deleted: true
    };
    await db.put(pouchDoc);
    
    return {deleted: true};
  }

  async function _find(type, idOrIds, foundObjects) {
    let typeInfo = getTypeInfo(type);

    let opts:any = {
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

    let allDocs = await db.allDocs(opts);
    
    return _parseAlldocs(type, foundObjects, allDocs);
  }

  //true = deleted, false = exists, null = not in database
  async function isDeleted(type, id) {
    let typeInfo = getTypeInfo(type);

    let docs = await db.allDocs({keys: [serialize(typeInfo.documentType, id)]});
    let doc = docs.rows[0];
    if ("error" in doc) {
      return null;
    } else {
      return !!doc.value.deleted;
    }
  }

  function _parseAlldocs(type, foundObjects, pouchRes) {
    return _parseRelDocs(type, foundObjects, pouchRes.rows.filter(function (row) {
      return row.doc && !row.value.deleted;
    }).map(function (row) {
      return row.doc;
    }));
  }

  function parseRelDocs(type, pouchDocs) {
    return _parseRelDocs(type, new Map(), pouchDocs);
  }

  async function _parseRelDocs(type, foundObjects, pouchDocs) {
    let typeInfo = getTypeInfo(type);

    if (!foundObjects.has(type)) {
      foundObjects.set(type, new Map());
    }
    
    let listsOfFetchTasks = [];
    
    for (let doc of pouchDocs) {
      let obj = fromRawDoc(doc);

      foundObjects.get(type).set(JSON.stringify(obj.id), obj);

      // fetch all relations
      
      for (let field of Object.keys(typeInfo.relations || {})) {
        let relationDef = typeInfo.relations[field];
        let relationType = Object.keys(relationDef)[0];
        let relatedType = relationDef[relationType];
        let relationOptions: any = {};
        if (typeof relatedType !== 'string') {
          relationOptions = relatedType.options || {};
          if (relationOptions.async) {
            continue;
          }
          if (relationOptions.queryInverse) {
            delete obj[field];
          }
          relatedType = relatedType.type;
        }
        if (relationType === 'belongsTo') {
          let relatedId = obj[field];
          if (typeof relatedId !== 'undefined') {
            listsOfFetchTasks.push({
                relatedType: relatedType,
                relatedIds: [relatedId]
              });
          }
        } else { // hasMany
          if (relationOptions.queryInverse) {
            //TODO: postpone this until next run, to filter out more objects that are already loaded
            await _findHasMany(relatedType, relationOptions.queryInverse,
                                       obj.id, foundObjects);
            continue;
          }

          /* istanbul ignore next */
          let relatedIds = (obj[field] || []).filter(function (relatedId) {
            return typeof relatedId !== 'undefined';
          });
          
          if (relatedIds.length) {
            listsOfFetchTasks.push({
              relatedType: relatedType,
              relatedIds: relatedIds
            });
          }
        }
      }
      
      //listsOfFetchTasks = listsOfFetchTasks.concat(docRelations);
    }
    
    // fetch in as few http requests as possible
    let typesToIds = {};
    listsOfFetchTasks.forEach(function (fetchTask) {
      /* istanbul ignore next */
      if (!fetchTask) {
        return;
      }
      
      let relatedType = fetchTask.relatedType;
      let relatedIds = fetchTask.relatedIds;
      
      for (let i = relatedIds.length - 1; i >= 0; i--) {
        let relatedId = relatedIds[i];
        if (foundObjects.has(relatedType) &&
            foundObjects.get(relatedType).has(JSON.stringify(relatedId))) {
          delete relatedIds[i];
          continue;
        }
      }
      typesToIds[relatedType] =
        (typesToIds[relatedType] || []).concat(fetchTask.relatedIds.filter(Boolean));
    });

    for (let relatedType of Object.keys(typesToIds)) {
      let relatedIds = uniq(typesToIds[relatedType]);
      if (relatedIds.length > 0)
        await _find(relatedType, relatedIds, foundObjects);
    }

    let res:any = {};
    foundObjects.forEach(function (found, type) {
      let typeInfo = getTypeInfo(type);
      let list = res[typeInfo.plural] = [];
      found.forEach(function (obj) {
        list.push(obj);
      });
      //list.sort(lexCompare);
    });
    return res;
  }

  async function putAttachment(type, obj, attachmentId, attachment, attachmentType) {
    let dbDocId = serialize(type, obj.id);
    let typeInfo = getTypeInfo(type);
    let pouchRes = await db.putAttachment(dbDocId, attachmentId, obj.rev, attachment, attachmentType);
    let res = pouchRes.rev;
    return res;
  }

  async function removeAttachment(type, obj, attachmentId) {
    let dbDocId = serialize(type, obj.id);
    let typeInfo = getTypeInfo(type);
    let pouchRes = await db.removeAttachment(dbDocId, attachmentId, obj.rev);
    let res = pouchRes.rev;
    return res;
  }

  async function getAttachment(type, id, attachmentId, options = undefined) {
    options = options || {};
    return db.getAttachment(serialize(type, id), attachmentId, options);
  }

  async function save(type, obj) {
    return _save(type, obj);
  }

  function find(type, idOrIds = undefined) {
    return _find(getTypeInfo(type).singular, idOrIds, new Map());
  }

  async function _findHasMany(type, belongsToKey, belongsToId, foundObjects) {
    let selector = {
            '_id': {
                '$gt': makeDocID({type: type}),
                '$lt': makeDocID({type: type, id: {}}),
            },
        };
    selector['data.' + belongsToKey] = belongsToId;

    //only use opts for return ids or whole doc? returning normal documents is not really good
    let findRes = await db.find({ selector: selector, limit: 2**32-1 });
    return _parseRelDocs(type, foundObjects, findRes.docs);
  }

  function findHasMany(type, belongsToKey, belongsToId) {
    return _findHasMany(type, belongsToKey, belongsToId, new Map());
  }

  function del(type, obj) {
    return _del(type, obj);
  }

  function parseDocID(str) {
    let idx = str.indexOf('_');
    let type = str.substring(0, idx);
    let relId = deserialize(str);

    let defaultType = keysToSchemas.get(type);
    if (!defaultType) {
      let matchingSchemaTypes = schema.filter(
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
    let type = obj.type;

    let typeInfo = keysToSchemas.get(type);
    if (typeInfo) {
      type = typeInfo.documentType;
    }

    return serialize(type, obj.id);
  }

  return {
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
    uuid: uuid,
  };
}

export default {setSchema};

declare global {
  namespace PouchDB {
    interface Static {
      //TODO: return PluggedInStatic<T>, which overwrites new and default to return extended Database interface
      // so we don't just extend the namespace, but instead really change the result of .plugin
      
      plugin<T extends {}>(plugin: T): Static;
      //plugin(plugin: function(Static)): Static;
    }
    
    interface Database<Content extends {} = {}> {
      setSchema<T extends {} = Content>(schema: any): RelDatabase<T>;
    }
    
    interface RelDatabase <Content extends {} = {}> extends Database<Content> {
      rel: RelDB;
    }
  }
}

