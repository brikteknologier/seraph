/* -*- Mode: Javascript; js-indent-level: 2 -*- */

var testDatabase = require('./util/database');
var db = require('../')(testDatabase.url);

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
      done();
    });
  });
}); 