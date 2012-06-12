/**
 * Goal: Seraph 1.0
 * 
 * x db.call(path, [method='get'], [data], callback);
 * x db.save(obj, [callback]);
 * x db.link(obj|id, linkname, other_obj|id, [props, [callback]]);
 * x db.query(query, [params], callback);
 * - db.find(predicate, [indexes], callback);
 * x db.delete(obj, [callback]);
 * x db.read(obj|id, callback);
 * db.links(obj|id, [name], [direction], callback);
 * x db.readLink(linkId, callback);
 * db.addIndex(obj|id, indexName, indexKey, indexValue, [callback])
 * db.readIndex(indexName, indexKey, [indexValue], callback)
 * db.indexes(obj|id, callback);
 * db.traversal(traversal, callback);
 *
 * **/

var seraph = require('../');
var db = seraph.db('http://localhost:7474');

var async = require('async');
var assert = require('assert');

describe('seraph#call', function() {
  var originalRequest = seraph.call._request;
  function setupMock(mock) {
    seraph._request = mock;
  };
  afterEach(function() {
    seraph._request = originalRequest;
  });
  
  it('should infer GET request if no data or method supplied', function(done) {
    var opts = { endpoint: '' };
    setupMock(function(opts, callback) {
      assert.ok(typeof callback === 'function');
      assert.equal(opts.method, 'GET');
      done();
    });
    seraph.call(opts, '');
  });

  it('should infer POST request if data supplied', function(done) {
    var opts = { endpoint: '' };
    var testObject = {
      foo: 'foo',
      bar: 10
    };
    setupMock(function(opts, callback) {
      assert.ok(typeof callback === 'function');
      assert.equal(opts.method, 'POST');
      assert.deepEqual(opts.json, testObject);
      done();
    });
    seraph.call(opts, '', testObject);
  });

  it('should add /db/data/ to url', function(done) {
    var opts = { endpoint: '' };
    var obj = {};
    setupMock(function(opts, callback) {
      assert.equal(opts.uri, '/db/data/');
      done();
    });
    seraph.call(opts, '', obj);
  });
});

describe('seraph#save, seraph#read', function() {
  it('should be able to create and object and read it back', function(done) {
    function create(done) {
      db.save({ name: 'Jon', age: 23 }, function(err, user) {
        assert.ok(!err);
        assert.ok(typeof user.id !== 'undefined');
        assert.equal(user.name, 'Jon');
        assert.equal(user.age, 23);

        done(null, user.id);
      });
    }

    function read(userId, done) {
      db.read(userId, function(err, user) {
        assert.ok(!err);
        assert.equal(user.name, 'Jon');
        assert.equal(user.age, 23);
        done(null, user);
      });
    }

    async.waterfall([create, read], done);
  });

  it('should take an array of objects to save/read', function(done) {
    function createObjs(done) {
      db.save([{name: 'Jon'}, {name: 'Helge'}], function(err, users) {
        assert.ok(!err);
        assert.equal(users[0].name, 'Jon');
        assert.equal(users[1].name, 'Helge');
        done(null, users[0], users[1]);
      });
    }

    function readObjs(user1, user2, done) {
      db.read([user1.id, user2.id], function(err, users) {
        assert.ok(!err);
        assert.equal(users[0].name, 'Jon');
        assert.equal(users[1].name, 'Helge');
        done();
      });
    }

    async.waterfall([createObjs, readObjs], done);
  });
})

describe('seraph#update', function() {
  it('should perform an update on an object', function(done) {
    function create(done) {
      db.save({ name: 'Jan', age: 55 }, function(err, user) {
        assert.ok(!err);
        assert.equal(user.name, 'Jan');
        assert.equal(user.age, 55);
        done(null, user);
      });
    }

    function update(user, done) {
      user.name = 'Belinda';
      user.age = 26;
      var userId = user.id;
      db.save(user, function(err, user) {
        assert.ok(!err);
        assert.equal(userId, user.id);
        assert.equal(user.name, 'Belinda');
        assert.equal(user.age, 26);
        db.read(userId, function(err, user) {
          assert.ok(!err);
          assert.equal(userId, user.id);
          assert.equal(user.name, 'Belinda');
          assert.equal(user.age, 26);
          done(null, user);
        });
      });
    }

    async.waterfall([create, update], done);
  });

  it('should take an array of objects to save/read', function(done) {
    function createObjs(done) {
      db.save([{name: 'Jon'}, {name: 'Helge'}], function(err, users) {
        assert.ok(!err);
        assert.equal(users[0].name, 'Jon');
        assert.equal(users[1].name, 'Helge');
        done(null, users[0], users[1]);
      });
    }

    function readObjs(user1, user2, done) {
      db.read([user1.id, user2.id], function(err, users) {
        assert.ok(!err);
        assert.equal(users[0].name, 'Jon');
        assert.equal(users[1].name, 'Helge');
        done(null, users[0], users[1]);
      });
    }

    function updateObjs(user1, user2, done) {
      user1.name = 'Bertin';
      user2.name = 'Erlend';
      db.save([user1, user2], function(err, users) {
        assert.ok(!err);
        assert.equal(users[0].name, 'Bertin');
        assert.equal(users[1].name, 'Erlend');
        done();
      });
    }

    async.waterfall([createObjs, readObjs, updateObjs], done);
  });
});

