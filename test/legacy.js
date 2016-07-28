var db = require('./util/database').db();
var uniqn = require('./util/ponies').uniqn;

var assert = require('assert');
var async = require('async');
describe('legacy tests', function() {
  describe('batching', function() {
    it('should throw an error if attempting to save nodes with a label in batch mode', function(done) {
      var label = uniqn();
      var txn = db.batch();
      txn.save({name:'Jon'}, label);
      txn.commit(function(err, res) {
        assert(err);
        done();
      });
    });
  })
  describe('queryRaw', function() {
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
        cypher    += "match (x) -[r]-> (n) ";
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

  })

  describe('batching', function() {
    it('should index a node in a batch', function(done) {
      var iname = uniqn();
      db.save({person:'indexable'}, function(err, user) {
        db.batch(function(db) {
          db.legacyindex(iname, user, 'something', 'magical');
        }, function(err, results) {
          assert(!err);
          db.legacyindex.read(iname, 'something', 'magical', function(err, node) {
            assert(!err);
            assert(node.person == 'indexable');
            done();
          });
        });
      });
    });


    it('should support indexing', function(done) {
      var txn = db.batch();
      var idx = uniqn();

      var person = txn.save({name:'Jon'});
      txn.legacyindex(idx, person, 'thing', 'stuff');

      txn.commit(function(err, results) {
        assert(!err);
        db.legacyindex.read(idx, 'thing', 'stuff', function(err, person1) {
          assert(!err);
          assert.deepEqual(person1, results[person]);
          done();
        });
      });
    });
    it('should support indexing and index.readAsList', function(done) {
      var txn = db.batch();
      var idx = uniqn();

      var person = txn.save({name:'Jon'});
      txn.legacyindex(idx, person, 'thing', 'stuff');

      txn.commit(function(err, txnResults) {
        assert(!err);
        db.legacyindex.readAsList(idx, 'thing', 'stuff', function(err, readResults) {
          assert(!err);
          assert.equal(readResults.length, 1);
          assert.deepEqual(readResults[0], txnResults[person]);
          done();
        });
      });
    });

  });
});
