Relational Pouch
=====

[![Build Status](https://travis-ci.org/nolanlawson/relational-pouch.svg)](https://travis-ci.org/nolanlawson/relational-pouch)

Relational Pouch is a plugin for PouchDB that allows you to interact with PouchDB/CouchDB as if it was a relational data store.

It provides an enhanced API on top of PouchDB that is probably more familiar to fans of relational databases, and maybe even easier to use. At the same time, though, you still have CouchDB's awesome indexing and sync capabilities.

This plugin also uses clever tricks to avoid creating secondary indexes. This means that even if you have complex entity relations, your database operations should still be very fast.

The main goal of this is to provide an API that is as similar to [Ember Data](http://emberjs.com/api/data/) and [json:api](http://jsonapi.org/) as possible, while still being performant and Pouch-like.

This plugin is largely what powers [Ember Pouch](https://github.com/nolanlawson/ember-pouch).

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
```

API
----------

### Summary

* [`db.setSchema(schema)`](#dbsetschemaschema)
* [`db.rel.save(type, object)`](#dbrelsavetype-object)
* [`db.rel.find(type)`](#dbrelfindtype)
* [`db.rel.find(type, id)`](#dbrelfindtype-id)
* [`db.rel.find(type, ids)`](#dbrelfindtype-ids)
* [`db.rel.del(type, object)`](#dbreldeltype-object)
* [`db.rel.putAttachment(type, object, attachmentId, attachment, attachmentType)`](#dbrelputattachmenttype-object-attachmentid-attachment-attachmenttype)
* [`db.rel.getAttachment(type, id, attachmentId)`](#dbrelgetattachmenttype-id-attachmentid)
* [`db.rel.removeAttachment(type, object, attachmentId)`](#dbrelremoveattachmenttype-object-attachmentid)
* [`db.rel.parseDocID(docID)`](#dbrelparsedociddocid)
* [`db.rel.makeDocID(docID)`](#dbrelmakedociddocid)
* [Managing relationships](#managing-relationships)
  * [One-to-one](#one-to-one-relationships)
  * [Many-to-one](#many-to-one-relationships)
  * [Many-to-many](#many-to-many-relationships)
  * [Async relationships](#async-relationships)
  * [Advanced](#advanced)
* [Managing revisions ("rev")](#managing-revisions-rev)


### db.setSchema(schema)

Call this after you initialize your PouchDB, in order to define your entities and relationships:

```js
var db = new PouchDB('mydb');
db.setSchema([
  {
    singular: 'post',
    plural: 'posts',
    relations: {
      author: {belongsTo: 'author'},
      comments: {hasMany: 'comment'}
    }
  },
  {
    singular: 'author',
    plural: 'authors',
    relations: {
      posts: {hasMany: 'post'}
    }
  },
  {
    singular: 'comment',
    plural: 'comments',
    relations: {
      post: {belongsTo: 'post'}
    }
  }
]);
```

This is a synchronous method that does not return a Promise.

You can define one-to-one, one-to-many, and many-to-many relationships using any combination of `belongsTo` and `hasMany` that you want. For more examples, read the [Ember guide to models](http://emberjs.com/guides/models/defining-models/), which is what inspired this.

You need to explicitly define the singular and plural forms of your entities, because I'm not a big fan of applying magic Anglocentric defaults to everything.

Once you call `setSchema`, your `db` will be blessed with a `rel` object, which is where you can start using the rest of this plugin's API.

#### documentType

Rarely, you might want to have two different views over the same underlying data. Use `documentType` to create a view which reads the same data as another type:

```js
var db = new PouchDB('mydb');
db.setSchema([
  {
    singular: 'post',
    plural: 'posts',
    relations: {
      author: {belongsTo: 'author'},
      comments: {hasMany: 'comment'}
    }
  },
  {
    singular: 'postSummary',
    plural: 'postSummaries',
    documentType: 'post'
  }
]);
```

Here, when you load a "postSummary", it will return the same core record as "post", but will not resolve the relationships.

Be careful when using this feature — it is probably best to treat a type declaring a documentType as read-only. Do all creates/updates via the main type.

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
});
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

You'll notice the special field `rev`, which is a revision identifier. That'll come into play later.

`id` and `rev` are reserved fields when you use this plugin. You shouldn't try to use them for something else. An `id` can be any string or integer.

### db.rel.find(type)

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

The list will be empty if it doesn't find anything. The results are sorted by `id`.

### db.rel.find(type, id)

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

### db.rel.find(type, ids)

Find multiple objects with multiple `id`s. Returns a Promise.

```js
db.rel.find('post', [3, 2, 1]);
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

If an `id` isn't found, it's simply not returned. Notice that above, there is no object with an `id` of `3`. 

`find` results are always returned ordered by id. The order of your `ids` array will not necessarily be reflected in the returned array of objects.

### db.rel.del(type, object)

Deletes the given object. Returns a Promise.

```js
db.rel.del('post', {id:1, rev:"1-0560dbb11ead319c9f5bc1f667ea8e84"});
```

Result:

```js
{"deleted":true}
```

The minimum you need to delete something is an `id` and a `rev`. The easiest pattern is to just `find` it before deleting it:

```js
db.rel.find('post', 1).then(function (post) {
  return db.rel.del('post', post);
});
```

### db.rel.putAttachment(type, object, attachmentId, attachment, attachmentType)

Adds an attachment to the given object. Returns a Promise.

```js
var attachment = new Blob(['Is there life on Mars?']); // new Buffer('Is there life on Mars?') for node
db.rel.putAttachment('post', {id:1, rev:"1-0560dbb11ead319c9f5bc1f667ea8e84"}, 'file', attachment, 'text/plain');
```

Result:

```js
{
  "posts": [
    {
      "id": 1,
      "rev": "2-...."
    }
  ]
}
```

### db.rel.getAttachment(type, id, attachmentId)

Gets an attachment for the given document id. Returns a Promise to a Blob (or Buffer for Node).

```js
db.rel.getAttachment('post', 1, 'file').then(function (attachment) {
  // convert the Blob into an object URL and show it in an image tag
  $('img').attr('src', URL.createObjectURL(attachment));
});
```

### db.rel.removeAttachment(type, object, attachmentId)

Adds an attachment to the given object. Returns a Promise.

```js
var attachment = new Blob(['Is there life on Mars?']); // new Buffer('Is there life on Mars?') for node
db.rel.putAttachment('post', {id:1, rev:"1-0560dbb11ead319c9f5bc1f667ea8e84"}, 'file', attachment, 'text/plain').then(function (res) {
  var post = res.posts[0];
  db.rel.removeAttachment('post', post, 'file');
});
```

Result:

```js
{
  "posts": [
    {
      "id": 1,
      "rev": "3-...."
    }
  ]
}
```

### db.rel.parseDocID(docID)

Parses a raw CouchDB/PouchDB doc `_id` into an object containing a `type` and `id` field. Basically only useful for working with the `db.changes()` feed, so you can tell what changed from a "relational" perspective rather than from the raw CouchDB/PouchDB perspective.

This method is synchronous, so it directly returns the object rather than a Promise.

```js
db.rel.parseDocID("author_1_0000000000000019");
```

Returns:

```js
{
  "type": "author",
  "id": 19
}
```

So e.g. with `changes()` you could do:

```js
db.changes().then(function (changes) {
return changes.results.map(function (change) {
  return db.rel.parseDocID(change.id);
});
```

Result is e.g.:

```js
[
  {"type": "author", "id": 19},
  {"type": "book", "id": 1},
  {"type": "book", "id": 2},
  {"type": "book", "id": 3}
]
```

### db.rel.makeDocID(parsedID)

Creates a valid `_id` from an object with `type` and `id` properties, such as
`parseDocID` generates.

```js
db.rel.makeDocID({ "type": "author", "id": 19 });
```

Returns:

```js
"author_1_0000000000000019"
```

Useful if you need to perform operations with the underlying database, e.g.:

```js
var _id = db.rel.makeDocID({ "type": "author", "id": 19 });
db.get(_id).then(function (doc) {
  var parsedId = db.parseDocID(doc._id);
  doc.data.type = parsedId.type;
  doc.data.id = parsedId.id;
  return doc.data;
});
```

### Managing relationships

Entity relationships are encoded using the [Ember Data Model](http://andycrum.github.io/ember-data-model-maker/) format, which is a slight simplification of [json:api](http://jsonapi.org/).

#### One-to-one relationships

An author has exactly one profile, and vice-versa:

```js
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

db.rel.save('author', {
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
});
```

Result:

```js
{
  "authors": [
    {
      "name": "Stephen King",
      "profile": 21,
      "id": 19,
      "rev": "1-bf705a912bf672b30ad262b33a19c5c3"
    }
  ],
  "profiles": [
    {
      "description": "nice masculine jawline",
      "author": 19,
      "id": 21,
      "rev": "1-ef86a08ea3243ea59302ceaa04afd59f"
    }
  ]
}
```

#### Many-to-one relationships

An author has many books:

```js
db.setSchema([
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

db.rel.save('author', {
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
});
```

Result:

```js
{
  "authors": [
    {
      "name": "George R. R. Martin",
      "books": [
        6,
        7
      ],
      "id": 1,
      "rev": "1-04e165889a4a9303a6dc07a54cee9741"
    },
    {
      "name": "Stephen King",
      "books": [
        1
      ],
      "id": 19,
      "rev": "1-38580117cb4a1ddb2c7151453a7f9129"
    }
  ],
  "books": [
    {
      "title": "It",
      "author": 19,
      "id": 1,
      "rev": "1-1b7ea74936a8034aee7da27ffd36a63f"
    },
    {
      "title": "A Game of Thrones",
      "author": 1,
      "id": 6,
      "rev": "1-a6f0dc69fc79d5565639074b5defa52d"
    },
    {
      "title": "The Hedge Knight",
      "author": 1,
      "id": 7,
      "rev": "1-4988aa3215070c71e1505a05f90bb60f"
    }
  ]
}
```

#### Many-to-many relationships

Peter Straub actually co-wrote *The Talisman* with Stephen King. So a book can have many authors, and an author can have many books:

```js
db.setSchema([
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

db.rel.save('author', {
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
});
```

Result:

```js
{
  "authors": [
    {
      "name": "Peter Straub",
      "books": [
        2,
        3
      ],
      "id": 2,
      "rev": "1-92901c8e3e0775765777bfcbe8f4c2dd"
    },
    {
      "name": "Stephen King",
      "books": [
        1,
        2
      ],
      "id": 19,
      "rev": "1-d70d9fe033f583493029372c88ae21d0"
    }
  ],
  "books": [
    {
      "title": "It",
      "authors": [
        19
      ],
      "id": 1,
      "rev": "1-96751a2a5bb7b0fd70564efe6856dbd6"
    },
    {
      "title": "The Talisman",
      "authors": [
        19,
        2
      ],
      "id": 2,
      "rev": "1-9faf8c4f72db782dacce16a7849d156b"
    },
    {
      "title": "Ghost Story",
      "authors": [
        2
      ],
      "id": 3,
      "rev": "1-7564a1195f143e24ebf24d914c60d6be"
    }
  ]
}
```

#### Async relationships

Just like with Ember Data, you can define relationships to be *async*, which means that dependent objects aren't automatically sideloaded. This can reduce your request time and payload size.

For instance, let's say you want to load all authors, but you don't want to load their books, too. You can do:

```js
db.setSchema([
  {
    singular: 'author',
    plural: 'authors',
    relations: {
      books: {hasMany: {type: 'book', options: {async: true}}}
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
```

By default, `async` is consider `false`. So this:

```js
...
  books: {hasMany: 'book'}
...
```

is equivalent to this:

```js
...
  books: {hasMany: {type: 'book', options: {async: false}}}
...
```

Now let's try with `{async: true}`. You'll notice that, when we fetch the list of authors, only the book `id`s will be included, not the full books:

```js
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
});
```

Result:

```js
{
  "authors": [
    {
      "name": "Stephen King",
      "books": [
        1,
        2,
        3
      ],
      "id": 19,
      "rev": "1-9faf8c4f72db782dacce16a7849d156b"
    }
  ]
}
```

This can cut down on your request size, if you don't need the full book information when you fetch authors.

Thanks to [Lars-Jørgen Kristiansen](https://github.com/iUtvikler) for implementing this feature!

#### Advanced

Deeply nested relationships are also possible. Everything just ends up being sideloaded in the same JSON object response.

```js
{
  "lions" : [...],
  "tigers" : [...],
  "bears" : [...]
}
```

When you `save`, you must explicitly provide the `id`s of dependent objects, and they must be saved independently. There is no cascading at all.

You can attach the full entity object with an `id` to another object, but if you include an object without an `id`, it will be ignored.

```js
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
db.rel.save('profile', profile).then(function () {
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
});
```

Result:

```js
{
  "authors": [
    {
      "name": "Stephen King",
      "profile": 21,
      "books": [
        1,
        2,
        3
      ],
      "id": 19,
      "rev": "1-308a75619dc1b96bece7b6996d36d18b"
    }
  ],
  "profiles": [
    {
      "description": "nice masculine jawline",
      "author": 19,
      "id": 21,
      "rev": "1-7bd39e62046a0816f9c5a3836a548ec8"
    }
  ],
  "books": [
    {
      "title": "The Gunslinger",
      "id": 1,
      "rev": "1-f3a305eae85642ce74412141ec0ae0bf"
    },
    {
      "title": "The Drawing of the Three",
      "id": 2,
      "rev": "1-1c94deba48af8c1c2df1c5545246846b"
    },
    {
      "title": "The Wastelands",
      "id": 3,
      "rev": "1-a4a96e3f9e2cb3d516605fa46bbed080"
    }
  ]
}
```

The plugin is not smart enough to infer bidirectional relationships, so you have to attach the relation to both object. E.g. in the above example, each `book` explicitly has its `author` set, and the `author` explicitly has his `books` set. If you want to add a new book, you would need to `save()` the book, add it to the author's list of books, and then `save()` the author.


### Managing revisions ("rev")

When you update an existing object, you'll need to include the `rev`, or else you'll get a 409 conflict error. This is standard CouchDB/PouchDB behavior, so the common idiom is:

```js
db.rel.find('post', 1).then(function (post) {
  // do whatever you want to do to update the post
  return db.rel.save('post', post).catch(function (err) {
    if (err.code === 409) { // conflict
      // handle the conflict somehow. e.g. ask the user to compare the two versions,
      // or just try the whole thing again
    } else {
      throw err; // some other error
    }
  });
});
```

This also applies to deletions:

```js
db.rel.find('post', 1).then(function (post) {
  return db.rel.del('post', post).catch(function (err) {
    if (err.code === 409) { // conflict
      // handle the conflict
    } else {
      throw err; // some other error
    }
  });
});
```

To avoid getting into a long discussion of why you have to do this: suffice it to say, when you build a client-server sync architecture, you are building a *distributed system*. Distributed systems are hard, and managing conflicts is just a reality when you have multiple computers that aren't perfectly in sync.

You will have to deal with conflicts sooner or later. With PouchDB and CouchDB, you simply pay that cost up-front.

Jan Lenhardt has [a nice writeup](http://writing.jan.io/2013/12/19/understanding-couchdb-conflicts.html) on this.

### Attachments

Thanks to [bterkuile](https://github.com/bterkuile), this plugin also support attachments! Attachments are simply added inline, in the normal PouchDB way, but as

```
doc.attachments
```

rather than

```
doc._attachments
```

I.e. It follows the same convention as `doc.id` and `doc.rev`.

How does it work?
-----

A relational Pouch/Couch is just a regular database that has been partitioned by type.

So for instance, a document with type "pokemon" and id "1" might have an actual `_id` like "pokemon_1", whereas a "trainer" with id "2" might have an actual `_id` like "trainer_2". It's not rocket science.

What is important is that this plugin leverages the very efficient `allDocs()` API, rather than relying on the performance-killing `query()` API. Also, it joins related documents by simply making extra requests, rather than using native map/reduce joined documents.

Although this method may seem naïve, in practice you get much better performance, because secondary indexes in Pouch/Couch are just plain slow. (I wrote most of Pouch's secondary index logic, so I ought to know.)

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

