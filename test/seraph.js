/**
 *
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
    seraph.call._request = mock;
  };
  afterEach(function() {
    seraph.call._request = originalRequest;
  });
  
  it('should infer GET request if no data or method supplied', function() {
    var opts = { endpoint: '' };
    setupMock(function(opts, callback) {
      assert.ok(typeof callback === 'function');
      assert.equal(opts.method, 'GET');
    });
    seraph.call(opts, '');
  });

  it('should infer POST request if data supplied', function() {
    var opts = { endpoint: '' };
    var testObject = {
      foo: 'foo',
      bar: 10
    };
    setupMock(function(opts, callback) {
      assert.ok(typeof callback === 'function');
      assert.equal(opts.method, 'POST');
      assert.deepEqual(opts.json, testObject);
    });
    seraph.call(opts, '', testObject);
  });
});

/* Not ready for testing yet 
describe('CRUD Operations', function() {
  //TODO - split this out into each of the functions...
  it('perform a full crud cycle correctly', function(done) {
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
          assert.equal(user.name, 'Belinda');
          assert.equal(user.age, 26);
          done(null, user);
        });
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

    async.waterfall([create, read, update, del], done);
  });
});
*/
