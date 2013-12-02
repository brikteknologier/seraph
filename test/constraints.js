var testDatabase = require('./util/database');
var db = require('../')(testDatabase.url);
var uniqn = require('./util/ponies').uniqn;

var assert = require('assert');
var async = require('async');

describe('seraph#constraints', function() {
  it('should be able to add a uniqueness constraint', function(done) {
    var label = uniqn();
    db.constraints.uniqueness.create(label, 'name', function(err, constraint) {
      assert(!err);
      assert.equal(constraint.label, label);
      assert.equal(constraint.type, 'UNIQUENESS');
      assert.equal(constraint.property_keys.length, 1);
      assert.equal(constraint.property_keys[0], 'name');
      done();
    });
  });

  it('should make effective uniqueness constraints', function(done) {
    var label = uniqn();
    db.constraints.uniqueness.create(label, 'name', function(err) {
      assert(!err);
      db.save({name:'jon'}, function(err, node) {
        assert(!err);
        db.label(node, label, function(err) {
          assert(!err);
          db.save({name:'jon'}, function(err, node) {
            assert(!err);
            db.label(node, label, function(err) {
              assert(err);
              assert(err.neo4jCause.exception == 'ConstraintViolationException');
              done();
            });
          });
        });
      });
    });
  });

  it('should retrieve a uniqueness constraint', function(done) {
    var label = uniqn();
    db.constraints.uniqueness.create(label, 'name', function(err, constraint) {
      assert(!err);
      db.constraints.uniqueness.list(label, 'name', function(err, constraints) {
        assert(!err);
        assert.equal(constraints.length, 0);
        assert.equal(constraints[0].label, label);
        assert.equal(constraints[0].type, 'UNIQUENESS');
        assert.equal(constraints[0].property_keys.length, 1);
        assert.equal(constraints[0].property_keys[0], 'name');
        done();
      });
    });
  });
});
