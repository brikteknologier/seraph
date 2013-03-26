/* -*- Mode: Javascript; js-indent-level: 2 -*- */

var testDatabase = require('./util/database');
var db = require('../')(testDatabase.url);
var uniqn = require('./util/ponies').uniqn;

var assert = require('assert');
var async = require('async');

describe('seraph#batch', function() {
  it('should perform a series of operations as expected', function(done) {
    function createObjs(done) {
      db.save([{name: 'Jon', age: 23}, 
               {name: 'Neil', age: 60},
               {name: 'Katie', age: 29}], function(err, users) {
        done(null, users);
      });
    }

    function readBatch(users, callback) {
      var ids = [];
      db.batch(function(db) {
        ids.push(db.read(users[0]));
        ids.push(db.read(users[1]));
        ids.push(db.read(users[2]));
      }, function(err, results) {
        assert.deepEqual(results, users);
        callback();
      })
    }

    async.waterfall([createObjs, readBatch], done);
  });

  it('should perform a series of saves in a batch', function(done) {
    db.batch(function(db) {
      db.save({ newPerson: 'bob' });
      db.save([ {newPerson: 'orange'}, {newPerson: 'cat'} ]);
    }, function(err, result) {
      assert.equal(result[0].newPerson, 'bob');
      assert.equal(result[1][0].newPerson, 'orange');
      assert.equal(result[1][1].newPerson, 'cat');
      assert(result[0].id);
      assert(result[1][0].id);
      done();
    });
  });

  it('should perform an update in a batch', function(done) {
    db.save({name:'Jon', age: 23}, function(err, user) {
      db.batch(function(db) {
        user.name = 'Jellybean';
        db.save(user);
      }, function(err, result) {
        db.read(user, function(err, user) {
          assert(user.name == 'Jellybean');
          done();
        });
      });
    });
  });

  it('should relate two nodes in a batch', function(done) {
    db.save([{person:'First'},{person:'Second'}], function(err, users) {
      db.batch(function(db) {
        db.relate(users[0], 'knows', users[1], {testprop:'test'});
      }, function(err, result) {
        db.relationships(users[0], function(err, rels) {
          assert(rels.length == 1);
          assert(rels[0].start == users[0].id);
          assert(rels[0].end == users[1].id);
          assert(rels[0].properties.testprop == 'test');
          assert(rels[0].type == 'knows');
          done();
        });
      });
    });
  });

  it('should index a node in a batch', function(done) {
    var iname = uniqn();
    db.save({person:'indexable'}, function(err, user) {
      db.batch(function(db) {
        db.index(iname, user, 'something', 'magical');
      }, function(err, results) {
        assert(!err);
        db.index.read(iname, 'something', 'magical', function(err, node) {
          assert(!err);
          assert(node.person == 'indexable');
          done();
        });
      });
    });
  });

  it('should not go completely insane when nesting batches', function(done) {
    db.batch(function(db) {
      db.save({person:"person-1"});
      db.batch(function(db) {
        db.save({person:"person-2"});
      })
      db.save({person:"person-3"});
    }, function(err, result) {
      assert(result[0].id);
      assert(result[0].person == 'person-1');
      assert(result[1][0].id);
      assert(result[1][0].person == 'person-2');   
      done();
    });
  });
}); 
