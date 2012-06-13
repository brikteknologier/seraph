# Seraph.js

Binds to the REST API of [neo4j](http://neo4j.org/).  Intended to be
terse, simple, and idiomatic to [node.js](http://nodejs.org/).

## Quick Example

    // Insert, then delete an object
    var db = require("seraph").db("http://localhost:7474");
    db.node.save({ name: "Test-Man", age: 40 }, function (err, data) {
        if (err) throw err;
        console.log("Test-Man inserted.");
        db.node.delete(data, function (err) {
            if (err) throw err;
            console.log("Test-Man away!");
        }
    }

## Documentation

### Module Functions

* [db](#db)

<a name="seraph.db_list" />
### `db` Functions

* [find](#find)
* [query](#query)
* [transaction](#transaction)
* [node.delete](#node.delete)
* [node.read](#node.read)
* [node.save](#node.save)
* [relationship.delete](#relationship.delete)
* [relationship.read](#relationship.read)
* [relationship.save](#relationship.save)

<a name="seraph.db.transaction_list" /a>
### `transaction` Functions

* [node.delete](#transaction.node.delete)
* [node.read](#transaction.node.read)
* [node.save](#transaction.node.save)
* [relationship.delete](#transaction.relationship.delete)
* [relationship.read](#transaction.relationship.read)
* [relationship.save](#transaction.relationship.save)

### Alternative Function Names

For convenience, the following aliases have been added:

* `db.n = db.node`
* `db.r = db.relationship`
* `db.delete = db.node.delete`
* `db.read = db.node.read`
* `db.save = db.node.save`
* `transaction.n = transaction.node`
* `transaction.r = transaction.relationship`
* `transaction.delete = transaction.node.delete`
* `transaction.read = transaction.node.read`
* `transaction.save = transaction.node.save`

You can also access `db` functions directly on `seraph`, but then you
will have to provide a configuration as the first parameter.  (See
[db](#db) for configuration documentation.)  So this:

    var seraph = require("seraph");
    var db = seraph.db("http://localhost:7474/");
    db.node.save({x: 3});

Can be written like this:

    var seraph = require("seraph");
    seraph.node.save("http://localhost:7474/", {x: 3});

Or using one of the aliases above:

    var seraph = require("seraph");
    seraph.save("http://localhost:7474/", {x: 3});

## Module Functions

<a name="db" />
### db (options)

Returns an object with database access functions.  See
[seraph.db](#seraph.db_list).

`options` is an object with the following attributes:

* `options.endpoint`: Required.  URL of neo4j REST API.
* `options.id`: Optional.  Default="id".  Saved objects will have this
  property set to the generated database ID.  When updating or
  deleting objects, will look for object ID in this property.

Alternatively, `options` can just be the REST API URL as a string.

---------------------------------------

<a name="find" />
### find (predicate, any, callback)

Perform a query based on a predicate. The predicate is translated to a
cypher query.

__Arguments__

* predicate - Partially defined object.  Will return elements which match
              the defined attributes of predicate.
* any - default=false. If true, elements need only match on one attribute.
        If false, elements must match on all attributes.

__Example__

Given database content:

    { name: 'Jon'    , age: 23, australian: true  }
    { name: 'Neil'   , age: 60, australian: true  }
    { name: 'Belinda', age: 26, australian: false }
    { name: 'Katie'  , age: 29, australian: true  }

Retrieve all australians:

    var predicate = { australian: true };
    var people = db.find(predicate, function (err, objs) {
        if (err) throw err;
        assert.equals(3, people.length);
    };

---------------------------------------

<a name="query" />
### query (query, params, callback)

Perform a cypher query and map the columns and results together.

__Arguments__

* query - Cypher query as a format string.
* params - Default={}. Replace `{key}` parts in query string.  See cypher
           documentation for details.
* callback - function (err, result).  Result is an array of objects.

__Example__

Given database:

    {name: 'Jon', age: 23, id: 1}
    {name: 'Neil', age: 60, id: 2}
    {name: 'Katie', age: 29, id: 3}
    1 --knows--> 2
    1 --knows--> 3

Return all people Jon knows:

    var cypher = "start x = node({id}) "
               + "match x -[r]-> n "
               + "return type(r), n.name?, n.age? "
               + "order by n.name";
    db.query(cypher, {id: 3}, function(err, result) {
        if (err) throw err;
        assert.equal(2, result.length);
    };

---------------------------------------

<a name="node.delete" />
### node.delete (id|object, [callback])

<img src="http://placekitten.com/200/140">

---------------------------------------

<a name="node.read" />
### node.read (id|object, callback)

<img src="http://placekitten.com/200/140">

---------------------------------------

<a name="node.save" />
### node.save (object, callback)

<img src="http://placekitten.com/200/140">

---------------------------------------

<a name="relationship.delete" />
### relationship.delete (object|id, [callback])

<img src="http://placekitten.com/200/140">

---------------------------------------

<a name="relationship.read" />
### relationship.read (object|id, callback)

<img src="http://placekitten.com/200/140">

---------------------------------------

<a name="relationship.save" />
### relationship.save (firstId|firstObj, name, secondId|secondobj, [props], callback)

<img src="http://placekitten.com/200/140">

---------------------------------------

<a name="transaction.node.delete" />
### node.delete (id|object, [callback])

<img src="http://placekitten.com/200/140">

---------------------------------------

<a name="transaction.node.read" />
### node.read (id|object, callback)

<img src="http://placekitten.com/200/140">

---------------------------------------

<a name="transaction.node.save" />
### node.save (object, callback)

<img src="http://placekitten.com/200/140">

---------------------------------------

<a name="transaction.relationship.delete" />
### relationship.delete (object|id, [callback])

<img src="http://placekitten.com/200/140">

---------------------------------------

<a name="transaction.relationship.read" />
### relationship.read (object|id, callback)

<img src="http://placekitten.com/200/140">

---------------------------------------

<a name="transaction.relationship.save" />
### relationship.save (firstId|firstObj, name, secondId|secondobj, [props], callback)

<img src="http://placekitten.com/200/140">

---------------------------------------
