var db = require('./util/database').db();
var uniqn = require('./util/ponies').uniqn;
var _ = require('underscore');
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

  it('should apply multiple labels to a node', function(done) {
    var label = uniqn(), label2 = uniqn();
    db.save({ name: 'Jon' }, function(err, node) {
      assert(!err);
      assert(node.id);
      db.label(node, [label, label2], function(err) {
        assert(!err, err);
        db.nodesWithLabel(label, function(err, results) {
          assert(!err, err);
          assert.deepEqual(results[0], node);
          db.nodesWithLabel(label2, function(err, results) {
            assert(!err, err);
            assert.deepEqual(results[0], node);
            done();
          });
        });
      });
    });   
  });

  it('should apply multiple labels to a node as a part of `save`', function(done) {
    var label = uniqn(), label2 = uniqn();
    db.save({ name: 'Jon' }, [label, label2],function(err, node) {
      assert(!err);
      assert(node.id);
      db.nodesWithLabel(label, function(err, results) {
        assert(!err, err);
        assert.deepEqual(results[0], node);
        db.nodesWithLabel(label2, function(err, results) {
          assert(!err, err);
          assert.deepEqual(results[0], node);
          done();
        });
      });
    });   
  });

  it('should replace labels on a node', function(done) {
    var label = uniqn(), label1 = uniqn(), label2 = uniqn();
    db.save({ name: 'Jon' }, function(err, node) {
      assert(!err);
      assert(node.id);
      db.label(node, label, function(err) {
        assert(!err);
        db.label(node, [label1, label2], true, function(err) {
          assert(!err);
          db.nodesWithLabel(label2, function(err, results) {
            assert(!err);
            assert.deepEqual(results[0], node);
            db.nodesWithLabel(label, function(err, results) {
              assert(!err);
              assert(results.length == 0);
              done();
            });
          });
        });
      });
    });   
  });

  it('should read all labels for a node', function(done) {
    var label = uniqn(), label1 = uniqn(), label2 = uniqn();
    db.save({ name: 'Jon' }, function(err, node) {
      assert(!err);
      assert(node.id);
      db.label(node, [label,label1,label2], function(err) {
        assert(!err);
        db.readLabels(node, function(err, labels) {
          assert(!err);
          assert(Array.isArray(labels));
          assert(~labels.indexOf(label));
          assert(~labels.indexOf(label1));
          assert(~labels.indexOf(label2));
          done();
        });
      });
    });
  });

  it('should read all labels for some nodes', function(done) {
    var label = uniqn(), label1 = uniqn(), label2 = uniqn();
    async.auto({
      nodes: function(cb) {
        async.parallel({
          neil: db.save.bind(db, {name:'Neil'}),
          jon: db.save.bind(db, {name:'Jon'})
        }, cb);
      },
      labels: ['nodes', function(cb, d) {
        async.parallel([
          db.label.bind(db, [d.nodes.neil, d.nodes.jon], label1),
          db.label.bind(db, d.nodes.neil, label),
          db.label.bind(db, d.nodes.jon, label2)
        ], cb);
      }],
      all: ['labels', function(cb, d) {
        db.readLabels([d.nodes.neil, d.nodes.jon], cb);
      }]
    }, function(err, result) {
      assert(!err);
      var labels = result.all;
      assert(labels.length == 3);
      assert(~labels.indexOf(label));
      assert(~labels.indexOf(label1));
      assert(~labels.indexOf(label2));
      done();
    });
  });

  it('should read all labels', function(done) {
    //can hardly test this one very well...
    db.readLabels(function(err, result) { 
      assert(!err);
      // assume we've made this many by now from the previous tests.
      assert(result.length > 6);
      assert.equal(_.uniq(result).length, result.length);
      done();
    });
  });

  it('should delete a label from a node', function(done) {
    var label = uniqn();
    db.save({ name: 'Jon' }, function(err, node) {
      assert(!err);
      assert(node.id);
      db.label(node, label, function(err) {
        assert(!err, err);
        db.removeLabel(node, label, function(err) {
          assert(!err);
          db.nodesWithLabel(label, function(err, results) {
            assert(!err);
            assert(results.length == 0);
            done();
          });
        });
      });
    });   
  });

  it('should delete a label from some nodes', function(done) {
    var label = uniqn();
    db.save([{ name: 'Jon' }, {name: 'Bob'}], function(err, nodes) {
      assert(!err);
      db.label(nodes, label, function(err) {
        assert(!err, err);
        db.removeLabel(nodes, label, function(err) {
          assert(!err);
          db.nodesWithLabel(label, function(err, results) {
            assert(!err);
            assert(results.length == 0);
            done();
          });
        });
      });
    });   
  });
});
