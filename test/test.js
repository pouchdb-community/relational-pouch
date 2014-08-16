/*jshint expr:true */
'use strict';

var Pouch = require('pouchdb');

//
// your plugin goes here
//
var plugin = require('../lib');
Pouch.plugin(plugin);

var chai = require('chai');
chai.use(require("chai-as-promised"));

//
// more variables you might want
//
var should = chai.should(); // var should = chai.should();
require('bluebird'); // var Promise = require('bluebird');

var dbs;
if (process.browser) {
  dbs = 'testdb' + Math.random() +
    ',http://localhost:5984/testdb' + Math.round(Math.random() * 100000);
} else {
  dbs = process.env.TEST_DB;
}

dbs.split(',').forEach(function (db) {
  var dbType = /^http/.test(db) ? 'http' : 'local';
  tests(db, dbType);
});

function tests(dbName, dbType) {

  var db;

  beforeEach(function () {
    db = new Pouch(dbName);
    return db;
  });
  afterEach(function () {
    return Pouch.destroy(dbName);
  });

  describe(dbType + ': basic tests', function () {

    it('should barf on bad types', function () {
      db.initRelational([{
        singular: 'post',
        plural: 'posts'
      }]);

      return db.rel.save('unknown', {}).then(function (res) {
        should.not.exist(res);
      }).catch(function (err) {
        should.exist(err);
      });
    });

    it('should store blog posts', function () {

      db.initRelational([{
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
        res.posts.should.have.length(1);
        res.posts[0].id.should.be.a('string');
        res.posts[0].rev.should.be.a('string');
        var id = res.posts[0].id;
        var rev = res.posts[0].rev;
        res.posts[0].should.deep.equal({
          id: id,
          rev: rev,
          title: title,
          text: text
        });
      });
    });
    it('should store blog posts with an id', function () {

      db.initRelational([{
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
        res.posts.should.have.length(1);
        res.posts[0].id.should.be.a('string');
        res.posts[0].rev.should.be.a('string');
        var id = res.posts[0].id;
        var rev = res.posts[0].rev;
        res.posts[0].should.deep.equal({
          id: id,
          rev: rev,
          title: title,
          text: text
        });
      });
    });

    it('should store blog posts with an int id', function () {

      db.initRelational([{
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
        res.posts.should.have.length(1);
        res.posts[0].id.should.be.a('number');
        res.posts[0].rev.should.be.a('string');
        var id = res.posts[0].id;
        var rev = res.posts[0].rev;
        res.posts[0].should.deep.equal({
          id: id,
          rev: rev,
          title: title,
          text: text
        });
      });
    });

    it('should update blog posts', function () {

      db.initRelational([{
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
        var post = res.posts[0];
        post.title = 'Rails is Unagi';
        return db.rel.save('post', post);
      }).then(function (res) {
        var rev = res.posts[0].rev;
        res.posts.should.deep.equal([{
          id: id,
          rev: rev,
          title: 'Rails is Unagi',
          text: text
        }]);
      });
    });

    it('should find blog posts', function () {

      db.initRelational([{
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

      db.initRelational([{
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

      db.initRelational([{
        singular: 'post',
        plural: 'posts'
      }]);

      return db.rel.find('post').then(function (res) {
        res.should.deep.equal({
          posts: []
        });
      });
    });
  });
}