describe('seraph#delete', function() {
  it('should delete an object', function(done) {
    function create(done) {
      db.save({ name: 'Neil', age: 61 }, function(err, user) {
        assert.ok(!err);
        assert.equal(user.name, 'Neil');
        assert.equal(user.age, 61);
        done(null, user);
      });
    }

    function del(user, done) {
      db.delete(user, function(err) {
        assert.ok(!err);
        db.read(user, function(err) {
          assert.ok(!!err);
          done();
        });
      });
    }

    async.waterfall([create, del], done);
  });

  it('should take an array of objects to delete', function(done) {
    function createObjs(done) {
      db.save([{name: 'Jon'}, {name: 'Helge'}], function(err, users) {
        assert.ok(!err);
        assert.equal(users[0].name, 'Jon');
        assert.equal(users[1].name, 'Helge');
        done(null, users[0], users[1]);
      });
    }

    function readObjs(user1, user2, done) {
      db.read([user1.id, user2.id], function(err, users) {
        assert.ok(!err);
        assert.equal(users[0].name, 'Jon');
        assert.equal(users[1].name, 'Helge');
        done(null, users[0], users[1]);
      });
    }

    function delObjs(user1, user2, done) {
      db.delete([user1.id, user2.id], function(err) {
        assert.ok(!err);
        db.read([user1.id, user2.id], function(err) {
          assert.ok(!!err);
          done();
        });
      });
    }

    async.waterfall([createObjs, readObjs, delObjs], done);
  });
});

describe('seraph#link, seraph#readLink', function() {
  it('should link two objects together', function(done) {
    function createObjs(done) {
      db.save([{name: 'Jon'}, {name: 'Helge'}], function(err, users) {
        assert.ok(!err);
        assert.equal(users[0].name, 'Jon');
        assert.equal(users[1].name, 'Helge');
        done(null, users[0], users[1]);
      });
    }

    function linkObjs(user1, user2, done) {
      db.link(user1, 'coworker', user2, function(err, link) {
        assert.ok(!err);
        assert.equal(link.start, user1.id);
        assert.equal(link.end, user2.id);
        assert.equal(link.type, 'coworker');
        assert.deepEqual(link.properties, {});
        assert.ok(link.id != null);
        done(null, link, user1, user2);
      });
    }

    function readLink(link, user1, user2, done) {
      var linkId = link.id;
      db.readLink(link.id, function(err, link) {
        assert.ok(!err);
        assert.equal(link.start, user1.id);
        assert.equal(link.end, user2.id);
        assert.equal(link.type, 'coworker');
        assert.deepEqual(link.properties, {});
        assert.equal(linkId, link.id);
        done(null);
      });
    }

    async.waterfall([createObjs, linkObjs, readLink], done);
  });
});

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
      db.link(user1, 'knows', users, function(err, links) {
        done(null, user1);
      });
    }

    function query(user, done) {
      var cypher = "start x = node(" + user.id + ") ";
      cypher    += "match x -[r]-> n ";
      cypher    += "return type(r), n.name?, n.age? ";
      cypher    += "order by n.name";
      db.query(cypher, function(err, result) {
        assert.ok(!err);
        assert.deepEqual([{
          'TYPE(r)': 'knows',
          'n.name': 'Katie',
          'n.age': 29
        }, {
          'TYPE(r)': 'knows',
          'n.name': 'Neil',
          'n.age': 60
        }], result);
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
      db.link(user1, 'knows', users, function(err, links) {
        done(null, user1);
      });
    }

    function queryRaw(user, done) {
      var cypher = "start x = node(" + user.id + ") ";
      cypher    += "match x -[r]-> n ";
      cypher    += "return type(r), n.name?, n.age? ";
      cypher    += "order by n.name";
      db.queryRaw(cypher, function(err, result) {
        assert.ok(!err);
        assert.deepEqual({
          data: [['knows', 'Katie', 29], ['knows', 'Neil', 60]],
          columns: ['TYPE(r)', 'n.name', 'n.age']
        }, result);
        done();
      });
    }

    async.waterfall([createObjs, linkObjs, queryRaw], done);
  });
});

describe('seraph#find', function() {
  it('should find some items based on a predicate', function(done) {
    var uniqueKey = Date.now() + ''; 
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
});
