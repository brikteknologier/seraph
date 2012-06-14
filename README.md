# Seraph.js

Binds to the REST API of [neo4j](http://neo4j.org/).  Intended to be
terse, simple, and idiomatic to [node.js](http://nodejs.org/).

## Quick Example

```javascript
// Insert, then delete an object
var db = require("seraph").db("http://localhost:7474");
db.save({ name: "Test-Man", age: 40 }, function (err, data) {
  if (err) throw err;

  console.log("Test-Man inserted.");

  db.node.delete(data, function (err) {
    if (err) throw err;
    console.log("Test-Man away!");
  }
}
```

## Documentation

<a name="seraph.db_list" />
### Generic Operations

* [db](#db)
* [query](#query)
* [rawQuery](#rawQuery)
* [traversal](#traversal)

### API Communication Operations

* [operation](#operation)
* [call](#call)
* [batch](#batch)

### Node Operations
* [save (node.save)](#node.save)
* [read (node.read)](#node.read)
* [find (node.find)](#node.find)
* [delete (node.delete)](#node.delete)
* [relate (node.relate)](#node.relate)
* [relationships (node.relationships)](#node.relationships)
* [index (node.index)](#node.index)
* [indexes (node.indexes)](#node.indexes)

### Relationship Operations
* [rel.save](#rel.save)
* [rel.read](#rel.read)
* [rel.delete](#rel.delete)

### Index Operations
* [index.create](#index.create)
* [index.add](#index.add)
* [index.read](#index.read)


You can also access all functions directly on `seraph` (without calling `db()`).
In this case you must supply an options argument. (See [db](#db) for 
configuration documentation).  So this:

```javascript
var seraph = require("seraph");
var db = seraph.db("http://localhost:7474/");
db.save({x: 3});
```

Could also be written like this:

```javascript
var seraph = require("seraph");
seraph.save("http://localhost:7474/", {x: 3});
```

## Module Functions

<a name="db" />
### db (options)

Returns an object with database access functions.  See
[seraph.db](#seraph.db_list).

`options` is an object with the following attributes:

* `options.endpoint`: Optional.  Default="http://localhost:7474". URL of neo4j 
  REST API.
* `options.id`: Optional.  Default="id".  Saved objects will have this
  property set to the generated database ID.  When updating or
  deleting objects, will look for object ID in this property.

Alternatively, `options` can just be the database URL as a string.

---------------------------------------

## `db` Functions

<a name="query" /><a name="rawQuery"/>
### query/rawQuery (query, [params,] callback)

`rawQuery` performs a cypher query and returns the results directly from the
REST API.  
`query` performs a cypher query and map the columns and results together.

__Arguments__

* query - Cypher query as a format string.
* params - Default=`{}`. Replace `{key}` parts in query string.  See cypher
           documentation for details.
* callback - function (err, result).  Result is an array of objects.

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
### traversal (traversal, callback)

<img src="http://placekitten.com/200/140">

---------------------------------------

<a name="operation" />
### operation (path, [method='get'], [data])

<img src="http://placekitten.com/200/140">

---------------------------------------

<a name="call" />
### call (opts, operation, callback)

<img src="http://placekitten.com/200/140">

---------------------------------------

<a name="batch" />
### batch (block|operationArray, callback)

<img src="http://placekitten.com/200/140">

---------------------------------------

<a name="node.save" />
### save (object, callback)
**Aliases: __node.save__**

<img src="http://placekitten.com/200/145">

---------------------------------------

<a name="node.read" />
### read (id|object, callback)
**Aliases: __node.read__**

<img src="http://placekitten.com/200/142">

---------------------------------------

<a name="node.delete" />
### delete (id|object, [callback])
**Aliases: __node.delete__**

<img src="http://placekitten.com/200/140">

---------------------------------------

<a name="node.find" />
### find (predicate, any, callback)
**Aliases: __node.find__**

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
### relate (first, relationshipName, second, [props,] callback)
**Aliases: __node.relate__**

<img src="http://placekitten.com/200/140">

---------------------------------------

<a name="node.relationships" />
### relationships (obj, [direction, [relName,]] callback)
**Aliases: __node.relationships__**

<img src="http://placekitten.com/200/145">

---------------------------------------

<a name="node.index" />
### index (<<<TBD>>>)
**Aliases: __node.index__**

<img src="http://placekitten.com/200/142">

---------------------------------------

<a name="node.indexes" />
### indexes (<<<TBD>>>)
**Aliases: __node.indexes__**

<img src="http://placekitten.com/200/140">

---------------------------------------

<a name="rel.save" />
### rel.save (firstId|firstObj, name, secondId|secondobj, [props], callback)

<img src="http://placekitten.com/200/150">

---------------------------------------

<a name="rel.read" />
### rel.read (object|id, callback)

<img src="http://placekitten.com/200/139">

---------------------------------------

<a name="rel.delete" />
### rel.delete (object|id, [callback])

<img src="http://placekitten.com/200/147">

---------------------------------------

<a name="index.create" />
### index.create (<<<TBD>>>)

**Intent: create an index**

<img src="http://placekitten.com/200/150">

---------------------------------------

<a name="index.add" />
### index.add (<<<TBD>>>)

**Intent: add an object to the given index**

<img src="http://placekitten.com/200/139">

---------------------------------------

<a name="index.read" />
### index.read (<<<TBD>>>)

**Intent: read all (or a subset?) of objects from the given index**

<img src="http://placekitten.com/200/147">

---------------------------------------