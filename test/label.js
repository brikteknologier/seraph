var testDatabase = require('./util/database');
var db = require('../')(testDatabase.url);
var uniqn = require('./util/ponies').uniqn;

var assert = require('assert');
var async = require('async');

describe('seraph#label', function() {
  it('should be able to add a label to a node', function(done) {
    var label = uniqn();
    db.save({ name: 'Jon' }, function(err, node) {
      assert(!err);
      assert(node.id);
      db.label(node, label, done);
    });   
  });

  it('should be able to read all nodes with a label', function(done) {
    var label = uniqn();
    db.save({ name: 'Jon' }, function(err, node) {
      assert(!err);
      assert(node.id);
      db.label(node, label, function(err) {
        assert(!err, err);
        db.nodesWithLabel(label, function(err, results) {
          assert(!err, err);
          assert.deepEqual(results[0], node);
          done();
        });
      });
    });   
  });
});
