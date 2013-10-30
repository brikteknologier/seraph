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

  it('should be able to read a node with a label', function(done) {
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

  it('should be able to label and read several nodes at once', function(done) {
    var label = uniqn();
    db.save([{ name: 'Jon' }, { name: 'Bob' }], function(err, nodes) {
      assert(!err);
      assert(nodes.length == 2);
      db.label(nodes, label, function(err) {
        assert(!err, err);
        db.nodesWithLabel(label, function(err, results) {
          assert(!err, err);
          assert(results.length == 2);
          results.forEach(function(result) {
            var foundNode = false;
            nodes.forEach(function(node) {
              if (node.id != result.id) return;
              foundNode = true;
              assert.deepEqual(node, result);
            });
            assert(foundNode);
          });
          done();
        });
      });
    });   
  });
});
