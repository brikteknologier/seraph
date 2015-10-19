var db = require('./util/database').db();
var uniqn = require('./util/ponies').uniqn;
var _ = require('underscore');
var assert = require('assert');
var async = require('async');

describe('seraph#query, seraph#queryRaw', function() {
  it('should perform a cypher query', function(done) {
    function createObjs(done) {
      db.save([{name: 'Jon', age: 23}, 
               {name: 'Neil', age: 60},
               {name: 'Katie', age: 29}], function(err, users) {
        done(null, users[0], users.slice(1));
      });
    }

    function linkObjs(user1, users, done) {
      db.relate(user1, 'knows', users, function(err, links) {
        done(null, user1);
      });
    }

    function query(user, done) {
      var cypher = "start x = node(" + user.id + ") ";
      cypher    += "match x -[r]-> n ";
      cypher    += "return type(r), n.name, n.age ";
      cypher    += "order by n.name";
      db.query(cypher, function(err, result) {
        assert.ok(!err);
        assert.deepEqual([{
          'type(r)': 'knows',
          'n.name': 'Katie',
          'n.age': 29
        }, {
          'type(r)': 'knows',
          'n.name': 'Neil',
          'n.age': 60
        }], result);
        done();
      });
    }
  
    async.waterfall([createObjs, linkObjs, query], done);
  });

  it('should handle arrays in format string', function(done) {
    function createObjs(done) {
      db.save([{tool: 'glue'},
               {tool: 'laser'},
               {tool: 'toilet paper'}],
              function(err, tools) {
                var toolIds = tools.map(function(t) { return t.id; });
                done(null, toolIds.slice(0, 2), toolIds[2])
              });
    }
    
    function linkObjs(tools, tp, done) {
      db.relate(tools, 'ruins', tp, function(err, links) {
        done(null, tools);
      });
    }

    function query(tools, done) {
      var cypher = "start x = node(" + tools + ") ";
      cypher    += "match x -[:ruins]-> y ";
      cypher    += "return x.tool, y.tool ";
      cypher    += "order by x.tool";
      db.query(cypher, function(err, result) {
        assert.ok(!err);
        assert.deepEqual([{
          'x.tool': 'glue',
          'y.tool': 'toilet paper',
        }, {
          'x.tool': 'laser',
          'y.tool': 'toilet paper',
        }], result);
        done();
      });
    }
  
    async.waterfall([createObjs, linkObjs, query], done);
  });
  
  it('should recurse into collect() arrays on query', function(done) {
    function createObjs(done) {
      db.save([{name: 'Jon', age: 23}, 
               {name: 'Neil', age: 60},
               {name: 'Katie', age: 29}],
              function(err, users) {
                done(null, users[0], users.slice(1));
              });
    }
    
    function linkObjs(user1, users, done) {
      db.relate(user1, 'knows', users, function(err, links) {
        done(null, user1);
      });
    }
    
    function query(user, done) {
      var cypher = "start x = node(" + user.id + ") ";
      cypher    += "match x -[r]-> n ";
      cypher    += "return x, collect(n)";
      db.query(cypher, function(err, result) {
        assert.ok(!err);
        delete result[0]['x'].id;
        delete result[0]['collect(n)'][0].id;
        delete result[0]['collect(n)'][1].id;
        // "sort" collect list
        if (result[0]['collect(n)'][0].name === "Katie") {
          var t = result[0]['collect(n)'][0];
          result[0]['collect(n)'][0] = result[0]['collect(n)'][1];
          result[0]['collect(n)'][1] = t;
        }
        assert.deepEqual([{
          'x': { name: 'Jon', age: 23 },
          'collect(n)': [{ name: 'Neil', age: 60 },
                         { name: 'Katie', age: 29 }]
        }], result);
        done();
      });
    }
  
    async.waterfall([createObjs, linkObjs, query], done);
  });

  it("should not convert nested arrays to objects", function(done) {
    function createObjs(done) {
      db.save([{name: 'Jon', age: 23}, 
               {name: 'Neil', age: 60},
               {name: 'Katie', age: 29}], done);
    }
    
    function query(users, done) {
      var query = [
        "START nodes = node(" + _.pluck(users, 'id').join(',') + ")",
        "RETURN { names: collect(nodes.name) }"
      ].join(' ');
      db.query(query, function(err, result) {
        assert.ok(!err);
        assert.deepEqual(result, [{names:['Jon', 'Neil', 'Katie']}]);
        done();
      });
    }
  
    async.waterfall([createObjs, query], done);
  });
  
  it('should perform a cypher query and return whole objects', function(done) {
    function createObjs(done) {
      db.save([{name: 'Jon', age: 23}, 
               {name: 'Neil', age: 60},
               {name: 'Katie', age: 29}], function(err, users) {
        done(null, users[0], users.slice(1));
      });
    }

    function linkObjs(user1, users, done) {
      db.relate(user1, 'knows', users, function(err, links) {
        done(null, user1, users);
      });
    }

    function query(user, users, done) {
      var cypher = "start x = node(" + user.id + ") ";
      cypher    += "match x -[r]-> n ";
      cypher    += "return n ";
      cypher    += "order by n.name";
      db.query(cypher, function(err, result) {
        assert.ok(!err);
        assert.deepEqual([ users[1], users[0] ], result);
        done();
      });
    }
  
    async.waterfall([createObjs, linkObjs, query], done);
  });

  it('should perform a cypher query and parse nodes within literal map results', function(done) {
    function createObjs(done) {
      db.save([{name: 'Jon', age: 23}, 
               {name: 'Neil', age: 60},
               {name: 'Katie', age: 29}], function(err, users) {
        done(null, users[0], users.slice(1));
      });
    }

    function linkObjs(user1, users, done) {
      db.relate(user1, 'knows', users, function(err, links) {
        done(null, user1, users);
      });
    }

    function query(user, users, done) {
      var cypher = "start x = node(" + user.id + ") ";
      cypher    += "match x -[r]-> n ";
      cypher    += "return {data: n} as user ";
      cypher    += "order by user.data.name";
      db.query(cypher, function(err, result) {
        assert.ok(!err);
        assert.deepEqual([ {data: users[1]}, {data: users[0]} ], result);
        done();
      });
    }
  
    async.waterfall([createObjs, linkObjs, query], done);
  });

  it('should perform a cypher query and return rels', function(done) {
    function createObjs(done) {
      db.save([{name: 'Jon', age: 23}, 
               {name: 'Neil', age: 60},
               {name: 'Katie', age: 29}], function(err, users) {
        done(null, users[0], users.slice(1));
      });
    }

    function linkObjs(user1, users, done) {
      db.relate(user1, 'knows', users, function(err, links) {
        done(null, user1, users, links);
      });
    }

    function query(user, users, links, done) {
      var cypher = "start x = node(" + user.id + ") ";
      cypher    += "match x -[r]-> n ";
      cypher    += "return r ";
      cypher    += "order by n.name";
      db.query(cypher, function(err, result) {
        assert.ok(!err);
        assert.deepEqual([
          { start: user.id, 
            end: users[1].id, 
            type: 'knows', 
            properties: {},
            id: links[1].id },
          { start: user.id, 
            end: users[0].id, 
            type: 'knows', 
            properties: {},
            id: links[0].id }
        ], result);
        done();
      });
    }
  
    async.waterfall([createObjs, linkObjs, query], done);
  });

  it('should perform a cypher query w/o parsing the result', function(done) {
    function createObjs(done) {
      db.save([{name: 'Jon', age: 23}, 
               {name: 'Neil', age: 60},
               {name: 'Katie', age: 29}], function(err, users) {
        done(null, users[0], users.slice(1));
      });
    }

    function linkObjs(user1, users, done) {
      db.relate(user1, 'knows', users, function(err, links) {
        done(null, user1);
      });
    }

    function queryRaw(user, done) {
      var cypher = "start x = node(" + user.id + ") ";
      cypher    += "match x -[r]-> n ";
      cypher    += "return type(r), n.name, n.age ";
      cypher    += "order by n.name";
      db.queryRaw(cypher, function(err, result) {
        assert.ok(!err);
        assert.deepEqual({
          data: [['knows', 'Katie', 29], ['knows', 'Neil', 60]],
          columns: ['type(r)', 'n.name', 'n.age']
        }, result);
        done();
      });
    }

    async.waterfall([createObjs, linkObjs, queryRaw], done);
  });

  it('should handle optional entities', function(done) {
    function createObjs(done) {
      db.save({name: 'Jon', age: 23}, function(err, user) {
        done(null, user);
      });
    }

    function query(user, done) {
      var cypher = "start x = node(" + user.id + ") ";
      cypher    += "optional match x --> n ";
      cypher    += "return x, n ";
      db.query(cypher, function(err, result) {
        assert.ok(!err);
        assert.deepEqual([{x: user, n: null}], result);
        done();
      });
    }
  
    async.waterfall([createObjs, query], done);
  });
});

