var db = require('./util/database').db();
var uniqn = require('./util/ponies').uniqn;

var assert = require('assert');
var async = require('async');

describe('seraph#index', function() {
  it('should create an index on a key', function(done) {
    var labelname = uniqn();
    db.index.create(labelname, 'name', function(err, index) {
      assert(!err);
      assert.equal(index.label, labelname);
      assert.equal(index.property_keys.length, 1);
      assert.equal(index.property_keys[0], 'name');
      done();
    });
  });

  it('should create an index and not return an error if it exists', function(done) {
    var labelname = uniqn();
    db.index.createIfNone(labelname, 'name', function(err, index) {
      assert(!err);
      assert.equal(index.label, labelname);
      assert.equal(index.property_keys.length, 1);
      assert.equal(index.property_keys[0], 'name');
      db.index.createIfNone(labelname, 'name', function(err, index) {
        assert(!err);
        assert.equal(index.label, labelname);
        assert.equal(index.property_keys.length, 1);
        assert.equal(index.property_keys[0], 'name');
        done();
      });
    });
  });

  it('should list indexes for a label', function(done) {
    var labelname = uniqn();
    db.index.create(labelname, 'name', function(err, index) {
      assert(!err);
      db.index.list(labelname, function(err, indexes) {
        assert(!err);
        assert.equal(indexes.length, 1);
        assert.equal(indexes[0].label, labelname);
        assert.equal(indexes[0].property_keys.length, 1);
        assert.equal(indexes[0].property_keys[0], 'name');
        done();
      });
    });
  });

  it('should drop an index', function(done) {
    var labelname = uniqn();
    db.index.create(labelname, 'name', function(err, index) {
      assert(!err);
      db.index.drop(labelname, 'name', function(err) {
        assert(!err);
        db.index.list(labelname, function(err, indexes) {
          assert(!err);
          assert(indexes.length == 0);
          done();
        });
      });
    });
  });
});
