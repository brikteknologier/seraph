# Seraph.js

A terse & familiar binding to the [Neo4j](http://neo4j.org/) REST API that is 
idiomatic to [node.js](http://nodejs.org/).

## Quick Example

```javascript
var db = require("seraph").db("http://localhost:7474");

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
* [relationships (node.relationships)](#node.relationships) - read the relationships of a node
* [index (node.index)](#node.index) - add an index to a node

### Relationship Operations
* [rel.create](#rel.create) - create a relationship
* [rel.update](#rel.update) - update the properties of a relationship
* [rel.read](#rel.read) - read a relationship
* [rel.delete](#rel.delete) - delete a relationship

### Index Operations
* [node.index.create & rel.index.create](#index.create) - create an index
* [node.index.add & rel.index.add](#index.add) - add a nodes/rels to an index
* [node.index.read & rel.index.read](#index.read) - read nodes/rels from an index
* [node.index.remove & rel.index.remove](#index.remove) - remove nodes/rels from an index
* [node.index.delete & rel.index.delete](#index.delete) - delete an index

## Compatibility

Seraph has been tested with Neo4j 1.8. As we progress in development, we will
begin adding some legacy support for the more recent versions.

## Testing

To test Seraph, download Neo4j and extract it in the seraph directory. Rename
the neo4j folder to `db`. Then:

    npm test

or, if you have started the test instance yourself and don't want the tests to
restart and clean the server every time:

    npm run-script quick-test

## Generic Operations

<a name="query" /><a name="rawQuery"/>
### query(query, [params,] callback), rawQuery(query, [params,] callback)

`rawQuery` performs a cypher query and returns the results directly from the
REST API.  
`query` performs a cypher query and map the columns and results together.

If you're doing queries on very large sets of data, it may be wiser to use
`query` and deal with neo4j's results directly.

__Arguments__

* query - Cypher query as a format string.
* params - Default=`{}`. Replace `{key}` parts in query string.  See cypher
           documentation for details.
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

__Note__: if you're performing large queries it may be advantageous to use
`queryRaw`, since `query` attempts to infer whole nodes and relationships that
are returned (in order to transform them into a nicer format).

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
* method (optional) - the HTTP method to use. When `data` is an 
  object, `method` defaults to 'POST'. Otherwise, `method` defaults to `GET`.
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
var operation = db.operation('node/4285/properties', 'GET', { name: 'Jon' });
db.call(operation, function(err) {
  if (!err) console.log('Set `name` to `Jon` on node 4285!')
});
```

---------------------------------------

<a name="batch" />
### ~~batch(block|operationArray, callback)~~

__Feature planned for 1.1.0__

---------------------------------------

<a name="node.save" />
### save(object, callback)
*Aliases: __node.save__*

<img src="http://placekitten.com/200/145">

---------------------------------------

<a name="node.read" />
### read(id|object, callback)
*Aliases: __node.read__*

<img src="http://placekitten.com/200/142">

---------------------------------------

<a name="node.delete" />
### delete(id|object, [callback])
*Aliases: __node.delete__*

<img src="http://placekitten.com/200/140">

---------------------------------------

<a name="node.find" />
### find(predicate, any, callback)
*Aliases: __node.find__*

Perform a query based on a predicate. The predicate is translated to a
cypher query.

__Arguments__

* predicate - Partially defined object.  Will return elements which match
              the defined attributes of predicate.
* any - default=false. If true, elements need only match on one attribute.
        If false, elements must match on all attributes.

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

<a name="node.relate" />
### relate(first, relationshipName, second, [props,] callback)
**Aliases: __node.relate__*

<img src="http://placekitten.com/200/140">

---------------------------------------

<a name="node.relationships" />
### relationships(obj, [direction, [relName,]] callback)
**Aliases: __node.relationships__*

<img src="http://placekitten.com/200/145">

---------------------------------------

<a name="node.index" />
### index(node, indexName, key, value, callback)
**Aliases: __node.index__*

<img src="http://placekitten.com/200/142">

---------------------------------------

<a name="rel.create" />
### rel.create(firstId|firstObj, name, secondId|secondobj, [props], callback)

<img src="http://placekitten.com/200/150">

---------------------------------------

<a name="rel.update" />
### rel.update(relationship, callback)

<img src="http://placekitten.com/200/150">

---------------------------------------

<a name="rel.read" />
### rel.read(object|id, callback)

<img src="http://placekitten.com/200/139">

---------------------------------------

<a name="rel.delete" />
### rel.delete(object|id, [callback])

<img src="http://placekitten.com/200/147">

---------------------------------------

<a name="index.create" />
### index.create(name, [config,] callback)

*Intent: create an index*

<img src="http://placekitten.com/200/150">

---------------------------------------

<a name="index.add" />
### index.add(node|rel, indexName, key, value, callback);

*Intent: add an object to the given index*

<img src="http://placekitten.com/200/139">

---------------------------------------

<a name="index.read" />
### index.read(node|rel, indexName, key, value, callback);

*Intent: read all (or a subset?) of objects from the given index*

<img src="http://placekitten.com/200/147">

---------------------------------------

<a name="index.remove" />
### index.remove(node|rel, indexName, key, value, callback);

*Intent: remove an object from an index*

<img src="http://placekitten.com/220/147">

---------------------------------------

<a name="index.delete" />
### index.delete(name, callback);

*Intent: delete an index*

<img src="http://placekitten.com/240/147">

---------------------------------------