describe('seraph#find', function() {
  it('should find some items based on a predicate', function(done) {
    var uniqueKey = 'seraph_find_test' + uniqn();
    function createObjs(done) {
      var objs = [ {name: 'Jon', age: 23}, 
                   {name: 'Neil', age: 60},
                   {name: 'Katie', age: 29} ];
      for (var index in objs) {
        objs[index][uniqueKey] = true;
      }
      objs[3] = {name: 'Belinda', age: 26};
      objs[3][uniqueKey] = false;

      db.save(objs, function(err, users) {
        done();
      });
    }

    function findObjs(done) {
      var predicate = {};
      predicate[uniqueKey] = true;
      db.find(predicate, function(err, objs) {
        assert.ok(!err);
        assert.equal(objs.length, 3);
        var names = objs.map(function(o) { return o.name });
        assert.ok(names.indexOf('Jon') >= 0);
        assert.ok(names.indexOf('Neil') >= 0);
        assert.ok(names.indexOf('Katie') >= 0);
        assert.ok(names.indexOf('Belinda') === -1);
        done();
      });
    }

    async.series([createObjs, findObjs], done);
  })

  it('should find some items based on a label', function(done) {
    var uniqueLabel = uniqn();
    function createObjs(done) {
      var objs = [ {name: 'Jon', age: 23}, 
                   {name: 'Neil', age: 60},
                   {name: 'Katie', age: 29},
                   {name: 'Belinda', age: 26} ];

      db.save(objs, function(err, users) {
        assert(!err);
        db.label([users[1],users[3]], uniqueLabel, done);
      });
    }

    function findObjs(done) {
      var predicate = {};
      var label = uniqueLabel;
      db.find(predicate, label, function(err, objs) {
        assert.ok(!err);
        assert.equal(objs.length, 2);
        var names = objs.map(function(o) { return o.name });
        assert.ok(names.indexOf('Jon') === -1);
        assert.ok(names.indexOf('Neil') >= 0);
        assert.ok(names.indexOf('Katie') === -1);
        assert.ok(names.indexOf('Belinda') >= 0);
        done();
      });
    }

    async.series([createObjs, findObjs], done);
  })

  it('should find some items based on a label and predicates', function(done) {
    var uniqueLabel = uniqn();
    var uniqueKey = 'seraph_find_test' + uniqn();
    function createObjs(done) {
      var objs = [ {name: 'Jon', age: 23}, 
                   {name: 'Neil', age: 60},
                   {name: 'Katie', age: 29},
                   {name: 'Belinda', age: 26} ];
      for (var index in objs) {
        objs[index][uniqueKey] = true;
      }
      objs[3][uniqueKey] = false;

      db.save(objs, function(err, users) {
        assert(!err);
        db.label([users[1],users[3]], uniqueLabel, done);
      });
    }

    function findObjs(done) {
      var predicate = {};
      predicate[uniqueKey] = true;
      var label = uniqueLabel;
      db.find(predicate, label, function(err, objs) {
        assert.ok(!err);
        assert.equal(objs.length, 1);
        var names = objs.map(function(o) { return o.name });
        assert.ok(names.indexOf('Jon') === -1);
        assert.ok(names.indexOf('Neil') >= 0);
        assert.ok(names.indexOf('Katie') === -1);
        assert.ok(names.indexOf('Belinda') === -1);
        done();
      });
    }

    async.series([createObjs, findObjs], done);
  })

  it('should not break when labels contain abnormal characters', function(done) {
    var uniqueLabel = uniqn() + '-' + uniqn();
    var uniqueKey = 'seraph_find_test' + uniqn();
    function createObjs(done) {
      var objs = [ {name: 'Jon', age: 23}, 
                   {name: 'Neil', age: 60},
                   {name: 'Katie', age: 29},
                   {name: 'Belinda', age: 26} ];
      for (var index in objs) {
        objs[index][uniqueKey] = true;
      }
      objs[3][uniqueKey] = false;

      db.save(objs, function(err, users) {
        assert(!err);
        db.label([users[1],users[3]], uniqueLabel, done);
      });
    }

    function findObjs(done) {
      var predicate = {};
      predicate[uniqueKey] = true;
      var label = uniqueLabel;
      db.find(predicate, label, function(err, objs) {
        assert.ok(!err);
        assert.equal(objs.length, 1);
        var names = objs.map(function(o) { return o.name });
        assert.ok(names.indexOf('Jon') === -1);
        assert.ok(names.indexOf('Neil') >= 0);
        assert.ok(names.indexOf('Katie') === -1);
        assert.ok(names.indexOf('Belinda') === -1);
        done();
      });
    }

    async.series([createObjs, findObjs], done);
  });


  it('should find some items based on an array of predicates', function(done) {
    var uniqueKey = 'seraph_find_test' + uniqn();
    function createObjs(done) {
      var objs = [ {name: 'Jon', age: 23}, 
                   {name: 'Neil', age: 60},
                   {name: 'Katie', age: 29} ];
      for (var index in objs) {
        objs[index][uniqueKey] = true;
      }
      objs[3] = {name: 'Belinda', age: 26};
      objs[3][uniqueKey] = false;

      db.save(objs, function(err, users) {
        done();
      });
    }

    function findObjs(done) {
      var predicate = {};
      predicate[uniqueKey] = true;
      var predicate2 = {};
      predicate2[uniqueKey] = false;

      db.find([predicate, predicate2], true, function(err, objs) {
        assert.ok(!err);
        assert.equal(objs[0].length, 3);
        assert.equal(objs[1].length, 1);
        var names = objs[0].map(function(o) { return o.name });
        assert.ok(names.indexOf('Jon') >= 0);
        assert.ok(names.indexOf('Neil') >= 0);
        assert.ok(names.indexOf('Katie') >= 0);
        assert.ok(names.indexOf('Belinda') === -1);
        var names2 = objs[1].map(function(o) { return o.name });
        assert.ok(names2.indexOf('Belinda') >= 0);
        done();
      });
    }

    async.series([createObjs, findObjs], done);
  })
  it('should find some items based on an OR predicate', function(done) {
    var uniqueKey = 'seraph_find_test' + uniqn();
    function createObjs(done) {
      var objs = [ {name: 'Jon', age: 23}, 
                   {name: 'Neil', age: 60},
                   {name: 'Katie', age: 29} ];
      for (var index in objs) {
        objs[index][uniqueKey] = true;
      }
      objs[3] = {name: uniqueKey+'Belinda', age: 26};
      objs[3][uniqueKey] = false;

      db.save(objs, function(err, users) {
        done();
      });
    }

    function findObjs(done) {
      var predicate = {};
      predicate[uniqueKey] = true;
      predicate['name'] = uniqueKey+'Belinda';

      db.find(predicate, true, function(err, objs) {
        assert.ok(!err);
        assert.equal(objs.length, 4);
        var names = objs.map(function(o) { return o.name });
        assert.ok(names.indexOf('Jon') >= 0);
        assert.ok(names.indexOf('Neil') >= 0);
        assert.ok(names.indexOf('Katie') >= 0);
        assert.ok(names.indexOf(uniqueKey+'Belinda') >= 0);
        done();
      });
    }

    async.series([createObjs, findObjs], done);
  })

  it('should properly align count columns', function(done) {
    db.query("start n=node(*) return count(n) as totalNodes", function(e, res) {
      assert(!e);
      assert(Array.isArray(res));
      assert(res[0].totalNodes);
      done()
    });
  });
});
