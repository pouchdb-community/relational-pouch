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
    this.timeout(30000);

    it('should barf on bad types', function () {
      db.setSchema([{
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

      db.setSchema([{
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

      db.setSchema([{
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

      db.setSchema([{
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

      db.setSchema([{
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

      db.setSchema([{
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

      db.setSchema([{
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

      db.setSchema([{
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

      db.setSchema([{
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

      db.setSchema([
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

      db.setSchema([
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

      db.setSchema([
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

    it('can delete', function () {

      db.setSchema([
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

  describe(dbType + ': relational tests', function () {
    this.timeout(30000);

    it('does one-to-one', function () {
      db.setSchema([
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

    it('does one-to-many', function () {
      db.setSchema([
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
        console.log(JSON.stringify(res));
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
      db.setSchema([
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
        console.log(JSON.stringify(res));
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
  });
}
