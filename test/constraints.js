var db = require('./util/database').db();
var uniqn = require('./util/ponies').uniqn;

var assert = require('assert');
var async = require('async');

describe('seraph#constraints', function() {
  
  it('should list all constraints for a label', function(done) {
    var label = uniqn();
    db.constraints.uniqueness.create(label, 'name', function(err, constraint) {
      assert(!err);
      db.constraints.list(label, function(err, constraints) {
        assert(!err);
        assert.equal(constraints.length, 1);
        assert.equal(constraints[0].label, label);
        assert.equal(constraints[0].property_keys[0], 'name');
        done();
      });
    });
  });

  it('should list all constraints', function(done) {
    var label = uniqn();
    db.constraints.uniqueness.create(label, 'name', function(err, constraint) {
      assert(!err);
      db.constraints.list(function(err, constraints) {
        assert(!err);
        assert(constraints.length > 1);
        var found = false;
        constraints.forEach(function(constraint) {
          if (constraint.label == label) found = constraint;
        });
        assert(found);
        assert.equal(found.type, 'UNIQUENESS');
        assert.equal(found.property_keys[0], 'name');
        done();
      });
    });
  });
  
  describe('uniqueness constraints', function() {
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
          assert.equal(constraints.length, 1);
          assert.equal(constraints[0].label, label);
          assert.equal(constraints[0].type, 'UNIQUENESS');
          assert.equal(constraints[0].property_keys.length, 1);
          assert.equal(constraints[0].property_keys[0], 'name');
          done();
        });
      });
    });

    it('should not add the same constraint twice', function(done) {
      var label = uniqn();
      db.constraints.uniqueness.create(label, 'name', function(err, constraint) {
        assert(!err);
        db.constraints.uniqueness.create(label, 'name', function(err, constraint) {
          assert(err);
          assert(err.statusCode == 409);
          assert(!constraint);
          db.constraints.uniqueness.list(label, 'name', function(err, constraints) {
            assert(!err);
            assert(constraints.length == 1);
            done();
          });
        });
      });
    });

    it('should not complain about conflicting uniqueness constraints when using createIfNone', function(done) {
      var label = uniqn();
      db.constraints.uniqueness.createIfNone(label, 'name', function(err, constraint) {
        assert(!err);
        db.constraints.uniqueness.createIfNone(label, 'name', function(err, constraint) {
          assert(!err);
          assert.equal(constraint.label, label);
          assert.equal(constraint.property_keys[0], 'name');
          db.constraints.uniqueness.list(label, 'name', function(err, constraints) {
            assert(!err);
            assert(constraints.length == 1);
            done();
          });
        });
      });
    });

    it('should handle labels with no constraints', function(done) {
      var label = uniqn();
      db.constraints.uniqueness.list(label, function(err, constraints) {
        assert(!err);
        assert(constraints.length == 0);
        done();
      });
    });

    it('should retrieve a specific uniqueness constraint', function(done) {
      var label = uniqn();
      db.constraints.uniqueness.create(label, 'name', function(err, constraint) {
        assert(!err);
        db.constraints.uniqueness.create(label, 'age', function(err, constraint) {
          assert(!err);
          db.constraints.uniqueness.list(label, 'name', function(err, constraints) {
            assert(!err);
            assert.equal(constraints.length, 1);
            assert.equal(constraints[0].property_keys[0], 'name');
            done();
          });
        });
      });
    });

    it('should retrieve all uniqueness constraints', function(done) {
      var label = uniqn();
      db.constraints.uniqueness.create(label, 'name', function(err, constraint) {
        assert(!err);
        db.constraints.uniqueness.create(label, 'age', function(err, constraint) {
          assert(!err);
          db.constraints.uniqueness.list(label, function(err, constraints) {
            assert(!err);
            assert.equal(constraints.length, 2);
            done();
          });
        });
      });
    });

    it('should drop a uniqueness constraint', function(done) {
      var label = uniqn();
      db.constraints.uniqueness.create(label, 'name', function(err, constraint) {
        assert(!err);
        db.save({name:'jon'}, function(err, node) {
          assert(!err);
          db.label(node, label, function(err) {
            assert(!err);
            db.save({name:'jon'}, function(err, node) {
              assert(!err);
              db.label(node, label, function(err) {
                assert(err);
                db.constraints.uniqueness.drop(label, 'name', function(err) {
                  assert(!err);
                  db.label(node, label, function(err) {
                    assert(!err);
                    done();
                  });
                });
              });
            });
          });
        });
      });
    });
  });
});
