Relational Pouch
=====

[![Build Status](https://travis-ci.org/pouchdb/plugin-seed.svg)](https://travis-ci.org/pouchdb/plugin-seed)

Relational Pouch is a plugin for PouchDB that allows you to interact with PouchDB/CouchDB as if it was a relational data store.

It provides an enhanced API on top of PouchDB that is probably more familiar to fans of relational databases, and maybe even easier to use. At the same time, though, you still have CouchDB's awesome sync capabilities.

This plugin also uses clever tricks to avoid creating secondary indexes. This means that even if you have complex entity relations, your database operations should still be very fast.

The main goal of this is to provide an API that is as similar to Ember Data/JSONAPI as possible.

Installation
------

### In the browser

Download from GitHub, or use Bower:

    bower install relational-pouch

Then include it after `pouchdb.js` in your HTML page:

```html
<script src="pouchdb.js"></script>
<script src="pouchdb.relational-pouch.js"></script>
```

### In Node.js

    npm install relational-pouch

And then attach it to the `PouchDB` object:

```js
var PouchDB = require('pouchdb');
PouchDB.plugin(require('relational-pouch'));
``

API
----------

### db.setSchema(schema)

Call this after you initialize your PouchDB, in order to define your entities and relationships:

```js
var db = new PouchDB('mydb'); // or 'http://localhost:5984/mydb' for CouchDB
db.setSchema([
  {
    singular: 'post',
    plural: 'posts',
    relations: {
      belongsTo: 'author',
      hasMany: 'comment'
    }
  },
  {
    singular: 'author',
    plural: 'authors',
    relations: {
      hasMany: 'post'
    }
  },
  {
    singular: 'comment',
    plural: 'comments',
    relations: {
      belongsTo: 'post'
    }
  }
]);
```

This is a synchronous method that does not return a Promise.

You need to explicitly define the singular and plural forms of your entities, because I'm not a big fan of applying magic Anglocentric defaults to everything.

You can define one-to-one, one-to-many, and many-to-many relationships using any combination of `belongsTo` and `hasMany` that you want. For more examples, read the [Ember guide to models](http://emberjs.com/guides/models/defining-models/), which is waht inspired this.

Once you call `setSchema`, your `db` will be blessed with a `rel` object, which is where you can start using the rest of this plugin's API.

### db.rel.save(type, object)

Save an object with a particular type. This returns a Promise.

```js
db.rel.save('post', {
  title: 'Rails is Omakase',
  text: 'There are a lot of a-la-carte software...'
});
```

Result:

```js
{
  "posts": [
    {
      "title": "Rails is Omakase",
      "text": "There are a lot of a-la-carte software...",
      "id": "14760983-285C-6D1F-9813-D82E08F1AC29",
      "rev": "1-84df2c73028e5b8d0ae1cbb401959370"
    }
  ]
}
```

If you want, you can specify an `id`. Otherwise an `id` will be created for you.

```js
db.rel.save('post', {
  title: 'Rails is Unagi',
  text: 'Delicious unagi. Mmmmmm.',
  id: 1
})
```

Result:

```js
{
  "posts": [
    {
      "title": "Rails is Unagi",
      "text": "Delicious unagi. Mmmmmm.",
      "id": 1,
      "rev": "1-0ae315ee597b22cc4b1acf9e0edc35ba"
    }
  ]
}
```

You'll notice the special field `rev`, which is a revision identifier. This will come into play later.

`id` and `rev` are reserved fields when you use this plugin. You shouldn't try to use them for something else. An `id` can be any valid JSON object, although normally people use strings and ints.

### db.rel.find('type')

Find all objects with a given type. Returns a Promise.

```js
db.rel.find('post');
```

Result:

```js
{
  "posts": [
    {
      "title": "Rails is Unagi",
      "text": "Delicious unagi. Mmmmmm.",
      "id": 1,
      "rev": "1-0ae315ee597b22cc4b1acf9e0edc35ba"
    },
    {
      "title": "Rails is Omakase",
      "text": "There are a lot of a-la-carte software...",
      "id": "14760983-285C-6D1F-9813-D82E08F1AC29",
      "rev": "1-84df2c73028e5b8d0ae1cbb401959370"
    }
  ]
}
```

The list will be empty if it doesn't find anything. The results are sorted by `id`, using [CouchDB view collation](http://couchdb.readthedocs.org/en/latest/couchapp/views/collation.html).

### db.rel.find('type', id)

Find an object with the given type and `id`. Returns a Promise.

```js
db.rel.find('post', 1);
```

Result:

```js
{
  "posts": [
    {
      "title": "Rails is Unagi",
      "text": "Delicious unagi. Mmmmmm.",
      "id": 1,
      "rev": "1-0ae315ee597b22cc4b1acf9e0edc35ba"
    }
  ]
}
```

### db.rel.find('type', ids)

Find multiple objects with multiple `id`s. Returns a Promise.

```js
db.rel.find('post', [1, 2, 3]);
```

Result:

```js
{
  "posts": [
    {
      "title": "Rails is Unagi",
      "text": "Delicious unagi. Mmmmmm.",
      "id": 1,
      "rev": "1-0ae315ee597b22cc4b1acf9e0edc35ba"
    },
    {
      "title": "Maybe Rails is more like a sushi buffet",
      "text": "Heresy!",
      "id": 2,
      "rev": "1-6d8ac6d86d01b91cfbe2f53e0c81bb86"
    }
  ]
}
```

TODO: what happens if it's not found?

Testing
----

### In Node

This will run the tests in Node using LevelDB:

    npm test
    
You can also check for 100% code coverage using:

    npm run coverage

If you don't like the coverage results, change the values from 100 to something else in `package.json`, or add `/*istanbul ignore */` comments.


If you have mocha installed globally you can run single test with:
```
TEST_DB=local mocha --reporter spec --grep search_phrase
```

The `TEST_DB` environment variable specifies the database that PouchDB should use (see `package.json`).

### In the browser

Run `npm run dev` and then point your favorite browser to [http://127.0.0.1:8001/test/index.html](http://127.0.0.1:8001/test/index.html).

The query param `?grep=mysearch` will search for tests matching `mysearch`.

### Automated browser tests

You can run e.g.

    CLIENT=selenium:firefox npm test
    CLIENT=selenium:phantomjs npm test

This will run the tests automatically and the process will exit with a 0 or a 1 when it's done. Firefox uses IndexedDB, and PhantomJS uses WebSQL.