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

### Generic Operations

* [query](#query) - perform a cypher query and parse the results
* [rawQuery](#rawQuery) - perform a cypher query and return unparsed results
* ~~[traversal](#traversal) - perform a traversal~~

### API Communication Operations

* [operation](#operation) - create a representation of a REST API call
* [call](#call) - take an operation and call it
* ~~[batch](#batch) - perform multiple operations atomically~~

### Node Operations
* [save (node.save)](#node.save) - create or update a node
* [read (node.read)](#node.read) - read a node
* [find (node.find)](#node.find) - find a node using a predicate
* [delete (node.delete)](#node.delete) - delete a node
* [relate (node.relate)](#node.relate) - relate two nodes
* [relationships (node.relationships)](#node.relationships) - read the 
  relationships of a node
* [index (node.index)](#node.index) - add a node to an index

### Relationship Operations
* [rel.create](#rel.create) - create a relationship
* [rel.update](#rel.update) - update the properties of a relationship
* [rel.read](#rel.read) - read a relationship
* [rel.delete](#rel.delete) - delete a relationship

### Index Operations
* [index.create](#index.create) - create an index
* [index.add](#index.add) - add a nodes/rels to an index
* [index.read](#index.read) - read nodes/rels from an index
* [index.remove](#index.remove) - remove nodes/rels from an index
* [index.delete](#index.delete) - delete an index

## Compatibility

Seraph has been tested with Neo4j 1.8. As we progress in development, we will
begin adding some legacy support for older versions.

## Testing

To test Seraph, download Neo4j and extract it in the seraph directory. Rename
the neo4j folder to `db`. Then:

    npm test

or, if you have started the test instance yourself and don't want the tests to
restart and clean the server every time:

    npm run-script quick-test

## Initialization
<a name="seraph" />
### seraph([server|options])

Creates and returns the Seraph instance.  If no parameters are given,
assumes the Neo4J REST API is running locally at the default location
`http://localhost:7474/db/data`.

__Arguments__

* options (default=`{ server: "http://localhost:7474", endpoint: "/db/data" }` - `server` is protocol and authority part of Neo4J REST API URI, and `endpoint` should be the path segment of the URI.
* server (string) - Short form to specify server parameter only. `"http://localhorse:4747"` is equivalent to `{ server: "http://localhorse:4747" }`.

__Example__

```javascript
// To http://localhost:7474/db/data
var dbLocal = require("seraph")();

// To http://example.com:53280/neo
var dbRemote = require("seraph")({ server: "http://example.com:53280",
                                   endpoint: "/neo" });

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

## Generic Operations

<a name="query" /><a name="rawQuery"/>
### query(query, [params,] callback), rawQuery(query, [params,] callback)

`rawQuery` performs a cypher query and returns the results directly from the
REST API.  
`query` performs a cypher query and map the columns and results together.

__Note__: if you're performing large queries it may be advantageous to use
`queryRaw`, since `query` attempts to infer whole nodes and relationships that
are returned (in order to transform them into a nicer format).

__Arguments__

* query - Cypher query as a format string.
* params (optional, default=`{}`). Replace `{key}` parts in query string.  See 
  cypher documentation for details.
* callback - (err, result).  Result is an array of objects.

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

db.rawQuery(cypher, {id: 3}, function(err, result) {
  if (err) throw err;
  // result contains the raw response from neo4j's rest API. See
  // http://docs.neo4j.org/chunked/milestone/rest-api-cypher.html
  // for more info
})
```

---------------------------------------

<a name="traversal" />
### ~~traversal(traversal, callback)~~

__Feature planned for 1.1.0__

---------------------------------------

<a name="operation" />
### operation(path, [method='get/post'], [data])

Create an operation object that will be passed to [call](#call). 

__Arguments__

* path - the path fragment of the request URL with no leading slash. 
* method (optional, default=`'GET'`|`'POST'`) - the HTTP method to use. When 
  `data` is an  object, `method` defaults to 'POST'. Otherwise, `method` 
  defaults to `GET`.
* data (optional) - an object to send to the server with the request.

__Example__

```javascript
var operation = db.operation('node/4285/properties', 'PUT', { name: 'Jon' });
db.call(operation, function(err) {
  if (!err) console.log('Set `name` to `Jon` on node 4285!')
});
```

---------------------------------------

<a name="call" />
### call(operation, callback)

Perform an HTTP request to the server.

If the body is some JSON, it is parsed and passed to the callback.If the status
code is not in the 200's, an error is passed to the callback. 

__Arguments__

* operation - an operation created by [operation](#operation) that specifies
  what to request from the server
* callback - function(err, result, response). `result` is the JSON parsed body
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
### ~~batch(block|operationArray, callback)~~

__Feature planned for 1.1.0__

## Node Operations

<a name="node.save" />
### save(object, callback)
*Aliases: __node.save__*

Create or update a node. If `object` has an id property, the node with that id
is updated. Otherwise, a new node is created. Returns the newly created/updated
node to the callback.

__Arguments__

* node - an object to create or update
* callback - function(err, node). `node` is the newly saved or updated node. If
  a create was performed, `node` will now have an id property. The returned 
  object is not the same reference as the passed object (the passed object will
  never be altered).

__Example__

```javascript
// Create a node
db.save({ name: 'Jon', age: 22, likes: 'Beer' }, function(err, node) {
  console.log(node); // -> { name: 'Jon', age: 22, likes: 'Beer', id: 1 }
  
  // Update it
  delete node.likes;
  node.age++;
  db.save(node, function(err, node) {
    console.log(node); // -> { name: 'Jon', age: 23, id: 1 }
  })
})
```

---------------------------------------

<a name="node.read" />
### read(id|object, callback)
*Aliases: __node.read__*

Read a node.

__Arguments__

* id|object - either the id of the node to read, or an object containing an id
property of the node to read.
* callback - function(err, node). `node` is an object containing the properties
of the node with the given id.

__Example__

```javascript
db.save({ make: 'Citroen', model: 'DS4' }, function(err, node) {
  db.read(node.id, function(err, node) {
    console.log(node) // -> { make: 'Citroen', model: 'DS4', id: 1 }
  })
})
```

---------------------------------------

<a name="node.delete" />
### delete(id|object, [force], [callback])
*Aliases: __node.delete__*

Delete a node.

__Arguments__

* id|object - either the id of the node to delete, or an object containing an id
property of the node to delete.
* force - if truthy, will delete all the node's relations prior to deleting the node.
* callback - function(err). if `err` is falsy, the node has been deleted.

__Example__

```
db.save({ name: 'Jon' }, function(err, node) {
  db.delete(node, function(err) {
    if (!err) console.log('Jon has been deleted!');
  })
})
```

---------------------------------------

<a name="node.find" />
### find(predicate, [any, [start,]] callback)
*Aliases: __node.find__*

Perform a query based on a predicate. The predicate is translated to a
cypher query.

__Arguments__

* predicate - Partially defined object.  Will return elements which match
  the defined attributes of predicate.
* any (optional, default=`false`) - If true, elements need only match on one 
  attribute. If false, elements must match on all attributes.
* start (optional, default=`'node(*)'`) - The scope of the search. For alternate
  values, check the [neo4j docs on the cypher START command](http://docs.neo4j.org/chunked/stable/query-start.html).
* callback - function(err, results) - `results` is an array of the resulting
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
var people = db.find(predicate, function (err, objs) {
    if (err) throw err;
    assert.equals(3, people.length);
};
```

---------------------------------------

<a name="node.relationships" />
### relationships(id|object, [direction, [type,]] callback)
**Aliases: __node.relationships__*

Read the relationships involving the specified node.

__Arguments__

* id|object - either the id of a node, or an object containing an id property of
  a node.
* direction ('all'|'in'|'out') (optional unless `type` is passed, 
  default=`'all'`) - the direction of relationships to read. 
* type (optional, default=`''` (match all relationships)) - the relationship
  type to find
* callback - function(err, relationships) - `relationships` is an array of the
  matching relationships

__Example__

```javascript
db.relationships(452, 'out', 'knows', function(err, relationships) {
  // relationships = all outgoing `knows` relationships from node 452
})
```

## Relationship Operations

<a name="rel.create" />
<a name="node.relate" />
### rel.create(firstId|firstObj, type, secondId|secondobj, [properties], callback)
*Aliases: __relate__, __node.relate__*

Create a relationship between two nodes.

__Arguments__

* firstId|firstObject - id of the start node or an object with an id property
  for the start node
* type - the name of the relationship
* secondId|secondObject - id of the end node or an object with an id property
  for the end node
* properties (optional, default=`{}`) - properties of the relationship
* callback - function(err, relationship) - `relationship` is the newly created
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
### rel.update(relationship, callback)

Update the properties of a relationship. __Note__ that you cannot use this
method to update the base properties of the relationship (start, end, type) -
in order to do that you'll need to delete the old relationship and create a new
one.

__Arguments__

* relationship - the relationship object with some changed properties
* callback - function(err). if err is falsy, the update succeeded.

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

* object|id - the id of the relationship to read or an object with an id
  property of the relationship to read.
* callback - function(err, relationship). `relationship` is an object
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

* object|id - the id of the relationship to delete or an object with an id
  property of the relationship to delete.
* callback - function(err). If `err` is falsy, the relationship has been
  deleted.

__Example__

```javascript
db.rel.create(1, 'knows', 2, { for: '2 months' }, function(err, rel) {
  db.rel.delete(rel.id, function(err) {
    if (!err) console.log("Relationship was deleted");
  });
});
```

## Index Operations

<a name="index.create" />
### node.index.create(name, [config,] callback)
### rel.index.create(name, [config,] callback)

Create a new index. If you're using the default index configuration, this
method is not necessary - you can just start using the index with
[index.add](#index.add) as if it already existed.

__NOTE for index functions:__ there are two different types on index in neo4j - 
__node__ indexes and __relationship__ indexes. When you're working with __node__
indexes, you use the functions on `node.index`. Similarly, when you're working
on __relationship__ indexes you use the functions on `rel.index`. All of the
functions on both of these are identical, but one acts upon node 
indexes, and the other upon relationship indexes.

__Arguments__

* name - the name of the index that is being created
* config (optional, default=`{}`) - the configuration of the index. See the [neo4j docs](http://docs.neo4j.org/chunked/milestone/rest-api-indexes.html#rest-api-create-node-index-with-configuration)
  for more information.
* callback - function(err). If `err` is falsy, the index has been created.

__Example__

```javascript
var indexConfig = { type: 'fulltext', provider: 'lucene' };
db.node.index.create('a_fulltext_index', indexConfig, function(err) {
  if (!err) console.log('a fulltext index has been created!');
});
```

---------------------------------------

<a name="index.add" />
<a name="node.index" />
### node.index.add(indexName, id|object, key, value, callback);
### rel.index.add(indexName, id|object, key, value, callback);
*`node.index.add` is aliased as __node.index__ & __index__*

Add a node/relationship to an index.

__NOTE for index functions:__ there are two different types on index in neo4j - 
__node__ indexes and __relationship__ indexes. When you're working with __node__
indexes, you use the functions on `node.index`. Similarly, when you're working
on __relationship__ indexes you use the functions on `rel.index`. All of the
functions on both of these are identical, but one acts upon node 
indexes, and the other upon relationship indexes.

__Arguments__

* indexName - the name of the index to add the node/relationship to.
* id|object - the id of the node/relationship to add to the index or an object 
  with an id property of the node/relationship to add to the index.
* key - the key to index the node/relationship with
* value - the value to index the node/relationship with
* callback - function(err). If `err` is falsy, the node/relationship has 
  been indexed.

__Example__

```javascript
db.save({ name: 'Jon', }, function(err, node) {
  db.index('people', node, 'name', node.name, function(err) {
    if (!err) console.log('Jon has been indexed!');
  });
});
```

---------------------------------------

<a name="index.read" />
### node.index.read(indexName, key, value, callback);
### rel.index.read(indexName, key, value, callback);

Read the object(s) from an index that match a key-value pair.

__NOTE for index functions:__ there are two different types on index in neo4j - 
__node__ indexes and __relationship__ indexes. When you're working with __node__
indexes, you use the functions on `node.index`. Similarly, when you're working
on __relationship__ indexes you use the functions on `rel.index`. All of the
functions on both of these are identical, but one acts upon node 
indexes, and the other upon relationship indexes.

__Arguments__

* indexName - the index to read from
* key - the key to match
* value - the value to match
* callback - function(err, results). `results` is a node or relationship object
  (or an array of them if there was more than one) that matched the given 
  key-value pair in the given index. If nothing matched, `results === false`.

__Example__

```javascript
db.rel.index.read('friendships', 'location', 'Norway', function(err, rels) {
  // `rels` is an array of all relationships indexed in the `friendships`
  // index, with a value `Norway` for the key `location`.
});
```

---------------------------------------

<a name="index.remove" />
### node.index.remove(id|object, indexName, [key, [value,]] callback);
### rel.index.remove(id|object, indexName, [key, [value,]] callback);

Remove a node/relationship from an index. 

__NOTE for index functions:__ there are two different types on index in neo4j - 
__node__ indexes and __relationship__ indexes. When you're working with __node__
indexes, you use the functions on `node.index`. Similarly, when you're working
on __relationship__ indexes you use the functions on `rel.index`. All of the
functions on both of these are identical, but one acts upon node 
indexes, and the other upon relationship indexes.

__Arguments__

* id|object - the id of the node/relationship to remove from the index or an 
  object with an id property of the node/relationship to remove from the index.
* indexName - the index to remove the node/relationship from.
* key (optional) - the key from which to remove the node/relationship. If none
  is specified, every reference to the node/relationship is deleted from the
  index.
* value (optional) - the value from which to remove the node/relationship. If
  none is specified, every reference to the node/relationship is deleted for the
  given key.
* callback - function(err). If `err` is falsy, the specified references have
  been removed.

__Example__

```javascript
db.node.index.remove(6821, 'people', function(err) {
  if (!err) console.log("Every reference of node 6821 has been removed from the people index");
});

db.rel.index.remove(351, 'friendships', 'in', 'Australia', function(err) {
  if (!err) console.log("Relationship 351 is no longer indexed as a friendship in Australia");
})
```

---------------------------------------

<a name="index.delete" />
### node.index.delete(name, callback);
### rel.index.delete(name, callback);

Delete an index.

__NOTE for index functions:__ there are two different types on index in neo4j - 
__node__ indexes and __relationship__ indexes. When you're working with __node__
indexes, you use the functions on `node.index`. Similarly, when you're working
on __relationship__ indexes you use the functions on `rel.index`. All of the
functions on both of these are identical, but one acts upon node 
indexes, and the other upon relationship indexes.

__Arguments__

* name - the name of the index to delete
* callback - function(err). if `err` is falsy, the index has been deleted.

__Example__

```javascript
db.rel.index.delete('friendships', function(err) {
  if (!err) console.log('The `friendships` index has been deleted');
})
```

---------------------------------------

*Seraph.js was started lovingly by BRIK Teknologier AS in Bergen, Norway*  
<img src="http://brik.no/brikflake.svg" width="91" height="87"/>
