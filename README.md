# Seraph.js

A terse & familiar binding to the [Neo4j](http://neo4j.org/) REST API that is 
idiomatic to [node.js](http://nodejs.org/).

## Install

```
npm install seraph
```

## Quick Example

```javascript
var db = require("seraph")("http://localhost:7474");

db.save({ name: "Test-Man", age: 40 }, function(err, node) {
  if (err) throw err;
  console.log("Test-Man inserted.");

  db.delete(node, function(err) {
    if (err) throw err;
    console.log("Test-Man away!");
  });
});
```

## Documentation

<a name="seraph.db_list" />
### Initialization
* [seraph](#seraph) - initialize the seraph client
* [changePassword](#changePassword) - change the db user's password

### Generic Operations

* [query](#query) - perform a cypher query and parse the results
* [queryRaw](#queryRaw) - perform a cypher query and return unparsed results

### API Communication Operations

* [operation](#operation) - create a representation of a REST API call
* [call](#call) - take an operation and call it
* [batch](#batch) - perform a series of atomic operations with one api call.

### Node Operations
* [save (node.save)](#node.save) - create or update a node
* [read (node.read)](#node.read) - read a node
* [find (node.find)](#node.find) - find a node using a predicate
* [delete (node.delete)](#node.delete) - delete a node
* [relate (node.relate)](#node.relate) - relate two nodes
* [relationships (node.relationships)](#node.relationships) - read the 
  relationships of a node
* [legacyindex (node.legacyindex)](#node.legacyindex) - add a node to a legacy 
  index
* [label (node.label)](#node.label) - add a label to a node
* [removeLabel (node.removeLabel)](#node.removeLabel) - remove a label from a 
  node
* [nodesWithLabel (node.nodesWithLabel)](#node.nodesWithLabel) - fetch all nodes
  with a label
* [readLabels (node.readLabels)](#node.readLabels) - read the labels of a node
  or all available labels.

### Relationship Operations
* [rel.create](#rel.create) - create a relationship
* [rel.update](#rel.update) - update the properties of a relationship
* [rel.read](#rel.read) - read a relationship
* [rel.delete](#rel.delete) - delete a relationship

### Constraint operations
* [constraints.list](#constraints.list) - list constraints
* [constraints.uniqueness.create](#constraints.uniqueness.create) - create a
  uniqueness constraint
* [constraints.uniqueness.createIfNone](#constraints.uniquness.createIfNone) - 
  create a uniqueness constraint if it doesn't already exist
* [constraints.uniqueness.list](#constraints.uniqueness.list) - list uniqueness
  constraints
* [constraints.uniqueness.drop](#constraints.uniqueness.drop) - drop a uniqueness
  constraint

### Indexing operations
* [index.create](#index.create) - create an index on a label and property name
* [index.createIfNone](#index.createIfNone) - create an index or return the old 
  one
* [index.list](#index.list) - read out the indexes for a label
* [index.drop](#index.drop) - drop an index

### Legacy Index Operations
* [legacyindex.create](#legacyindex.create) - create an index
* [legacyindex.add](#legacyindex.add) - add a nodes/rels to an index
* [legacyindex.read](#legacyindex.read) - read nodes/rels from an index
* [legacyindex.remove](#legacyindex.remove) - remove nodes/rels from an index
* [legacyindex.delete](#legacyindex.delete) - delete an index
* [legacyindex.getOrSaveUnique](#legacyindex.getOrSaveUnique) - get or save a node 
  using an index for uniqueness
* [legacyindex.saveUniqueOrFail](#legacyindex.saveUniqueOrFail) - save a node 
  using an index to enforce uniqueness

## Compatibility

Seraph `~0.9.0` only works with Neo4j 2.0.0 and later. Tested up to 2.1.7.

## Testing

You can test Seraph simply by running `npm test`. It will spin up its own neo4j 
instance for testing. **Note** that the first time you run your tests (or change 
neo4j version), a new version of neo4j will need to be downloaded. That can,
of course, take a little time.

## Initialization
<a name="seraph" />
### seraph([server|options])

Creates and returns the Seraph instance.  If no parameters are given,
assumes the Neo4J REST API is running locally at the default location
`http://localhost:7474/db/data`.

__Arguments__

* `options`: an options object. You can use the following options:
  * `server` (default = `"http://localhost:7474"`): the server to connect to (with protocol and port, not path).
  * `endpoint` (default = `"/db/data"`): the path to Neo4j's rest API. You can leave this as the default if you have not changed it yourself in the neo4j settings.
  * `user` (default = `"neo4j"`): the username to authenticate with.
  * `pass` (default = `"neo4j"`): the password to authenticate with.
  * `id` (default = `"id"`): the name of the attribute seraph will add to new nodes when they are created and that it will use to find nodes when performing updates with `node.save` and the like.
  * `agent` (default = null): the http agent for requests to neo4j server. The same can be used for keep-alive connections to server. Can use [agentkeepalive](https://github.com/node-modules/agentkeepalive "agentkeepalive") module to create a keep-alive agent. It's a recommended option for high performance and low latency client.
  * `xstream` (default = false): if true, passes new X-Stream option to neo4j server. It's a recommended option for high performance and low latency client.
* `server` (string) - Short form to specify server parameter only. `"http://localhost:4747"` is equivalent to `{ server: "http://localhost:4747" }`.

**Note** that as of Neo4j 2.2.0, user authentication is required. You will not
be able to access resources before supplying a username or password that is not
the default. You can change the password using [`seraph#changePassword`](#changePassword).

__Example__

```javascript
// To http://localhost:7474/db/data with user "local" and pass "test"
var dbLocal = require("seraph")({
  user: 'local',
  pass: 'test'
});

// To http://example.com:53280/neo with user "root" and pass "jf8%kLs#!"
var dbRemote = require("seraph")({ server: "http://example.com:53280",
                                   endpoint: "/neo",
                                   user: "root",
                                   pass: "jf8%kLs#!" });

// Copy node#13 from remote server
dbRemote.read({ id: 13 }, function(err, node) {
  if (err) throw err;
  delete node.id; // copy instead of overwriting local node#13
  dbLocal.save(node, function(err, nodeL) {
    if (err) throw err;
    console.log("Copied remote node#13 to " +
                "local node#" + nodeL.id.toString() + ".");
  });
});
```

<a name="changePassword" />
### changePassword(newPassword, callback)

Change's the current database user's password. This will automatically update
seraph's options to contain the new password if it is successful

__Arguments__

* `newPassword` (string) - the new password to set.
* `callback` (function(err){}) - callback to call when the password has been changed.

__Example__

```javascript
// connect to a local neo4j instance with default settings (user/pass is "neo4j" by default).
var db = require("seraph")();
db.changePassword('b2(jk:4@#', function(err) {
  //password is now changed, and `db`'s options have been updated with the new password
});
```

## Generic Operations

<a name="query" /><a name="queryRaw"/>
### query(query, [params,] callback), queryRaw(query, [params,] callback)

`queryRaw` performs a cypher query and returns the results directly from the
REST API.  
`query` performs a cypher query and map the columns and results together.

__Note__: if you're performing large queries it may be advantageous to use
`queryRaw`, since `query` attempts to infer whole nodes and relationships that
are returned (in order to transform them into a nicer format).

__Arguments__

* `query` - Cypher query as a format string.
* `params` (optional, default=`{}`). Replace `{key}` parts in query string.  See 
  cypher documentation for details. **note** that if you want to send a list of
  ids as a parameter, you should send them as an array, rather than a string
  representing them (`[2,3]` rather than `"2,3"`).
* `callback` - (err, result).  Result is an array of objects.

__Example__

Given database:

```javascript
{ name: 'Jon', age: 23, id: 1 }
{ name: 'Neil', age: 60, id: 2 }
{ name: 'Katie', age: 29, id: 3 }
// 1 --knows--> 2
// 1 --knows--> 3
```

Return all people Jon knows:

```javascript
var cypher = "START x = node({id}) "
           + "MATCH x -[r]-> n "
           + "RETURN n "
           + "ORDER BY n.name";

db.query(cypher, {id: 1}, function(err, result) {
  if (err) throw err;
  assert.deepEqual(result, [
    { name: 'Katie', age: 29, id: 3 },
    { name: 'Neil', age: 60, id: 2 }
  ]);
};

db.queryRaw(cypher, {id: 3}, function(err, result) {
  if (err) throw err;
  // result contains the raw response from neo4j's rest API. See
  // http://docs.neo4j.org/chunked/milestone/rest-api-cypher.html
  // for more info
});
```

---------------------------------------

<a name="operation" />
### operation(path, [method='get/post'], [data])

Create an operation object that will be passed to [call](#call). 

__Arguments__

* `path` - the path fragment of the request URL with no leading slash. 
* `method` (optional, default=`'GET'`|`'POST'`) - the HTTP method to use. When 
  `data` is an  object, `method` defaults to 'POST'. Otherwise, `method` 
  defaults to `GET`.
* `data` (optional) - an object to send to the server with the request.

__Example__

```javascript
var operation = db.operation('node/4285/properties', 'PUT', { name: 'Jon' });
db.call(operation, function(err) {
  if (!err) console.log('Set `name` to `Jon` on node 4285!');
});
```

---------------------------------------

<a name="call" />
### call(operation, callback)

Perform an HTTP request to the server.

If the body is some JSON, it is parsed and passed to the callback.If the status
code is not in the 200's, an error is passed to the callback. 

__Arguments__

* `operation` - an operation created by [operation](#operation) that specifies
  what to request from the server
* `callback` - function(err, result, response). `result` is the JSON parsed body
  from the server (otherwise empty). `response` is the response object from the
  request.

__Example__

```javascript
var operation = db.operation('node/4285/properties');
db.call(operation, function(err, properties) {
  if (err) throw err;
  // `properties` is an object containing the properties from node 4285
});
```

---------------------------------------

<a name="batch" />
### Batching/transactions - `batch([operations, callback])`

Batching provides a method of performing a series of operations atomically. You
could also call it a transaction. It has the added benefit of being performed
all in a single call to the neo4j api, which theoretically should result in 
improved performance when performing more than one operation at the same time.

When you create a batch, you're given a new `seraph` object to use. All calls to
this object will be added to the batch. Note that once a batch is committed, you
should no longer use this object.

* [How do I use it?](#how-do-i-use-it)
* [What happens to my callbacks?](#what-happens-to-my-callbacks)
* [Can I reference newly created nodes?](#can-i-reference-newly-created-nodes)
* [I didn't use any callbacks. How can I find my results when the batch is done?](#i-didnt-use-any-callbacks-how-can-i-find-my-results-when-the-batch-is-done)
* [What happens if one of the operations fails?](#what-happens-if-one-of-the-operations-fails)
* [Can I nest batches?](#can-i-nest-batches)
* [How can I tell if this `db` object is a batch operation?](#how-can-i-tell-if-this-db-object-is-a-batch-operation)

#### How do I use it?

There's two ways. You can do the whole thing asynchronously, and commit the 
transaction whenever you want, or you can do it synchronously, and have the 
transaction committed for you as soon as your function is finished running.
Here's a couple of examples of performing the same operations with batch 
synchronously and asynchronously:

##### Asynchronously

```javascript
var txn = db.batch();

txn.save({ title: 'Kaikki Askeleet' });
txn.save({ title: 'Sinä Nukut Siinä' });
txn.save({ title: 'Pohjanmaa' });

txn.commit(function(err, results) {
  /* results -> [{ id: 1, title: 'Kaikki Askeleet' },
                 { id: 2, title: 'Sinä Nukut Siinä' },
                 { id: 3, title: 'Pohjanmaa' }] */
});
```

##### Synchronously

**Note** - it's only the creation of operations that is synchronous. The actual
API call is asynchronous still, of course.

```javascript
db.batch(function(txn) {
  txn.save({ title: 'Kaikki Askeleet' });
  txn.save({ title: 'Sinä Nukut Siinä' });
  txn.save({ title: 'Pohjanmaa' });
}, function(err, results) {
  /* results -> [{ id: 1, title: 'Kaikki Askeleet' },
                 { id: 2, title: 'Sinä Nukut Siinä' },
                 { id: 3, title: 'Pohjanmaa' }] */
});
```

#### What happens to my callbacks?

You can still pass callbacks to operations on a batch transaction. They will
perform as you expect, but they will not be called until after the batch has
been committed. Here's an example of using callbacks as normal:

```javascript
var txn = db.batch();

txn.save({ title: 'Marmoritaivas' }, function(err, node) {
  // this code is not reached until `txn.commit` is called
  // node -> { id: 1, title: 'Marmoritaivas' }
});

txn.commit();
```

#### Can I reference newly created nodes?

Yes! Calling, for example, `node.save` will synchronously return a special object
which you can use to refer to that newly created node within the batch.

For example, this is perfectly valid in the context of a batch transaction:

```javascript
var txn = db.batch();

var singer = txn.save({name: 'Johanna Kurkela'});
var album = txn.save({title: 'Kauriinsilmät', year: 2008});
var performance = txn.relate(singer, 'performs_on', album, {role: 'Primary Artist'});
txn.rel.legacyindex('performances', performance, 'year', '2008');

txn.commit(function(err, results) {});
```

#### I didn't use any callbacks. How can I find my results when the batch is done?

Each function you call on the batch object will return a special object that you
can use to refer to that call's results once that batch is finished (in 
addition to the intra-batch referencing feature mentioned above). The best
way to demonstrate this is by example:

```javascript
var txn = db.batch();

var album = txn.save({title: 'Hetki Hiljaa'});
var songs = txn.save([
  { title: 'Olen Sinussa', length: 248 },
  { title: 'Juurrun Tähän Ikävään', length: 271 }
]);
// note we can also use `songs` to reference the node that will be created
txn.relate(album, 'has_song', songs[0], { trackNumber: 1 });
txn.relate(album, 'has_song', songs[1], { trackNumber: 3 });

txn.commit(function(err, results) {
  var album = results[album]; // album -> { title: 'Hetki Hiljaa', id: 1 }
  var tracks = results[songs];
  /* tracks -> [{ title: 'Olen Sinussa', length: 248, id: 2 },
                { title: 'Juurrun Tähän Ikävään', length: 271, id: 3}] */
});
```

#### What happens if one of the operations fails?

Then no changes are made. Neo4j's batch transactions are atomic, so if one
operation fails, then no changes to the database are made. Neo4j's own
documentation has the following to say: 
> This service is transactional. If any of the operations performed fails 
> (returns a non-2xx HTTP status code), the transaction will be rolled back and
> all changes will be undone.

#### Can I nest batches?

No, as of now we don't support nesting batches as it tends to confuse the
intra-batch referencing functionality. To enforce this, you'll find that the
seraph-like object returned by `db.batch()` has no `.batch` function itself.

#### How can I tell if this `db` object is a batch operation?

Like so:

```javascript
// db.isBatch -> undefined
var txn = db.batch();
// txn.isBatch -> true
if (txn.isBatch) // Woo! I'm in a batch.
```

-------------

## Node Operations

<a name="node.save" />
### save(object, [label,]|[key, value,] callback)
*Aliases: __node.save__*

Create or update a node. If `object` has an id property, the node with that id
is updated. Otherwise, a new node is created. Returns the newly created/updated
node to the callback.

** Note: using `node.save` with a `label` *does not* work in a batch. If you
want to create a node with label in a batch, you should call `node.save` without
a label, followed by `node.label` with a reference to the created node. **

__Arguments__

* `node` - an object to create or update
* `label` - a label to label this node with. this is performed atomically, so if
  labelling the node fails, the node is not saved/updated. supplying `label` is 
  exclusive with `key` and `value`. You may either specify a `label`, or a `key`
  and a `value`, but all three. ** Note: using `node.save` with a `label` 
  *does not* work in a batch. If you want to create a node with label in a batch,
  you should call `node.save` without a label, followed by `node.label` with a 
  reference to the created node. **
* `key`, `value` (optional) - a property key and a value to update it with. This
  allows you to only update a single property of the node, without touching any
  others. If `key` is specified, `value` must also be. 
* `callback` - function(err, node). `node` is the newly saved or updated node. If
  a create was performed, `node` will now have an id property. The returned 
  object is not the same reference as the passed object (the passed object will
  never be altered).

__Example__

** Creating and updating a node **

```javascript
// Create a node
db.save({ name: 'Jon', age: 22, likes: 'Beer' }, function(err, node) {
  console.log(node); // -> { name: 'Jon', age: 22, likes: 'Beer', id: 1 }
  
  // Update it
  delete node.likes;
  node.age++;
  db.save(node, function(err, node) {
    console.log(node); // -> { name: 'Jon', age: 23, id: 1 }
  });
});
```

** Creating a node with a label **

```javascript
db.save({ name: 'Jon' }, 'Person', function(err, node) {
  
});
```

** Update a single property on a node **

```javascript
db.save({ name: 'Jon', age: 23 }, 'Person', function(err, node) {
  db.save(node, 'age', 24, function(err) {
  });
});
```

---------------------------------------

<a name="node.read" />
### read(id|object, [property,] callback)
*Aliases: __node.read__*

Read a node.

**Note**: If the node doesn't exist, Neo4j will return an exception. You can 
check if this is indicating that your node doesn't exist because
`err.statusCode` will equal `404`. This is inconsistent with behaviour of
[node.legacyindex.read](#legacyindex.read), but it is justified because the 
Neo4j REST api behaviour is inconsistent in this way as well. 

__Arguments__

* `id | object` - either the id of the node to read, or an object containing an id
property of the node to read.
* `property` (optional) - the name of the property to read. if this is specified,
  only the value of this property on the object is returned.
* `callback` - function(err, node). `node` is an object containing the properties
of the node with the given id.

__Example__

```javascript
db.save({ make: 'Citroen', model: 'DS4' }, function(err, node) {
  db.read(node.id, function(err, node) {
    console.log(node) // -> { make: 'Citroen', model: 'DS4', id: 1 }
  });
});
```

---------------------------------------

<a name="node.delete" />
### delete(id|object, [force | property], [callback])
*Aliases: __node.delete__*

Delete a node.

__Arguments__

* `id | object` - either the id of the node to delete, or an object containing an id
property of the node to delete.
* `force` (optional - default = false) -  if truthy, will delete all the node's 
  relations prior to deleting the node.
* `property` (optional) - if specified, delete only the property with this name
  on the object. **note that you can either specify `property` or `force`, not
  both, as force is meaningless when deleting a property**
* `callback` - function(err). if `err` is falsy, the node has been deleted.

__Example__

```
db.save({ name: 'Jon' }, function(err, node) {
  db.delete(node, function(err) {
    if (!err) console.log('Jon has been deleted!');
  });
});
```

---------------------------------------

<a name="node.find" />
### find(predicate, [any, [label,] callback)
*Aliases: __node.find__*

Perform a query based on a predicate. The predicate is translated to a
cypher query.

__Arguments__

* `predicate` - Partially defined object.  Will return elements which match
  the defined attributes of predicate.
* `any` (optional, default=`false`) - If true, elements need only match on one 
  attribute. If false, elements must match on all attributes.
* `label` (optional, default=`null`) - Find only nodes with the given label.
  ([neo4j docs on labels](http://neo4j.com/docs/stable/rest-api-node-labels.html))
* `callback` - function(err, results) - `results` is an array of the resulting
  nodes.

__Example__

Given database content:

```javascript
{ name: 'Jon'    , age: 23, australian: true  }
{ name: 'Neil'   , age: 60, australian: true  }
{ name: 'Belinda', age: 26, australian: false }
{ name: 'Katie'  , age: 29, australian: true  }
```

Retrieve all australians:

```javascript
var predicate = { australian: true };
var people = db.find(predicate, function (err, people) {
    if (err) throw err;
    assert.equals(3, people.length);
});
```

---------------------------------------

<a name="node.relationships" />
### relationships(id|object, [direction, [type,]] callback)
**Aliases: __node.relationships__*

Read the relationships involving the specified node.

__Arguments__

* `id | object` - either the id of a node, or an object containing an id property of
  a node.
* `direction` ('all'|'in'|'out') (optional unless `type` is passed, 
  default=`'all'`) - the direction of relationships to read. 
* `type` (optional, default=`''` (match all relationships)) - the relationship
  type to find
* `callback` - function(err, relationships) - `relationships` is an array of the
  matching relationships

__Example__

```javascript
db.relationships(452, 'out', 'knows', function(err, relationships) {
  // relationships = all outgoing `knows` relationships from node 452
});
```

---------------------------------------

<a name="node.label" />
### label(id|object(s), label(s), [replace,] callback)
*Aliases: __node.label__*

Add a label to a node.

__Arguments__

* `id|object(s)` - either the id of the node to label, or an object containing an
  id property of the node to label. can be an array of objects/ids.
* `label(s)` - the label(s) to apply. can be an array of labels.
* `replace` (optional) - if set to true, this label will replace any previous 
  labels.
* `callback` - function(err). if err is falsy, the operation succeeded.

__Example__

```javascript
db.save({ make: 'Citroen', model: 'DS4' }, function(err, node) {
  db.label(node, ['Car', 'Hatchback'], function(err) {
    // `node` is now labelled with "Car" and "Hatchback"!
  });
});
```

---------------------------------------

<a name="node.removeLabel" />
### removeLabel(id|object(s), label, callback)
*Aliases: __node.removeLabel__*

Remove a label from a node.

__Arguments__

* `id|object(s)` - either the id of the node to delabel, or an object containing 
  an id property of the node to delabel. can be an array of objects/ids.
* `label` - the label to remove. cannot be an array.
* `callback` - function(err). if err is falsy, the operation succeeded.

__Example__

```javascript
db.save({ make: 'Citroen', model: 'DS4' }, function(err, node) {
  db.label(node, ['Car', 'Hatchback'], function(err) {
    // `node` is now labelled with "Car" and "Hatchback"!
    db.removeLabel(node, 'Hatchback', function(err) {
      // `node` is now only labelled with "Car".
    });
  });
});
```

---------------------------------------

<a name="node.nodesWithLabel" />
### nodesWithLabel(label, callback)
*Aliases: __node.nodesWithLabel__*

Fetch all of the nodes that are labelled with a specific label.

__Arguments__

* `label` - the label.
* `callback` - function(err, results). results is always an array (assuming no
  error), containing the nodes that were labelled with `label`. if no nodes were
  labelled with `label`, `results` is an empty array.

__Example__

```javascript
db.save({ make: 'Citroen', model: 'DS4' }, function(err, node) {
  db.label(node, ['Car', 'Hatchback'], function(err) {
    db.nodesWithLabel('Car', function(err, results) {
      results[0].model // -> 'DS4'
    });
  });
});
```

---------------------------------------

<a name="node.readLabels" />
### readLabels([node(s),] callback)
*Aliases: __node.readLabels__*

Read the labels of a node, or all labels in the database.

__Arguments__

* `node(s)` (optional) - the node to return the labels of. if not specified, every
  label in the database is returned. can be an array of nodes.
* `callback` - function(err, labels). labels is an array of labels.

__Example__

```javascript
db.save({ make: 'Citroen', model: 'DS4' }, function(err, node) {
  db.label(node, ['Car', 'Hatchback'], function(err) {
    db.readLabels(node, function(err, labels) {
      //labels -> ['Car', 'Hatchback']
    });
  });
});
```

---------------------------------------

## Relationship Operations

<a name="rel.create" />
<a name="node.relate" />
### rel.create(firstId|firstObj, type, secondId|secondobj, [properties], callback)
*Aliases: __relate__, __node.relate__*

Create a relationship between two nodes.

__Arguments__

* `firstId | firstObject` - id of the start node or an object with an id property
  for the start node
* `type` - the name of the relationship
* `secondId | secondObject` - id of the end node or an object with an id property
  for the end node
* `properties` (optional, default=`{}`) - properties of the relationship
* `callback` - function(err, relationship) - `relationship` is the newly created
  relationship

__Example__

```javascript
db.relate(1, 'knows', 2, { for: '2 months' }, function(err, relationship) {
  assert.deepEqual(relationship, {
    start: 1,
    end: 2,
    type: 'knows',
    properties: { for: '2 months' },
    id: 1
  });
});
```

---------------------------------------

<a name="rel.update" />
### rel.update(relationship, [key, value,] callback)

Update the properties of a relationship. __Note__ that you cannot use this
method to update the base properties of the relationship (start, end, type) -
in order to do that you'll need to delete the old relationship and create a new
one.

__Arguments__

* `relationship` - the relationship object with some changed properties
* `key`, `value` (optional) - if a key and value is specified, only the property with
  that key will be updated. the rest of the object will not be touched.
* `callback` - function(err). if err is falsy, the update succeeded.

__Example__

```javascript
var props = { for: '2 months', location: 'Bergen' };

db.rel.create(1, 'knows', 2, props, function(err, relationship) {
  delete relationship.properties.location;
  relationship.properties.for = '3 months';
  db.rel.update(relationship, function(err) {
    // properties on this relationship in the database are now equal to
    // { for: '3 months' }
  });
});
```

---------------------------------------

<a name="rel.read" />
### rel.read(object|id, callback)

Read a relationship.

__Arguments__

* `object | id` - the id of the relationship to read or an object with an id
  property of the relationship to read.
* `callback` - function(err, relationship). `relationship` is an object
  representing the read relationship.

__Example__

```javascript
db.rel.create(1, 'knows', 2, { for: '2 months' }, function(err, newRelationship) {
  db.rel.read(newRelationship.id, function(err, readRelationship) {
    assert.deepEqual(newRelationship, readRelationship);
    assert.deepEqual(readRelationship, {
      start: 1,
      end: 2,
      type: 'knows',
      id: 1,
      properties: { for: '2 months' }
    });
  });
});
```

---------------------------------------

<a name="rel.delete" />
### rel.delete(object|id, [callback])

Delete a relationship.

__Arguments__

* `object | id` - the id of the relationship to delete or an object with an id
  property of the relationship to delete.
* `callback` - function(err). If `err` is falsy, the relationship has been
  deleted.

__Example__

```javascript
db.rel.create(1, 'knows', 2, { for: '2 months' }, function(err, rel) {
  db.rel.delete(rel.id, function(err) {
    if (!err) console.log("Relationship was deleted");
  });
});
```

## Constraints Operations

<a name="constraints.list" />
### constraints.list([label,] callback)

List all constraints, or optionally all constraints for a label.

__Arguments__

* `label` (optional) - the label to list constraints for
* `callback` - function(err, constraints). `constraints` is an array of
  constraint objects. For example, 
  `[{type:'UNIQUENESS', label:'Person', property_keys['name']}]`

__Example__

```javascript
db.constraints.list('Person', function(err, constraints) {
  console.log(constraints); 
  // -> [{ type: 'UNIQUENESS', label: 'Person', property_keys: ['name'] }]
});
```

---------------------------------------

<a name="constraints.uniqueness.list" />
### constraints.uniqueness.list(label, [key,] callback)

List all uniqueness constraints, or optionally fetch a uniqueness constraint for
`key`.

__Arguments__

* `label` - the label to list uniqueness constraints for
* `key` (optional) - if specified, retrieve any uniqueness constraint for this
  property key.
* `callback` - function(err, constraints). `constraints` is an array of
  constraint objects. For example, 
  `[{type:'UNIQUENESS', label:'Person', property_keys: ['name']}]`. If none
  existed, it is an empty array.

__Example__

```javascript
db.constraints.uniqueness.list('Person', 'name', function(err, constraints) {
  console.log(constraints); 
  // -> [{ type: 'UNIQUENESS', label: 'Person',  property_keys: ['name'] }]
});
```

---------------------------------------

<a name="constraints.uniqueness.create" />
### constraints.uniqueness.create(label, key, callback)

Create a uniqueness constraint on the given label. Any node labelled with `label`
will be constrained to having a unique value for the given `key`. If it doesn't,
attempting to label that node with `label` will return an error (unfortunately
due to the way neo4j handles these errors, the statusCode is 400 instead of 409,
but you can check with 
`err.neo4jCause.exception == 'ConstraintViolationException'`.

__Arguments__

* `label` - the label to create a uniqueness constraint for
* `key` - the key that should be unique on nodes labelled with `label`
* `callback` - function(err, constraint). `constraint` is a constraint object
  representing the constraint that was created, e.g. 
  `[{type:'UNIQUENESS', label:'Person', property_keys['name']}]`. If the
  constraint already existed, `err.statusCode == 409`.

__Example__

```javascript
// any node labelled Person should have a unique `name`
db.constraints.uniqueness.create('Person', 'name', function(err, constraint) {
  console.log(constraint); 
  // -> { type: 'UNIQUENESS', label: 'Person', property_keys: ['name'] }
});
```

---------------------------------------

<a name="constraints.uniqueness.createIfNone" />
### constraints.uniqueness.createIfNone(label, key, callback)

Create a uniqueness constraint on the given label. If the constraint exists,
don't return an error, just return the existing constraint.

__Arguments__

* `label` - the label to create a uniqueness constraint for
* `key` - the key that should be unique on nodes labelled with `label`
* `callback` - function(err, constraint). `constraint` is a constraint object
  representing the constraint that was created, e.g. 
  `[{type:'UNIQUENESS', label:'Person', property_keys: ['name']}]`. 

__Example__

```javascript
// any node labelled Person should have a unique `name`
db.constraints.uniqueness.createIfNone('Person', 'name', function(err, constraint) {
  console.log(constraint); 
  // -> { type: 'UNIQUENESS', label: 'Person',  property_keys: ['name'] }
  db.constraints.uniqueness.createIfNone('Person', 'name', function(err, constraint) {
    console.log(err);
    // -> undefined
    console.log(constraint); 
    // -> { type: 'UNIQUENESS', label: 'Person',  property_keys: ['name'] }
  });
});
```

---------------------------------------

<a name="constraints.uniqueness.drop" />
### constraints.uniqueness.drop(label, key, callback)

Drop (remove) a uniqueness constraint.

__Arguments__

* `label` - the label to remove a uniqueness constraint from
* `key` - the key on which to remove the uniqueness constraint
* `callback` - function(err). if `err` is falsy, the constraint was successfully
  dropped

__Example__

```javascript
// any node labelled Person should have a unique `name`
db.constraints.uniqueness.create('Person', 'name', function(err, constraint) {
  console.log(constraint); 
  // -> { type: 'UNIQUENESS', label: 'Person',  property_keys: ['name'] }
  db.constraints.uniqueness.drop('Person', 'name', function(err) {
    console.log(err);
    // -> undefined
    // the constraint has been dropped
  });
});
```

## Indexing Operations

**For more of an overview on schema-based indexing, check out the [neo4j docs
on the subject](http://docs.neo4j.org/chunked/milestone/graphdb-neo4j-schema.html#graphdb-neo4j-schema-indexes).**

<a name="index.create" />
### index.create(label, key, callback)

Create an index on `label` with `key`. Note that schema-based indexes are
performance-boosting only and do not imply any uniqueness constraints.

__Arguments__

* `label` - the label to create an index on
* `key` - the key to index, i.e. `'name'`. Note that compound indexes are not
  yet supported by neo4j-2
* `callback` - function(err, index). `index` is an object that reflects the
  index that was created, i.e. `{ label: 'Person', property_keys: ['name'] }`.
  Note that if you've already created the index, you'll get a conflict error. You
  can check this by checking `err`'s `statusCode` property. `409` indicates a 
  conflict. You can avoid this by using [index.createIfNone](#index.createIfNone)

__Example__

```javascript
db.index.create('Person', 'name', function(err, index) {
  console.log(index); // -> { label: 'Person', property_keys: ['name'] }
});
```

---------------------------------------

<a name="index.createIfNone" />
### index.createIfNone(label, key, callback)

Create an index on `label` with `key`. Exactly the same as
[index.create](#index.create) except it will not throw an error if it encounters
a conflict.

__Arguments__

* `label` - the label to create an index on
* `key` - the key to index, i.e. `'name'`. Note that compound indexes are not
  yet supported by neo4j-2
* `callback` - function(err, index). `index` is an object that reflects the
  index that was created, i.e. `{ label: 'Person', property_keys: ['name'] }`.

__Example__

```javascript
db.index.createIfNone('Person', 'name', function(err, index) {
  console.log(index); // -> { label: 'Person', property_keys: ['name'] }
});
```

---------------------------------------

<a name="index.list" />
### index.list(label, callback)

Retrieve a listing of the indexes on a label.

__Arguments__

* `label` - the label to retrieve indexes for
* `callback` - function(err, indexes). `indexes` is an array of objects that
  reflect the indexes on this label, i.e. 
  `[{ label: 'Person', property_keys: ['name'] }]`.

__Example__

```javascript
db.index.list('Person', function(err, index) {
  console.log(index); // -> [ { label: 'Person', property_keys: ['name'] } ]
});
```

---------------------------------------

<a name="index.drop" />
### index.drop(label, key, callback)

Drop an index from a label

__Arguments__

* `label` - the label to drop the index from
* `key` - the key to drop the index from 
* `callback` - function(err). if `err` is falsy, the index was dropped 
  successfully.

__Example__

```javascript
db.index.drop('Person', 'name' function(err) {
  if (!err) console.log('Index dropped!');
});
```


## Legacy Index Operations

**Note that as of Neo4j-2.0.0 legacy indexes are no longer the preferred way to
handle indexing**

<a name="legacyindex.create" />
### node.legacyindex.create(name, [config,] callback)
### rel.legacyindex.create(name, [config,] callback)

Create a new legacy index. If you're using the default legacy index configuration, 
this method is not necessary - you can just start using the legacy index with
[legacyindex.add](#legacyindex.add) as if it already existed.

__NOTE for legacy index functions:__ there are two different types of legacy 
index in neo4j - __node__ legacy indexes and __relationship__ legacy indexes. 
When you're working with __node__ legacy indexes, you use the functions on 
`node.legacyindex`.  Similarly, when you're working on __relationship__ legacy 
indexes you use the functions on `rel.legacyindex`. Most of the functions on 
both of these are identical (excluding the uniqueness functions), but one acts 
upon node legacy indexes, and the other upon relationship legacy indexes.

__Arguments__

* `name` - the name of the legacy index that is being created
* `config` (optional, default=`{}`) - the configuration of the legacy index. 
See the [neo4j docs](http://docs.neo4j.org/chunked/milestone/rest-api-indexes.html#rest-api-create-node-index-with-configuration)
  for more information.
* `callback` - function(err). If `err` is falsy, the legacy index has been created.

__Example__

```javascript
var indexConfig = { type: 'fulltext', provider: 'lucene' };
db.node.legacyindex.create('a_fulltext_index', indexConfig, function(err) {
  if (!err) console.log('a fulltext legacy index has been created!');
});
```

---------------------------------------

<a name="legacyindex.add" />
<a name="node.legacyindex" />
### node.legacyindex.add(indexName, id|object, key, value, callback);
### rel.legacyindex.add(indexName, id|object, key, value, callback);
*`node.legacyindex.add` is aliased as __node.legacyindex__ & __legacyindex__*

Add a node/relationship to a legacy index.

__NOTE for legacy index functions:__ there are two different types of legacy 
index in neo4j - __node__ legacy indexes and __relationship__ legacy indexes. 
When you're working with __node__ legacy indexes, you use the functions on 
`node.legacyindex`.  Similarly, when you're working on __relationship__ legacy 
indexes you use the functions on `rel.legacyindex`. Most of the functions on 
both of these are identical (excluding the uniqueness functions), but one acts 
upon node legacy indexes, and the other upon relationship legacy indexes.

__Arguments__

* `indexName` - the name of the legacy index to add the node/relationship to.
* `id | object` - the id of the node/relationship to add to the legacy index or 
  an object with an id property of the node/relationship to add to the legacy 
  index.
* `key` - the key to index the node/relationship with
* `value` - the value to index the node/relationship with
* `callback` - function(err). If `err` is falsy, the node/relationship has 
  been indexed.

__Example__

```javascript
db.save({ name: 'Jon' }, function(err, node) {
  db.legacyindex('people', node, 'name', node.name, function(err) {
    if (!err) console.log('Jon has been indexed!');
  });
});
```

---------------------------------------

<a name="legacyindex.read" />
### node.legacyindex.read(indexName, key, value, callback);
### rel.legacyindex.read(indexName, key, value, callback);

Read the object(s) from a legacy index that match a key-value pair. See also
[legacyindex.readAsList](#legacyindex.readAsList).

__NOTE for legacy index functions:__ there are two different types of legacy 
index in neo4j - __node__ legacy indexes and __relationship__ legacy indexes. 
When you're working with __node__ legacy indexes, you use the functions on 
`node.legacyindex`.  Similarly, when you're working on __relationship__ legacy 
indexes you use the functions on `rel.legacyindex`. Most of the functions on 
both of these are identical (excluding the uniqueness functions), but one acts 
upon node legacy indexes, and the other upon relationship legacy indexes.

__Arguments__

* `indexName` - the legacy index to read from
* `key` - the key to match
* `value` - the value to match
* `callback` - function(err, results). `results` is a node or relationship object
  (or an array of them if there was more than one) that matched the given 
  key-value pair in the given legacy index. If nothing matched, 
  `results === false`. [legacyindex.readAsList](#legacyindex.readAsList) is 
  similar, but always gives `results` as an array, with zero, one or more 
  elements.

__Example__

```javascript
db.rel.legacyindex.read('friendships', 'location', 'Norway', function(err, rels) {
  // `rels` is an array of all relationships indexed in the `friendships`
  // index, with a value `Norway` for the key `location`.
});
```

---------------------------------------

<a name="legacyindex.readAsList" />
### node.legacyindex.readAsList(indexName, key, value, callback);
### rel.legacyindex.readAsList(indexName, key, value, callback);

Read the object(s) from a legacy index that match a key-value pair. See also
[legacyindex.read](#legacyindex.read).

__NOTE for legacy index functions:__ there are two different types of legacy 
index in neo4j - __node__ legacy indexes and __relationship__ legacy indexes. 
When you're working with __node__ legacy indexes, you use the functions on 
`node.legacyindex`.  Similarly, when you're working on __relationship__ legacy 
indexes you use the functions on `rel.legacyindex`. Most of the functions on 
both of these are identical (excluding the uniqueness functions), but one acts 
upon node legacy indexes, and the other upon relationship legacy indexes.

__Arguments__

* `indexName` - the legacy index to read from
* `key` - the key to match
* `value` - the value to match
* `callback` - function(err, results). `results` is an array of node or
  relationship objects that matched the given key-value pair in the given legacy 
  index.  [legacyindex.read](#legacyindex.read) is similar, but gives `results` 
  as `false`, an object or an array of objects depending on the number of hits.

__Example__

```javascript
db.rel.legacyindex.readAsList('friendships', 'location', 'Norway', function(err, rels) {
  // `rels` is an array of all relationships indexed in the `friendships`
  // legacy index, with a value `Norway` for the key `location`.
});
```

---------------------------------------

<a name="legacyindex.remove" />
### node.legacyindex.remove(indexName, id|object, [key, [value,]] callback);
### rel.legacyindex.remove(indexName, id|object, [key, [value,]] callback);

Remove a node/relationship from a legacy index. 

__NOTE for legacy index functions:__ there are two different types of legacy 
index in neo4j - __node__ legacy indexes and __relationship__ legacy indexes. 
When you're working with __node__ legacy indexes, you use the functions on 
`node.legacyindex`.  Similarly, when you're working on __relationship__ legacy 
indexes you use the functions on `rel.legacyindex`. Most of the functions on 
both of these are identical (excluding the uniqueness functions), but one acts 
upon node legacy indexes, and the other upon relationship legacy indexes.

__Arguments__

* `indexName` - the legacy index to remove the node/relationship from.
* `id | object` - the id of the node/relationship to remove from the legacy 
  index or an object with an id property of the node/relationship to remove from
  the legacy index.
* `key` (optional) - the key from which to remove the node/relationship. If none
  is specified, every reference to the node/relationship is deleted from the
  legacy index.
* `value` (optional) - the value from which to remove the node/relationship. If
  none is specified, every reference to the node/relationship is deleted for the
  given key.
* `callback` - function(err). If `err` is falsy, the specified references have
  been removed.

__Example__

```javascript
db.node.legacyindex.remove('people', 6821, function(err) {
  if (!err) console.log("Every reference of node 6821 has been removed from the people index");
});

db.rel.legacyindex.remove('friendships', 351, 'in', 'Australia', function(err) {
  if (!err) console.log("Relationship 351 is no longer indexed as a friendship in Australia");
})
```

---------------------------------------

<a name="legacyindex.delete" />
### node.legacyindex.delete(name, callback);
### rel.legacyindex.delete(name, callback);

Delete a legacy index.

__NOTE for legacy index functions:__ there are two different types of legacy 
index in neo4j - __node__ legacy indexes and __relationship__ legacy indexes. 
When you're working with __node__ legacy indexes, you use the functions on 
`node.legacyindex`.  Similarly, when you're working on __relationship__ legacy 
indexes you use the functions on `rel.legacyindex`. Most of the functions on 
both of these are identical (excluding the uniqueness functions), but one acts 
upon node legacy indexes, and the other upon relationship legacy indexes.

__Arguments__

* `name` - the name of the legacy index to delete
* `callback` - function(err). if `err` is falsy, the legacy index has been deleted.

__Example__

```javascript
db.rel.legacyindex.delete('friendships', function(err) {
  if (!err) console.log('The `friendships` index has been deleted');
});
```

---------------------------------------

<a name="legacyindex.getOrSaveUnique" />
### node.legacyindex.getOrSaveUnique(node, index, key, value, callback);
### rel.legacyindex.getOrSaveUnique(startNode, relName, endNode, [properties,] index, key, value, callback);

Save a node or relationship, using a legacy index to enforce uniqueness. If 
there is already a node or relationship saved under the specified `key` and 
`value` in the specified `index`, that node or relationship will be returned.

Note that you cannot use this function to update nodes.

__NOTE for legacy index functions:__ there are two different types of legacy 
index in neo4j - __node__ legacy indexes and __relationship__ legacy indexes. 
When you're working with __node__ legacy indexes, you use the functions on 
`node.legacyindex`.  Similarly, when you're working on __relationship__ legacy 
indexes you use the functions on `rel.legacyindex`. Most of the functions on 
both of these are identical (excluding the uniqueness functions), but one acts 
upon node legacy indexes, and the other upon relationship legacy indexes.

__Arguments (node)__

* `node` - the node to save
* `index` - the name of the legacy index in which `key` and `value` are relevant
* `key` - the key to check or store under
* `value` - the value to check or store under
* `callback` - function(err, node) - returns your saved node, or the node that
  was referenced by the specified `key` and `value` if one already existed.

__Arguments (relationship)__ 
* `startNode` - the start point of the relationship (object containing id or id)
* `relName` - the name of the relationship to create
* `endNode` - the end point of the relationship (object containing id or id)
* `properties` (optional) - an object containing properties to store on the
  created relationship.
* `index` - the name of the legacy index in which `key` and `value` are relevant
* `key` - the key to check or store under
* `value` - the value to check or store under
* `callback` - function(err, rel) - returns your created relationship, or the 
  relationship that was referenced by the specified `key` and `value` if one 
  already existed.

__Example__

```javascript
var tag = { name: 'finnish' };

db.node.legacyindex.getOrSaveUnique(tag, 'tags', 'name', tag.name, function(err, tag) {
  // tag == { id: 1, name: 'finnish' }

  // save another new object with the same properties
  db.node.legacyindex.getOrSaveUnique({ name: 'finnish' }, 'tags', 'name', 'finnish', function(err, newTag) {
    // newTag == { id: 1, name: 'finnish' }
    // no save was performed because there was already an object at that index
  });
});
```

---------------------------------------

<a name="legacyindex.saveUniqueOrFail" />
### node.legacyindex.saveUniqueOrFail(node, index, key, value, callback);
### rel.legacyindex.saveUniqueOrFail(startNode, relName, endNode, [properties,] index, key, value, callback);

Save a node or relationship, using a legacy index to enforce uniqueness. If 
there is already a node or relationship saved under the specified `key` and 
`value` in the specified `index`, an error is returned indicating that there 
as a conflict. You can check if the result was a conflict by checking if 
`err.statusCode == 409`.

__NOTE for legacy index functions:__ there are two different types of legacy 
index in neo4j - __node__ legacy indexes and __relationship__ legacy indexes. 
When you're working with __node__ legacy indexes, you use the functions on 
`node.legacyindex`.  Similarly, when you're working on __relationship__ legacy 
indexes you use the functions on `rel.legacyindex`. Most of the functions on 
both of these are identical (excluding the uniqueness functions), but one acts 
upon node legacy indexes, and the other upon relationship legacy indexes.

__Arguments (node)__

* `node` - the node to save
* `index` - the name of the legacy index in which `key` and `value` are relevant
* `key` - the key to check or store under
* `value` - the value to check or store under
* `callback` - function(err, node) - returns your created node, or an err with 
  `statusCode == 409` if a node already existed at that legacy index

__Arguments (relationship)__ 
* `startNode` - the start point of the relationship (object containing id or id)
* `relName` - the name of the relationship to create
* `endNode` - the end point of the relationship (object containing id or id)
* `properties` (optional) - an object containing properties to store on the
  created relationship.
* `index` - the name of the legacy index in which `key` and `value` are relevant
* `key` - the key to check or store under
* `value` - the value to check or store under
* `callback` - function(err, rel) - returns your created relationship, or an 
  err with `statusCode == 409` if a relationship already existed at that legacy 
  index

__Example__

```javascript
var tag = { name: 'finnish' };
db.node.legacyindex.saveUniqueOrFail(tag, 'tags', 'name', tag.name, function(err, tag) {
  // tag == { id: 1, name: 'finnish' }

  // save another new object with the same properties
  db.node.legacyindex.saveUniqueOrFail({ name: 'finnish' }, 'tags', 'name', 'finnish', function(err, newTag) {
    // newTag == undefined
    // err.statusCode == 409 (conflict)
    // an error was thrown because there was already a node at that index.
  });
});
```

---------------------------------------

Development of Seraph is lovingly sponsored by 
[BRIK Tekonologier AS](http://www.github.com/brikteknologier) in Bergen, Norway.

<img src="http://i.imgur.com/9JjcBcx.jpg" width="800"/>
