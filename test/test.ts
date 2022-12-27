import {createBlob} from 'blob-util';

import Pouch from 'pouchdb-core';
import indexeddb from 'pouchdb-adapter-indexeddb';
//import memory from 'pouchdb-adapter-memory';
import http from 'pouchdb-adapter-http';
import mapreduce from 'pouchdb-mapreduce';
import find from 'pouchdb-find';

import rel from '../src/';

import * as chai from 'chai';
import * as chaiAsPromised from 'chai-as-promised';

Pouch
  .plugin(indexeddb)
  //.plugin(memory)
  .plugin(http)
  .plugin(mapreduce)
  .plugin(find)
  .plugin(rel);

chai.use(chaiAsPromised);

//
// more variables you might want
//
var should = chai.should();

var dbs = 'testdb' + Math.random() +
    ',http://' + (process.env.RELATIONAL_POUCH_DB_AUTH || '') + 'localhost:5984/testdb' + Math.round(Math.random() * 100000);

dbs.split(',').forEach(function (db) {
  var dbType = /^http/.test(db) ? 'http' : 'local';
  tests(db, dbType);
});

function tests(dbName, dbType) {
  var rootdb:PouchDB.Database<any>;

  beforeEach(function () {
    rootdb = new Pouch(dbName);
    return rootdb;
  });
  afterEach(function () {
    return rootdb.getIndexes().then(function(data) {
      var deleteIndexPromises = data.indexes.map(function(index) {
          return index.ddoc ? (rootdb.deleteIndex(index)) : null;
        });
      return Promise.all(deleteIndexPromises);
    }).catch(function() {
      //may fail on http
    }).then(function() {
      return rootdb.destroy();
    });
  });

  describe(dbType + ': basic tests', function () {
    this.timeout(30000);

    it('should barf on bad types', function () {
      let db = rootdb.setSchema([{
        singular: 'post',
        plural: 'posts'
      }]);

      return db.rel.save('unknown', {}).then(function (res) {
        should.not.exist(res);
      }).catch(function (err) {
        should.exist(err);
      });
    });

    it('makeDocID and parseDocID produce symmetrical return vals', function () {
      let db = rootdb.setSchema([{
        singular: 'post',
        plural: 'posts'
      }]);

      var initialId = 'post_2_abc123';
      var parsedId = db.rel.parseDocID(initialId);
      var currentId = db.rel.makeDocID(parsedId);

      currentId.should.equal(initialId);
    });

    it('allows makeDocID for an unknown type', function () {
      let db = rootdb.setSchema([]);

      db.rel.makeDocID({ type: 'something', id: 'quux' }).should.equal('something_2_quux');
    });

    it('allows parseDocID for an unknown type', function () {
      let db = rootdb.setSchema([]);

      db.rel.parseDocID('something_2_bar').should.deep.equal({ type: 'something', id: 'bar' });
    });

    it('should store blog posts', function () {
      let db = rootdb.setSchema([{
        singular: 'post',
        plural: 'posts'
      }]);

      var title = 'Rails is Omakase';
      var text = 'There are a lot of ala carte blah blah blah';

      return db.rel.save('post', {
        title: title,
        text: text
      }).then(function (res) {
        should.exist(res);
        res.id.should.be.a('string');
        res.rev.should.be.a('string');
      });
    });
    it('should store blog posts with an id', function () {

      let db = rootdb.setSchema([{
        singular: 'post',
        plural: 'posts'
      }]);

      var title = 'Rails is Omakase';
      var text = 'There are a lot of ala carte blah blah blah';
      var id = 'foobarbaz';

      return db.rel.save('post', {
        title: title,
        text: text,
        id: id
      }).then(function (res) {
        should.exist(res);
        res.id.should.be.a('string');
        res.rev.should.be.a('string');
        res.id.should.equal(id);
      });
    });

    it('should store blog posts with an int id', function () {

      let db = rootdb.setSchema([{
        singular: 'post',
        plural: 'posts'
      }]);

      var title = 'Rails is Omakase';
      var text = 'There are a lot of ala carte blah blah blah';
      var id = 1;

      return db.rel.save('post', {
        title: title,
        text: text,
        id: id
      }).then(function (res) {
        should.exist(res);
        res.id.should.be.a('number');
        res.rev.should.be.a('string');
        res.id.should.equal(id);
      });
    });

    it('should update blog posts', function () {

      let db = rootdb.setSchema([{
        singular: 'post',
        plural: 'posts'
      }]);

      var title = 'Rails is Omakase';
      var text = 'There are a lot of ala carte blah blah blah';
      var id = 1;
      var post:any = {
        title: title,
        text: text,
        id: id
      };

      return db.rel.save('post', post).then(function (res) {
        should.exist(res);
        res.rev.should.be.a('string');
        res.id.should.be.a('number');
        res.id.should.equal(id);
        Object.assign(post, res);
        post.title = 'Rails is Unagi';
        return db.rel.save('post', post);
      }).then(function (res) {
        res.rev.should.be.a('string');
        res.id.should.be.a('number');
        res.id.should.equal(id);
        res.rev.should.not.equal(post.rev);
      });
    });
    
    it('fails on a rev conflict', function () {

      let db = rootdb.setSchema([{
        singular: 'post',
        plural: 'posts'
      }]);
      
      var post:any = {
        title: "Some title",
        id: "postid"
      };
      
      return db.rel.save('post', post).then(function (res) {
        return db.rel.save('post', post);
      }).should.be.rejected;
    });
    
    it('should find blog posts', function () {

      let db = rootdb.setSchema([{
        singular: 'post',
        plural: 'posts'
      }]);


      return db.rel.save('post', {
        title: 'Rails is Omakase',
        text: 'There are a lot of ala carte blah blah blah',
        id: 1
      }).then(function () {
        return db.rel.save('post', {
          title: 'Rails is Unagi',
          text: 'Declicious unagi',
          id: 2
        });
      }).then(function () {
        return db.rel.find('post');
      }).then(function (res) {
        res.posts.forEach(function (post) {
          post.rev.should.be.a('string');
          delete post.rev;
        });
        res.should.deep.equal({
          posts: [
            {
              title: 'Rails is Omakase',
              text: 'There are a lot of ala carte blah blah blah',
              id: 1
            },
            {
              title: 'Rails is Unagi',
              text: 'Declicious unagi',
              id: 2
            }
          ]
        });
      });
    });

    it('should orders correctly', function () {

      let db = rootdb.setSchema([{
        singular: 'post',
        plural: 'posts'
      }]);


      return db.rel.save('post', {
        title: 'Rails is Omakase',
        text: 'There are a lot of ala carte blah blah blah',
        id: 1
      }).then(function () {
        return db.rel.save('post', {
          title: 'Rails is Unagi',
          text: 'Declicious unagi',
          id: 2
        });
      }).then(function () {
        return db.rel.save('post', {
          title: 'Rails is moar unagi',
          text: 'Moar unagi',
          id: 10
        });
      }).then(function () {
        return db.rel.find('post');
      }).then(function (res) {
        res.posts.forEach(function (post) {
          post.rev.should.be.a('string');
          delete post.rev;
        });
        res.should.deep.equal({
          posts: [
            {
              title: 'Rails is Omakase',
              text: 'There are a lot of ala carte blah blah blah',
              id: 1
            },
            {
              title: 'Rails is Unagi',
              text: 'Declicious unagi',
              id: 2
            },
            {
              title: 'Rails is moar unagi',
              text: 'Moar unagi',
              id: 10
            }
          ]
        });
      });
    });

    it('should find empty blog posts', function () {

      let db = rootdb.setSchema([{
        singular: 'post',
        plural: 'posts'
      }]);

      return db.rel.find('post').then(function (res) {
        res.should.deep.equal({
          posts: []
        });
      });
    });

    it('should find stuff that doesnt exist', function () {

      let db = rootdb.setSchema([{
        singular: 'post',
        plural: 'posts'
      }]);

      return db.rel.find('post', 'foo').then(function (res) {
        res.should.deep.equal({
          posts: []
        });
        return db.rel.find('post', ['foo']);
      }).then(function (res) {
        res.should.deep.equal({
          posts: []
        });
      });
    });

    it('should separate independent types', function () {

      let db = rootdb.setSchema([
        {
          singular: 'post',
          plural: 'posts'
        },
        {
          singular: 'pokemon',
          plural: 'pokemon'
        }
      ]);

      return db.rel.save('post', {text: 'hey'}).then(function () {
        return db.rel.save('post', {text: 'you'});
      }).then(function () {
        return db.rel.save('pokemon', {name: 'bulbasaur'});
      }).then(function () {
        return db.rel.find('post');
      }).then(function (res) {
        res.posts.should.have.length(2);
        return db.rel.find('pokemon');
      }).then(function (res) {
        res.pokemon.should.have.length(1);
      });
    });

    it('should find a single thing', function () {

      let db = rootdb.setSchema([
        {
          singular: 'post',
          plural: 'posts'
        },
        {
          singular: 'pokemon',
          plural: 'pokemon'
        }
      ]);

      return db.rel.save('post', {text: 'hey', id: 1}).then(function () {
        return db.rel.save('post', {text: 'you', id: 2});
      }).then(function () {
        return db.rel.save('pokemon', {name: 'bulbasaur', id: 1});
      }).then(function () {
        return db.rel.find('post', 1);
      }).then(function (res) {
        delete res.posts[0].rev;
        res.should.deep.equal({posts: [{
          text: 'hey',
          id: 1
        }]});
        return db.rel.find('pokemon', 1);
      }).then(function (res) {
        delete res.pokemon[0].rev;
        res.should.deep.equal({pokemon: [{
          name: 'bulbasaur',
          id: 1
        }]});
      });
    });

    it('should find multiple things', function () {

      let db = rootdb.setSchema([
        {
          singular: 'post',
          plural: 'posts'
        },
        {
          singular: 'pokemon',
          plural: 'pokemon'
        }
      ]);

      return db.rel.save('post', {text: 'hey', id: 1}).then(function () {
        return db.rel.save('post', {text: 'you', id: 2});
      }).then(function () {
        return db.rel.save('pokemon', {name: 'bulbasaur', id: 1});
      }).then(function () {
        return db.rel.find('post', [1, 2]);
      }).then(function (res) {
        delete res.posts[0].rev;
        delete res.posts[1].rev;
        res.should.deep.equal({posts: [
          {
            text: 'hey',
            id: 1
          },
          {
            text: 'you',
            id: 2
          }
        ]});
        return db.rel.find('pokemon', [1]);
      }).then(function (res) {
        delete res.pokemon[0].rev;
        res.should.deep.equal({pokemon: [{
          name: 'bulbasaur',
          id: 1
        }]});
      });
    });

    it('should find using a documentType if provided', function () {
      let db = rootdb.setSchema([
        {
          singular: 'postSummary',
          plural: 'postSummaries',
          documentType: 'post'
        }
      ]);

      return db.put({ data: { text: 'Oh no' }, _id: 'post_2_oh' }).then(function () {
        return db.rel.find('postSummary', 'oh');
      }).then(function (res) {
        delete res.postSummaries[0].rev;
        res.should.deep.equal({ postSummaries: [{
          id: 'oh',
          text: 'Oh no'
        }] });
      });
    });

    it('should save using a documentType if provided', function () {
      let db = rootdb.setSchema([
        {
          singular: 'postSummary',
          plural: 'postSummary',
          documentType: 'post'
        }
      ]);

      return db.rel.save('postSummary', { title: 'Hey', id: 'hello' }).then(function () {
        return db.get('post_2_hello');
      }).then(function (res) {
        delete res._rev;
        res.should.deep.equal({
          _id: 'post_2_hello',
          data: {
            title: 'Hey'
          }
        });
      });
    });

    it('should use the documentType for makeDocID', function () {
      let db = rootdb.setSchema([
        {
          singular: 'post',
          plural: 'posts'
        },
        {
          singular: 'postSummary',
          plural: 'postSummaries',
          documentType: 'post'
        }
      ]);

      db.rel.makeDocID({ type: 'postSummary', id: 'foo' }).should.equal('post_2_foo');
    });

    it('should use the default documentType for parseDocID, if present', function () {
      let db = rootdb.setSchema([
        {
          singular: 'post',
          plural: 'posts'
        },
        {
          singular: 'postSummary',
          plural: 'postSummaries',
          documentType: 'post'
        }
      ]);

      db.rel.parseDocID('post_2_bar').should.deep.equal({ type: 'post', id: 'bar' });
    });

    it('should use a type with a matching documentType for parseDocID, if no default', function () {
      let db = rootdb.setSchema([
        {
          singular: 'postSummary',
          plural: 'postSummaries',
          documentType: 'post'
        }
      ]);

      db.rel.parseDocID('post_2_bar').should.deep.equal({ type: 'postSummary', id: 'bar' });
    });
    
    it('should save a snapshot, so changes after rel.save should be ignored', function () {
      let db = rootdb.setSchema([{
        singular: 'post',
        plural: 'posts'
      }]);
      
      let titleBeforeSaving = "Title before saving";
      let post = {
        title: titleBeforeSaving,
        id: 'snapshot'
      };
      
      let savePromise = db.rel.save('post', post);
      post.title = "Title after saving";

      return savePromise.then(function () {
        return db.rel.find('post', post.id);
      }).then(function (res) {
        res.posts[0].title.should.equal(titleBeforeSaving);
      });
    });

    it('can delete', function () {

      let db = rootdb.setSchema([
        {
          singular: 'post',
          plural: 'posts'
        }
      ]);

      return db.rel.save('post', {text: 'hey', id: 1}).then(function () {
        return db.rel.save('post', {text: 'you', id: 2});
      }).then(function () {
        return db.rel.save('post', {text: 'there', id: 3});
      }).then(function () {
        return db.rel.find('post', 3);
      }).then(function (res) {
        return db.rel.del('post', res.posts[0]);
      }).then(function () {
        return db.rel.find('post', 3);
      }).then(function (res) {
        res.should.deep.equal({posts: []});
        return db.rel.find('post', [3]);
      }).then(function (res) {
        res.should.deep.equal({posts: []});
        return db.rel.find('post');
      }).then(function (res) {
        delete res.posts[0].rev;
        delete res.posts[1].rev;
        res.should.deep.equal({posts: [
          {
            text: 'hey',
            id: 1
          },
          {
            text: 'you',
            id: 2
          }
        ]});
      });
    });
  });

  describe(dbType + ': attachments', function () {
    this.timeout(30000);

    it('Adds attachment information', function () {

      let db = rootdb.setSchema([{
        singular: 'post',
        plural: 'posts'
      }]);

      return db.rel.save('post', {
        title: "Files are cool",
        text: "In order to have nice blog posts we need to be able to add files",
        id: 'with_attachment'
      }).then(function () {
        return db.get("post_2_with_attachment");
      }).then(function (res) {
        var attachment;
        if (typeof window !== 'undefined') {
          attachment = createBlob(['Is there life on Mars?']);
        } else {
          attachment = Buffer.from('Is there life on Mars?');
        }
        return db.putAttachment(res._id, "file", res._rev, attachment, 'text/plain');
      }).then(function () {
        return db.rel.find('post', 'with_attachment');
      }).then(function (res) {
        var post = res.posts[0];
        post.attachments.file.content_type.should.equal('text/plain');
      });
    });

    it('When saving the new document, saves the attachment', function () {
      let db = rootdb.setSchema([{
        singular: 'post',
        plural: 'posts'
      }]);

      var attachment;
      if (typeof window !== 'undefined') {
        attachment = createBlob(['Is there life on Mars?']);
      } else {
        attachment = Buffer.from('Is there life on Mars?');
      }

      return db.rel.save('post', {
        id: 'with_attachment_info',
        title: "Files are cool",
        text: "In order to have nice blog posts we need to be able to add files",
        attachments: {
          foo: {
            content_type: 'text/plain',
            data: attachment
          }
        }
      }).then(function () {
        return db.rel.find('post', 'with_attachment_info');
      }).then(function (res) {
        var post = res.posts[0];
        should.exist(post.attachments);
        should.exist(post.attachments.foo);
        post.attachments.foo.content_type.should.equal('text/plain');
      });
    });

    it('When updating the existing document, keeps the attachment', function () {
      let db = rootdb.setSchema([{
        singular: 'post',
        plural: 'posts'
      }]);

      var attachment;
      if (typeof window !== 'undefined') {
        attachment = createBlob(['Is there life on Mars?']);
      } else {
        attachment = Buffer.from('Is there life on Mars?');
      }

      return db.rel.save('post', {
        id: 'with_attachment_info',
        title: "Files are cool",
        text: "In order to have nice blog posts we need to be able to add files",
        attachments: {
          foo: {
            content_type: 'text/plain',
            data: attachment
          }
        }
      }).then(function () {
        return db.rel.find('post', 'with_attachment_info');
      }).then(function (res) {
        // Update the post
        var post = res.posts[0];
        post.title = "Files are VERY cool";
        return db.rel.save('post', post);
      }).then(function () {
        // Reload the post
        return db.rel.find('post', 'with_attachment_info');
      }).then(function (res) {
        var post = res.posts[0];
        should.exist(post.attachments);
        should.exist(post.attachments.foo);
        post.attachments.foo.content_type.should.equal('text/plain');
      });
    });

    it('Removes the attachment through removal of attachments field', function () {
      let db = rootdb.setSchema([{
        singular: 'post',
        plural: 'posts'
      }]);

      var attachment;
      if (typeof window !== 'undefined') {
        attachment = createBlob(['Is there life on Mars?']);
      } else {
        attachment = Buffer.from('Is there life on Mars?');
      }

      return db.rel.save('post', {
        id: 'with_attachment_info',
        title: "Files are cool",
        text: "In order to have nice blog posts we need to be able to add files",
        attachments: {
          foo: {
            content_type: 'text/plain',
            data: attachment
          }
        }
      }).then(function () {
        return db.rel.find('post', 'with_attachment_info');
      }).then(function (res) {
        // Update the post
        var post = res.posts[0];
        delete post.attachments;
        return db.rel.save('post', post);
      }).then(function () {
        return db.rel.find('post', 'with_attachment_info');
      }).then(function (res) {
        var post = res.posts[0];
        should.not.exist(post.attachments);
      });
    });

    it('Adds attachments through rel.putAttachment', function () {
      let db = rootdb.setSchema([{
        singular: 'post',
        plural: 'posts'
      }]);

      return db.rel.save('post', {
        title: "Files are cool",
        text: "In order to have nice blog posts we need to be able to add files",
        id: 'with_attachment'
      }).then(function() {
        return db.rel.find('post', 'with_attachment');
      }).then(function (res) {
        var attachment;
        var post = res.posts[0];
        if (typeof window !== 'undefined') {
          attachment = createBlob(['Is there life on Mars?']);
        } else {
          attachment = Buffer.from('Is there life on Mars?');
        }
        return db.rel.putAttachment('post', post, "file", attachment, 'text/plain');
      }).then(function () {
        // Todo, check revision update
        return db.rel.find('post', 'with_attachment'); // reload model
      }).then(function (res) {
        var post = res.posts[0];
        post.attachments.file.content_type.should.equal('text/plain');
      });
    });

    it('Get attachments through rel.getAttachment', function () {
      let db = rootdb.setSchema([{
        singular: 'post',
        plural: 'posts'
      }]);

      return db.rel.save('post', {
        title: "Files are cool",
        text: "In order to have nice blog posts we need to be able to add files",
        id: 'with_attachment'
      }).then(function() {
        return db.rel.find('post', 'with_attachment');
      }).then(function (res) {
        var attachment;
        var post = res.posts[0];
        if (typeof window !== 'undefined') {
          attachment = createBlob(['Is there life on Mars?']);
        } else {
          attachment = Buffer.from('Is there life on Mars?');
        }
        return db.rel.putAttachment('post', post, "file", attachment, 'text/plain');
      }).then(function () {
        return db.rel.getAttachment('post', 'with_attachment', 'file');
      }).then(function (attachment) {
        if (typeof window !== 'undefined') {
          var reader = new FileReader();
          reader.onloadend = function () {

            var binary = "";
            var bytes = new Uint8Array(this.result as ArrayBuffer);
            var length = bytes.byteLength;

            for (var i = 0; i < length; i++) {
              binary += String.fromCharCode(bytes[i]);
            }

            binary.should.equal('Is there life on Mars?');
          };
          reader.readAsArrayBuffer(attachment as Blob);
        } else {
          attachment.toString('ascii').should.equal('Is there life on Mars?');
        }
      });
    });

    it('Removes attachments through rel.removeAttachment', function () {
      let db = rootdb.setSchema([{
        singular: 'post',
        plural: 'posts'
      }]);

      return db.rel.save('post', {
        title: "Files are cool",
        text: "In order to have nice blog posts we need to be able to add files",
        id: 'with_attachment'
      }).then(function() {
        return db.rel.find('post', 'with_attachment');
      }).then(function (res) {
        var attachment;
        var post = res.posts[0];
        if (typeof window !== 'undefined') {
          attachment = createBlob(['Is there life on Mars?']);
        } else {
          attachment = Buffer.from('Is there life on Mars?');
        }
        return db.rel.putAttachment('post', post, "file", attachment, 'text/plain');
      }).then(function () {
        return db.rel.find('post', 'with_attachment'); // reload model
      }).then(function (res) {
        var post = res.posts[0];
        return db.rel.removeAttachment('post', post, 'file');
      }).then(function () {
        return db.rel.find('post', 'with_attachment'); // reload model
      }).then(function (res) {
        var post = res.posts[0];
        should.not.exist(post.attachments);
      });
    });

  });

  describe(dbType + ': invalid relations', function () {
    this.timeout(30000);

    it('fails if you include no relations', function () {
      return Promise.resolve().then(function () {
        let db = rootdb.setSchema([{
          singular: 'foo',
          plural: 'foos',
          relations: {}
        }]);
      }).then(function () {
        true.should.equal(false);
      }).catch(function (err) {
        should.exist(err);
      });
    });

    it('fails if you include empty relationship definition', function () {
      return Promise.resolve().then(function () {
        let db = rootdb.setSchema([{
          singular: 'foo',
          plural: 'foos',
          relations: {
            bazes: {}
          }
        }]);
      }).then(function () {
        true.should.equal(false);
      }).catch(function (err) {
        should.exist(err);
      });
    });

    it('fails for unknown entity types', function () {
      return Promise.resolve().then(function () {
        let db = rootdb.setSchema([{
          singular: 'foo',
          plural: 'foos',
          relations: {
            bazes: {hasMany: 'baz'}
          }
        }]);
      }).then(function () {
        true.should.equal(false);
      }).catch(function (err) {
        should.exist(err);
      });
    });

    it('fails for unknown relation types', function () {
      return Promise.resolve().then(function () {
        let db = rootdb.setSchema([
          {
            singular: 'foo',
            plural: 'foos',
            relations: {
              bazes: {hasAFucktonOf: 'baz'}
            }
          },
          {
            singular: 'baz',
            plural: 'bazes'
          }
        ]);
      }).then(function () {
        true.should.equal(false);
      }).catch(function (err) {
        should.exist(err);
      });
    });
  });

  describe(dbType + ': relational tests', function () {
    this.timeout(30000);

    it('does one-to-one', function () {
      let db = rootdb.setSchema([
        {
          singular: 'author',
          plural: 'authors',
          relations: {
            'profile': {belongsTo: 'profile'}
          }
        },
        {
          singular: 'profile',
          plural: 'profiles',
          relations: {
            'author': {belongsTo: 'author'}
          }
        }
      ]);

      return db.rel.save('author', {
        name: 'Stephen King',
        id: 19,
        profile: 21
      }).then(function () {
        return db.rel.save('profile', {
          description: 'nice masculine jawline',
          id: 21,
          author: 19
        });
      }).then(function () {
        return db.rel.find('author');
      }).then(function (res) {
        res.authors[0].rev.should.be.a('string');
        delete res.authors[0].rev;

        res.profiles[0].rev.should.be.a('string');
        delete res.profiles[0].rev;
        res.should.deep.equal({
          "authors": [
            {
              "name": "Stephen King",
              "profile": 21,
              "id": 19
            }
          ],
          "profiles": [
            {
              "description": "nice masculine jawline",
              "author": 19,
              "id": 21
            }
          ]
        });
      });
    });

    it('does one-to-many with empty dependents', function () {
      let db = rootdb.setSchema([
        {
          singular: 'author',
          plural: 'authors',
          relations: {
            'books': {hasMany: 'book'}
          }
        },
        {
          singular: 'book',
          plural: 'books',
          relations: {
            'author': {belongsTo: 'author'}
          }
        }
      ]);

      return db.rel.save('author', {
        name: 'Stephen King',
        id: 19,
        profile: 21
      }).then(function () {
        return db.rel.find('author');
      }).then(function (res) {
        res.authors[0].rev.should.be.a('string');
        delete res.authors[0].rev;
        res.should.deep.equal({
          "authors": [
            {
              "name": "Stephen King",
              "profile": 21,
              "id": 19,
              "books": []
            }
          ]
        });
      });
    });

    it('does one-to-many with several entities', function () {
      let db = rootdb.setSchema([
        {
          singular: 'author',
          plural: 'authors',
          relations: {
            'books': {hasMany: 'book'}
          }
        },
        {
          singular: 'book',
          plural: 'books',
          relations: {
            'author': {belongsTo: 'author'}
          }
        }
      ]);

      return db.rel.save('author', {
        name: 'Stephen King',
        id: 19,
        books: [1]
      }).then(function () {
        return db.rel.save('author', {
          name: 'George R. R. Martin',
          id: 1,
          books: [6, 7]
        });
      }).then(function () {
        return db.rel.save('book', {
          title: 'It',
          id: 1,
          author: 19
        });
      }).then(function () {
        return db.rel.save('book', {
          title: 'A Game of Thrones',
          id: 6,
          author: 1
        });
      }).then(function () {
        return db.rel.save('book', {
          title: 'The Hedge Knight',
          id: 7,
          author: 1
        });
      }).then(function () {
        return db.rel.find('author');
      }).then(function (res) {
        ['authors', 'books'].forEach(function (type) {
          res[type].forEach(function (obj) {
            obj.rev.should.be.a('string');
            delete obj.rev;
          });
        });
        res.should.deep.equal({
          "authors": [
            {
              "name": "George R. R. Martin",
              "books": [
                6,
                7
              ],
              "id": 1
            },
            {
              "name": "Stephen King",
              "books": [
                1
              ],
              "id": 19
            }
          ],
          "books": [
            {
              "title": "It",
              "id": 1,
              author: 19
            },
            {
              "title": "A Game of Thrones",
              "id": 6,
              author: 1
            },
            {
              "title": "The Hedge Knight",
              "id": 7,
              author: 1
            }
          ]
        });
      });
    });
    it('does many-to-many with recursive relationship', function () {
      let db = rootdb.setSchema([
        {
          singular: 'author',
          plural: 'authors',
          relations: {
            'books': {hasMany: 'book'},
            'publisher': {belongsTo: 'publisher'}
          }
        },
        {
          singular: 'book',
          plural: 'books',
          relations: {
            'authors': {hasMany: 'author'},
            'publisher': {belongsTo: 'publisher'}
          }
        },
        {
          singular: 'publisher',
          plural: 'publishers',
          relations: {
            'authors': {hasMany: 'author'},
            'books': {hasMany: 'book'}
          }
        }
      ]);

      return db.rel.save('author', {
        name: 'Stephen King',
        id: 'king',
        books: ['it', 'talisman'],
        publisher: 'penguin'
      }).then(function () {
        return db.rel.save('author', {
          name: 'Peter Straub',
          id: 'straub',
          books: ['ghost', 'talisman'],
          publisher: 'bantam'
        });
      }).then(function () {
        return db.rel.save('book', {
          title: 'It',
          id: 'it',
          authors: ['king'],
          publisher: 'penguin'
        });
      }).then(function () {
        return db.rel.save('book', {
          title: 'The Talisman',
          id: 'talisman',
          authors: ['king', 'straub'],
          publisher: 'penguin'
        });
      }).then(function () {
        return db.rel.save('book', {
          title: 'Ghost Story',
          id: 'ghost',
          authors: ['straub'],
          publisher: 'bantam'
        });
      }).then(function () {
        return db.rel.save('publisher', {
          name: 'Bantam',
          id: 'bantam',
          authors: ['straub', 'melville'],
          books: ['moby', 'ghost']
        });
      }).then(function () {
        return db.rel.save('publisher', {
          title: 'Penguin',
          id: 'penguin',
          authors: ['orwell', 'king'],
          books: ['it', 'talisman', '1984']
        });
      }).then(function () {
        return db.rel.save('book', {
          title: 'Moby Dick',
          id: 'moby',
          authors: ['melville'],
          publisher: 'bantam'
        });
      }).then(function () {
        return db.rel.save('author', {
          name: 'Herman Melville',
          id: 'melville',
          books: ['moby'],
          publisher: 'bantam'
        });
      }).then(function () {
        return db.rel.save('book', {
          title: '1984',
          id: '1984',
          authors: ['orwell'],
          publisher: 'penguin'
        });
      }).then(function () {
        return db.rel.save('author', {
          name: 'George Orwell',
          id: 'orwell',
          books: ['1984'],
          publisher: 'penguin'
        });
      }).then(function () {
        return db.rel.find('author');
      }).then(function (res) {
        ['authors', 'books', 'publishers'].forEach(function (type) {
          res[type].forEach(function (obj) {
            obj.rev.should.be.a('string');
            delete obj.rev;
          });
        });
        res.should.deep.equal({
          "authors": [
            {
              "name": "Stephen King",
              "books": [
                "it",
                "talisman"
              ],
              "publisher": "penguin",
              "id": "king"
            },
            {
              "name": "Herman Melville",
              "books": [
                "moby"
              ],
              "publisher": "bantam",
              "id": "melville"
            },
            {
              "name": "George Orwell",
              "books": [
                "1984"
              ],
              "publisher": "penguin",
              "id": "orwell"
            },
            {
              "name": "Peter Straub",
              "books": [
                "ghost",
                "talisman"
              ],
              "publisher": "bantam",
              "id": "straub"
            }
          ],
          "books": [
            {
              "title": "1984",
              "authors": [
                "orwell"
              ],
              "publisher": "penguin",
              "id": "1984"
            },
            {
              "title": "Ghost Story",
              "authors": [
                "straub"
              ],
              "publisher": "bantam",
              "id": "ghost"
            },
            {
              "title": "It",
              "authors": [
                "king"
              ],
              "publisher": "penguin",
              "id": "it"
            },
            {
              "title": "Moby Dick",
              "authors": [
                "melville"
              ],
              "publisher": "bantam",
              "id": "moby"
            },
            {
              "title": "The Talisman",
              "authors": [
                "king",
                "straub"
              ],
              "publisher": "penguin",
              "id": "talisman"
            }
          ],
          "publishers": [
            {
              "name": "Bantam",
              "authors": [
                "straub",
                "melville"
              ],
              "books": [
                "moby",
                "ghost"
              ],
              "id": "bantam"
            },
            {
              "title": "Penguin",
              "authors": [
                "orwell",
                "king"
              ],
              "books": [
                "it",
                "talisman",
                "1984"
              ],
              "id": "penguin"
            }
          ]
        });
      });
    });

    if (dbType === 'local') { //pouchdb-find only supported on cloudant and couch >= 2.0
    it('does parseRelDocs', function () {
      let db = rootdb.setSchema([
        {
          singular: 'author',
          plural: 'authors',
          relations: {
            'books': {hasMany: { type: 'book'}}
          }
        },
        {
          singular: 'book',
          plural: 'books',
          relations: {
            'author': {belongsTo: 'author'}
          }
        }
      ]);

      return db.createIndex({index: { fields: ['data.name'] }}).then(function() {
        return db.rel.save('author', {
          name: 'Stephen King',
          id: 19,
          books: [1]
        });
      }).then(function () {
        return db.rel.save('book', {
          title: 'It',
          id: 1,
          author: 19
        });
      }).then(function () {
        //not a rel.find
        return db.find({selector: {'data.name': 'Stephen King'}});
      }).then(function(findRes) {
        return db.rel.parseRelDocs('author', findRes.docs);
      }).then(function (res) {
        ['authors', 'books'].forEach(function (type) {
          res[type].forEach(function (obj) {
            obj.rev.should.be.a('string');
            delete obj.rev;
          });
        });
        res.should.deep.equal({
          "authors": [
            {
              "name": "Stephen King",
              "id": 19,
              "books": [1]
            }
          ],
          "books": [
            {
              "title": "It",
              "id": 1,
              author: 19
            }
          ]
        });
      });
    });

    it('does one-to-many without saving hasMany side', function () {
      let db = rootdb.setSchema([
        {
          singular: 'author',
          plural: 'authors',
          relations: {
            'books': {hasMany: { type: 'book', options: {queryInverse: 'author'}}}
          }
        },
        {
          singular: 'book',
          plural: 'books',
          relations: {
            'author': {belongsTo: 'author'}
          }
        }
      ]);

      return db.createIndex({index: { fields: ['data.author', '_id'] }}).then(function() {
        return db.rel.save('author', {
          name: 'Stephen King',
          id: 19,
        });
      }).then(function () {
        return db.rel.save('book', {
          title: 'It',
          id: 1,
          author: 19
        });
      }).then(function () {
        return db.rel.find('author');
      }).then(function (res) {
        ['authors', 'books'].forEach(function (type) {
          res[type].forEach(function (obj) {
            obj.rev.should.be.a('string');
            delete obj.rev;
          });
        });
        res.should.deep.equal({
          "authors": [
            {
              "name": "Stephen King",
              "id": 19
            }
          ],
          "books": [
            {
              "title": "It",
              "id": 1,
              author: 19
            }
          ]
        });
      });
    });

    it('does findHasMany', function () {
      let db = rootdb.setSchema([
        {
          singular: 'author',
          plural: 'authors',
          relations: {
            //omit relation should also work
            'books': {hasMany: { type: 'book', options: {async: true, queryInverse: 'author'}}}
          }
        },
        {
          singular: 'book',
          plural: 'books',
          relations: {
            'author': {belongsTo: { type: 'author', options: {async: true}}}
          }
        }
      ]);

      return db.createIndex({index: { fields: ['data.author', '_id'] }}).then(function() {
        return db.rel.save('author', {
          name: 'Stephen King',
          id: 19,
        });
      }).then(function () {
        return db.rel.save('book', {
          title: 'It',
          id: 1,
          author: 19
        });
      }).then(function () {
        return db.rel.find('author');
      }).then(function (res) {
        ['authors'].forEach(function (type) {
          res[type].forEach(function (obj) {
            obj.rev.should.be.a('string');
            delete obj.rev;
          });
        });
        res.should.deep.equal({
          "authors": [
            {
              "name": "Stephen King",
              "id": 19
            }
          ]
        });

        return db.rel.findHasMany('book', 'author', 19);
      }).then(function(res) {
        ['books'].forEach(function (type) {
          res[type].forEach(function (obj) {
            obj.rev.should.be.a('string');
            delete obj.rev;
          });
        });
        res.should.deep.equal({
          "books": [
            {
              "title": "It",
              "id": 1,
              author: 19
            }
          ]
        });
      });
    });
    }

    it('does many-to-many with several entities', function () {
      let db = rootdb.setSchema([
        {
          singular: 'author',
          plural: 'authors',
          relations: {
            'books': {hasMany: 'book'}
          }
        },
        {
          singular: 'book',
          plural: 'books',
          relations: {
            'authors': {hasMany: 'author'}
          }
        }
      ]);

      return db.rel.save('author', {
        name: 'Stephen King',
        id: 19,
        books: [1, 2]
      }).then(function () {
          return db.rel.save('author', {
            name: 'Peter Straub',
            id: 2,
            books: [2, 3]
          });
        }).then(function () {
          return db.rel.save('book', {
            title: 'It',
            id: 1,
            authors: [19]
          });
        }).then(function () {
          return db.rel.save('book', {
            title: 'The Talisman',
            id: 2,
            authors: [19, 2]
          });
        }).then(function () {
          return db.rel.save('book', {
            title: 'Ghost Story',
            id: 3,
            authors: [2]
          });
        }).then(function () {
          return db.rel.find('author');
        }).then(function (res) {
          ['authors', 'books'].forEach(function (type) {
            res[type].forEach(function (obj) {
              obj.rev.should.be.a('string');
              delete obj.rev;
            });
          });
          res.should.deep.equal({
            "authors": [
              {
                "name": "Peter Straub",
                "books": [
                  2,
                  3
                ],
                "id": 2
              },
              {
                "name": "Stephen King",
                "books": [
                  1,
                  2
                ],
                "id": 19
              }
            ],
            "books": [
              {
                "title": "It",
                "authors": [
                  19
                ],
                "id": 1
              },
              {
                "title": "The Talisman",
                "authors": [
                  19,
                  2
                ],
                "id": 2
              },
              {
                "title": "Ghost Story",
                "authors": [
                  2
                ],
                "id": 3
              }
            ]
          });
        });
    });

    it('should fetch all authors even with empty relations', function () {
      let db = rootdb.setSchema([
        {
          singular: 'author',
          plural: 'authors',
          relations: {
            'books': {hasMany: 'book'}
          }
        },
        {
          singular: 'book',
          plural: 'books',
          relations: {
            'authors': {hasMany: 'author'}
          }
        }
      ]);

      return db.rel.save('author', {
        name: 'Stephen King',
        id: 19,
        books: [1]
      }).then(function () {
          return db.rel.save('author', {
            name: 'Peter Straub',
            id: 2,
            books: []
          });
        }).then(function () {
          return db.rel.save('book', {
            title: 'It',
            id: 1,
            authors: [19]
          });
        }).then(function () {
          return db.rel.find('authors');
        }).then(function (res) {
          ['authors', 'books'].forEach(function (type) {
            res[type].forEach(function (obj) {
              obj.rev.should.be.a('string');
              delete obj.rev;
            });
          });
          res.should.deep.equal({
            "authors": [
              {
                "name": "Peter Straub",
                "books": [],
                "id": 2
              },
              {
                "name": "Stephen King",
                "books": [
                  1
                ],
                "id": 19
              }
            ],
            "books": [
              {
                "title": "It",
                "authors": [
                  19
                ],
                "id": 1
              }
            ]
          });
        });
    });

    it('does one-to-many', function () {
      let db = rootdb.setSchema([
        {
          singular: 'author',
          plural: 'authors',
          relations: {
            profile: {belongsTo: 'profile'},
            books: {hasMany: 'books'}
          }
        },
        {
          singular: 'profile',
          plural: 'profiles',
          relations: {
            author: {belongsTo: 'author'}
          }
        },
        {
          singular: 'book',
          plural: 'books',
          relations: {
            author: {belongsTo: 'author'}
          }
        }
      ]);

      return db.rel.save('author', {
        name: 'Stephen King',
        id: 19,
        profile: 21,
        books: [1, 2, 3]
      }).then(function () {
        return db.rel.save('profile', {
          description: 'nice masculine jawline',
          id: 21,
          author: 19
        });
      }).then(function () {
        return db.rel.save('book', {
          id: 1,
          title: 'The Gunslinger'
        });
      }).then(function () {
        return db.rel.save('book', {
          id: 2,
          title: 'The Drawing of the Three'
        });
      }).then(function () {
        return db.rel.save('book', {
          id: 3,
          title: 'The Wastelands'
        });
      }).then(function () {
        return db.rel.find('author');
      }).then(function (res) {
        ['authors', 'profiles', 'books'].forEach(function (type) {
          res[type].forEach(function (obj) {
            obj.rev.should.be.a('string');
            delete obj.rev;
          });
        });
        res.should.deep.equal({
          "authors": [
            {
              "name": "Stephen King",
              "profile": 21,
              "books": [
                1,
                2,
                3
              ],
              "id": 19
            }
          ],
          "profiles": [
            {
              "description": "nice masculine jawline",
              "author": 19,
              "id": 21
            }
          ],
          "books": [
            {
              "title": "The Gunslinger",
              "id": 1
            },
            {
              "title": "The Drawing of the Three",
              "id": 2
            },
            {
              "title": "The Wastelands",
              "id": 3
            }
          ]
        });
      });
    });

    it('does one-to-many with embedded relations', function () {
      let db = rootdb.setSchema([
        {
          singular: 'author',
          plural: 'authors',
          relations: {
            profile: {belongsTo: 'profile'},
            books: {hasMany: 'books'}
          }
        },
        {
          singular: 'profile',
          plural: 'profiles',
          relations: {
            author: {belongsTo: 'author'}
          }
        },
        {
          singular: 'book',
          plural: 'books',
          relations: {
            author: {belongsTo: 'author'}
          }
        }
      ]);

      var profile = {
        description: 'nice masculine jawline',
        id: 21,
        author: 19
      };
      var book1 = {
        id: 1,
        title: 'The Gunslinger'
      };
      var book2 = {
        id: 2,
        title: 'The Drawing of the Three'
      };
      var book3 = {
        id: 3,
        title: 'The Wastelands'
      };
      return db.rel.save('profile', profile).then(function () {
        return db.rel.save('book', book1);
      }).then(function () {
        return db.rel.save('book', book2);
      }).then(function () {
        return db.rel.save('book', book3);
      }).then(function () {
        return db.rel.save('author', {
          name: 'Stephen King',
          id: 19,
          profile: profile,
          books: [book1, book2, book3]
        });
      }).then(function () {
        return db.rel.find('author');
      }).then(function (res) {
        ['authors', 'profiles', 'books'].forEach(function (type) {
          res[type].forEach(function (obj) {
            obj.rev.should.be.a('string');
            delete obj.rev;
          });
        });
        res.should.deep.equal({
          "authors": [
            {
              "name": "Stephen King",
              "profile": 21,
              "books": [
                1,
                2,
                3
              ],
              "id": 19
            }
          ],
          "profiles": [
            {
              "description": "nice masculine jawline",
              "author": 19,
              "id": 21
            }
          ],
          "books": [
            {
              "title": "The Gunslinger",
              "id": 1
            },
            {
              "title": "The Drawing of the Three",
              "id": 2
            },
            {
              "title": "The Wastelands",
              "id": 3
            }
          ]
        });
      });
    });
    it('does one-to-many and keeps the right order', function () {
      let db = rootdb.setSchema([
        {
          singular: 'author',
          plural: 'authors',
          relations: {
            profile: {belongsTo: 'profile'},
            books: {hasMany: 'books'}
          }
        },
        {
          singular: 'profile',
          plural: 'profiles',
          relations: {
            author: {belongsTo: 'author'}
          }
        },
        {
          singular: 'book',
          plural: 'books',
          relations: {
            author: {belongsTo: 'author'}
          }
        }
      ]);

      return db.rel.save('author', {
        name: 'Stephen King',
        id: 19,
        profile: 21,
        books: [3, 1, 2]
      }).then(function () {
        return db.rel.save('profile', {
          description: 'nice masculine jawline',
          id: 21,
          author: 19
        });
      }).then(function () {
        return db.rel.save('book', {
          id: 1,
          title: 'The Gunslinger'
        });
      }).then(function () {
        return db.rel.save('book', {
          id: 2,
          title: 'The Drawing of the Three'
        });
      }).then(function () {
        return db.rel.save('book', {
          id: 3,
          title: 'The Wastelands'
        });
      }).then(function () {
        return db.rel.find('author');
      }).then(function (res) {
        ['authors', 'profiles', 'books'].forEach(function (type) {
          res[type].forEach(function (obj) {
            obj.rev.should.be.a('string');
            delete obj.rev;
          });
        });
        res.should.deep.equal({
          "authors": [
            {
              "name": "Stephen King",
              "profile": 21,
              "books": [
                3,
                1,
                2
              ],
              "id": 19
            }
          ],
          "profiles": [
            {
              "description": "nice masculine jawline",
              "author": 19,
              "id": 21
            }
          ],
          "books": [
            {
              "title": "The Gunslinger",
              "id": 1
            },
            {
              "title": "The Drawing of the Three",
              "id": 2
            },
            {
              "title": "The Wastelands",
              "id": 3
            }
          ]
        });
      });
    });

    it('does sideload if async option is false', function () {
      let db = rootdb.setSchema([
        {
          singular: 'author',
          plural: 'authors',
          relations: {
            books: {hasMany: {type: 'books', options: {async: false}}}
          }
        },
        {
          singular: 'book',
          plural: 'books',
          relations: {
            author: {belongsTo: {type: 'author', options: {async: false}}}
          }
        }
      ]);

      return db.rel.save('author', {
        name: 'Stephen King',
        id: 19,
        books: [1, 2, 3]
      }).then(function () {
        return db.rel.save('book', {
          id: 1,
          title: 'The Gunslinger'
        });
      }).then(function () {
        return db.rel.save('book', {
          id: 2,
          title: 'The Drawing of the Three'
        });
      }).then(function () {
        return db.rel.save('book', {
          id: 3,
          title: 'The Wastelands'
        });
      }).then(function () {
        return db.rel.find('author');
      }).then(function (res) {
        ['authors', 'books'].forEach(function (type) {
          res[type].forEach(function (obj) {
            obj.rev.should.be.a('string');
            delete obj.rev;
          });
        });
        res.should.deep.equal({
          "authors": [
            {
              "name": "Stephen King",
              "books": [
                1,
                2,
                3
              ],
              "id": 19
            }
          ],
          "books": [
            {
              "title": "The Gunslinger",
              "id": 1
            },
            {
              "title": "The Drawing of the Three",
              "id": 2
            },
            {
              "title": "The Wastelands",
              "id": 3
            }
          ]
        });
      });
    });
    it('does not sideload if async option is true', function () {
      let db = rootdb.setSchema([
        {
          singular: 'author',
          plural: 'authors',
          relations: {
            books: {hasMany: {type: 'books', options: {async: true}}}
          }
        },
        {
          singular: 'book',
          plural: 'books',
          relations: {
            author: {belongsTo: {type: 'author', options: {async: true}}}
          }
        }
      ]);

      return db.rel.save('author', {
        name: 'Stephen King',
        id: 19,
        books: [1, 2, 3]
      }).then(function () {
        return db.rel.save('book', {
          id: 1,
          title: 'The Gunslinger'
        });
      }).then(function () {
        return db.rel.save('book', {
          id: 2,
          title: 'The Drawing of the Three'
        });
      }).then(function () {
        return db.rel.save('book', {
          id: 3,
          title: 'The Wastelands'
        });
      }).then(function () {
        return db.rel.find('author');
      }).then(function (res) {
        res['authors'].forEach(function (obj) {
          obj.rev.should.be.a('string');
          delete obj.rev;
        });
        res.should.deep.equal({
          "authors": [
            {
              "name": "Stephen King",
              "books": [
                1,
                2,
                3
              ],
              "id": 19
            }
          ]
        });
      });
    });

    it('fromRawDoc works with changes', function () {
      let db = rootdb.setSchema([
        {
          singular: 'author',
          plural: 'authors',
          relations: {
            books: {hasMany: {type: 'books', options: {async: true}}}
          }
        },
        {
          singular: 'book',
          plural: 'books',
          relations: {
            author: {belongsTo: {type: 'author', options: {async: true}}}
          }
        }
      ]);

      return db.rel.save('author', {
        name: 'Stephen King',
        id: 19,
        books: [1, 2, 3]
      }).then(function () {
        return db.rel.save('book', {
          id: 1,
          title: 'The Gunslinger'
        });
      }).then(function () {
        return db.rel.save('book', {
          id: 2,
          title: 'The Drawing of the Three'
        });
      }).then(function () {
        return db.rel.save('book', {
          id: 3,
          title: 'The Wastelands'
        });
      }).then(function () {
        return db.changes();
      }).then(function (changes) {
        return changes.results.map(function (change) {
          return db.rel.parseDocID(change.id);
        });
      }).then(function (res) {
        res.should.have.lengthOf(4);
        res.should.deep.include.members([
          {"type": "author", "id": 19},
          {"type": "book", "id": 1},
          {"type": "book", "id": 2},
          {"type": "book", "id": 3}
        ]);
      });
    });

    it('should pass along options', function () {

      let db = rootdb.setSchema([{
        singular: 'post',
        plural: 'posts'
      }]);


      return db.rel.save('post', {
        title: 'Rails is Omakase',
        text: 'There are a lot of ala carte blah blah blah',
        id: 1
      }).then(function () {
        return db.rel.save('post', {
          title: 'Rails is Unagi',
          text: 'Declicious unagi',
          id: 2
        });
      }).then(function () {
        return db.rel.find('post', {limit: 1});
      }).then(function (res) {
        res.posts.forEach(function (post) {
          post.rev.should.be.a('string');
          delete post.rev;
        });
        res.should.deep.equal({
          posts: [
            {
              title: 'Rails is Omakase',
              text: 'There are a lot of ala carte blah blah blah',
              id: 1
            }
          ]
        });
      });
    });

    it('should pass along options, including startkey', function () {

      let db = rootdb.setSchema([{
        singular: 'post',
        plural: 'posts'
      }]);


      return db.rel.save('post', {
        title: 'Rails is Omakase',
        text: 'There are a lot of ala carte blah blah blah',
        id: 1
      }).then(function () {
        return db.rel.save('post', {
          title: 'Rails is Unagi',
          text: 'Declicious unagi',
          id: 2
        });
      }).then(function () {

        return db.rel.find('post', {
          startkey: 2,
          limit: 1
        });
      }).then(function (res) {
        res.posts.forEach(function (post) {
          post.rev.should.be.a('string');
          delete post.rev;
        });
        res.should.deep.equal({
          posts: [
            {
              title: 'Rails is Unagi',
              text: 'Declicious unagi',
              id: 2
            }
          ]
        });
      });
    });

    it('should pass along options, including endkey', function () {

      let db = rootdb.setSchema([{
        singular: 'post',
        plural: 'posts'
      }]);


      return db.rel.save('post', {
        title: 'Rails is Omakase',
        text: 'There are a lot of ala carte blah blah blah',
        id: 1
      }).then(function () {
        return db.rel.save('post', {
          title: 'Rails is Unagi',
          text: 'Declicious unagi',
          id: 2
        });
      }).then(function () {
        return db.rel.find('post', {
          endkey: 1,
        });
      }).then(function (res) {
        res.posts.forEach(function (post) {
          post.rev.should.be.a('string');
          delete post.rev;
        });
        res.should.deep.equal({
          posts: [
            {
              title: 'Rails is Omakase',
              text: 'There are a lot of ala carte blah blah blah',
              id: 1
            }
          ]
        });
      });
    });
  });

  it('should pass along options, including kip', function () {

      let db = rootdb.setSchema([{
        singular: 'post',
        plural: 'posts'
      }]);


      return db.rel.save('post', {
        title: 'Rails is Omakase',
        text: 'There are a lot of ala carte blah blah blah',
        id: 1
      }).then(function () {
        return db.rel.save('post', {
          title: 'Rails is Unagi',
          text: 'Declicious unagi',
          id: 2
        });
      }).then(function () {

        return db.rel.find('post', {
          skip: 1,
          limit: 1
        });
      }).then(function (res) {
        res.posts.forEach(function (post) {
          post.rev.should.be.a('string');
          delete post.rev;
        });
        res.should.deep.equal({
          posts: [
            {
              title: 'Rails is Unagi',
              text: 'Declicious unagi',
              id: 2
            }
          ]
        });
      });
    });

  it('isDeleted should work', function() {
    let db = rootdb.setSchema([{
        singular: 'post',
        plural: 'posts'
      }]);

    return db.rel.isDeleted('post', 1).then(function(deleted) {
      should.equal(deleted, null);
    }).then(function() {
      return db.rel.save('post', {
        title: 'Rails is Omakase',
        text: 'There are a lot of ala carte blah blah blah',
        id: 1
      });
    }).then(function() {
      return db.rel.isDeleted('post', 1);
    }).then(function(deleted) {
      false.should.equal(deleted);
    }).then(function() {
      return db.rel.find('post', 1);
    }).then(function(res) {
      return db.rel.del('post', res.posts[0]);
    }).then(function() {
      return db.rel.isDeleted('post', 1);
    }).then(function(deleted) {
      true.should.equal(deleted);
    });
  });

}
