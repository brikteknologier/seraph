/**
 * Goal: Seraph 1.0
 * 
 * db.call(path, [method='get'], [data], callback);
 * db.save(obj, [callback]);
 * db.link(obj|id, linkname, other_obj|id, [props, [callback]]);
 * db.query(query, [params], callback);
 * db.find(predicate, [indexes], callback);
 * db.delete(obj, [callback]);
 * db.read(obj|id, callback);
 * db.links(obj|id, [name], [direction], callback);
 * db.readLink(linkId, callback);
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

describe('CRUD Operations', function() {
  //TODO - split this out into each of the functions...
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

  it('should batch CRUD operations', function(done) {
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
        });
      });
    }

    async.waterfall([createObjs, readObjs, delObjs], done);
  });

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
        assert.ok(link.id);
        done(null, link);
      });
    }

    function readLink(link, done) {
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
