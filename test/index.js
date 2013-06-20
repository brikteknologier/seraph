/* -*- Mode: Javascript; js-indent-level: 2 -*- */

var testDatabase = require('./util/database');
var uniqn = require('./util/ponies').uniqn;
var db = require('../')(testDatabase.url);

var assert = require('assert');
var async = require('async');

describe('seraph.index', function() {
  it('should create an index with inferred type', function(done) {
    db.index.create(uniqn(), function(err) {
      assert.ok(!err);
      done();
    });
  });

  it('should create an index with a config', function(done) {
    db.index.create(uniqn(), {
      type: 'fulltext',
      provider: 'lucene'
    }, function(err) {
      assert.ok(!err);
      done();
    });
  });

  it('should create an index for a relationship', function(done) {
    db.rel.index.create(uniqn(), function(err) {
      assert.ok(!err);
      done();
    });
  });

  it('should create in index with config and inferred type', function(done) {
    db.index.create(uniqn(), {
      type: 'fulltext',
      provider: 'lucene'
    }, function(err) {
      assert.ok(!err);
      done();
    });
  });

  it('should accept an array of indexes to create', function(done) {
    db.rel.index.create([uniqn(), uniqn(), uniqn()],
                        function(err) {
      assert.ok(!err);
      done();
    });
  });

  it('should be aliased on `seraph.node`', function(done) {
    db.node.index.create(uniqn(), function(err) {
      assert.ok(!err);
      done();
    })
  });

  it('should be aliased on `seraph.rel`', function(done) {
    db.rel.index.create(uniqn(), function(err) {
      assert.ok(!err);
      done();
    })
  });

  it('should add a ndoe to an index', function(done) {
    db.save({name: 'Jon'}, function(err, node) {
      db.node.index.add(uniqn(), node, 'test', 'sannelig', function(err) {
        assert.ok(!err);
        done();
      });
    });
  });
  
  it('should alias seraph.index.add as seraph.node.index', function(done) {
    db.save({name: 'Jon'}, function(err, node) {
      db.node.index(uniqn(), node, 'test', 'sannelig', function(err) {
        assert.ok(!err);
        done();
      });
    });
  });

  it('should read a single object from an index', function(done) {
    var iname = uniqn();

    function createAndIndex(done) {
      db.save({ name: 'Helge' }, function(err, node) {
        db.node.index(iname, node, 'person', 'true', function(err) {
          done();   
        });
      });
    }

    function readIndex(done) {
      db.index.read(iname, 'person', 'true', function(err, node) {
        assert.ok(!err);
        assert.equal(node.name, 'Helge');
        done();
      })
    }

    async.series([createAndIndex, readIndex], done);
  });

  it('should read a single object from an index with a space', function(done) {
    var iname = uniqn();

    function createAndIndex(done) {
      db.save({ name: 'Helge' }, function(err, node) {
        db.node.index(iname, node, 'person', 'has a space', function(err) {
          done();   
        });
      });
    }

    function readIndex(done) {
      db.index.read(iname, 'person', 'has a space', function(err, node) {
        assert.ok(!err);
        assert.equal(node.name, 'Helge');
        done();
      })
    }

    async.series([createAndIndex, readIndex], done);
  });


  it('should read a single object from an index named with a space', function(done) {
    var iname = uniqn() + " with a space";

    function createAndIndex(done) {
      db.save({ name: 'Helge' }, function(err, node) {
        db.node.index(iname, node, 'person', 'has a space', function(err) {
          done();   
        });
      });
    }

    function readIndex(done) {
      db.index.read(iname, 'person', 'has a space', function(err, node) {
        assert.ok(!err);
        assert.equal(node.name, 'Helge');
        done();
      })
    }

    async.series([createAndIndex, readIndex], done);
  });

  it('should read all values of a kv pair in an index', function(done) {
    var iname = uniqn();

    function createAndIndex(done) {
      db.save([{ name: 'Helge' }, { name: 'Erlend' }], function(err, nodes) {
        db.node.index(iname, nodes, 'company', 'brik', function(err) {
          done();   
        });
      });
    }

    function readIndex(done) {
      db.index.read(iname, 'company', 'brik', function(err, nodes) {
        assert.ok(!err);
        var names = nodes.map(function(node) { return node.name });
        assert.ok(names.indexOf("Helge") !== -1);
        assert.ok(names.indexOf("Erlend") !== -1);
        done();
      })
    }

    async.series([createAndIndex, readIndex], done);
  });

  it('should read a kv pair as a relationship', function(done) {
    var iname = uniqn();

    function createAndIndex(done) {
      db.save([{ name: 'Helge' }, { name: 'Erlend' }], function(err, nodes) {
        db.relate(nodes[0], 'knows', nodes[1], function(err, rel) {
          db.rel.index(iname, rel, 'company', 'brik', function(err) {
            done(null, nodes);   
          });
        })
      });
    }

    function readIndex(nodes, done) {
      db.rel.index.read(iname, 'company', 'brik', function(err, rel) {
        assert.ok(!err);
        assert.equal(rel.start, nodes[0].id);
        assert.equal(rel.end, nodes[1].id);
        assert.equal(rel.type, 'knows');
        done();
      })
    }

    async.waterfall([createAndIndex, readIndex], done);
  });

  it('should remove a node from an index', function(done) {
    var iname = uniqn();

    function createAndIndex(done) {
      db.save({ name: 'Helge' }, function(err, node) {
        db.node.index(iname, node, 'person', 'true', function(err) {
          done();   
        });
      });
    }

    function readIndex(done) {
      db.index.read(iname, 'person', 'true', function(err, node) {
        assert.equal(node.name, "Helge");
        db.index.remove(iname, node, 'person', 'true', function(err) {
          assert.ok(!err)
          db.index.read(iname, 'person', 'true', function(err, nodes) {
            assert.ok(!err);
            assert.ok(!nodes);
            done();
          });
        });
      })
    }

    async.series([createAndIndex, readIndex], done);
  });

  it('should remove all instances of a node from an index for a key', function(done) {
    var iname = uniqn();

    function createAndIndex(done) {
      db.save({ name: 'Helge' }, function(err, node) {
        db.node.index(iname, node, 'person', 'true', function(err) {
          db.node.index(iname, node, 'person', 'false', function(err) {
            done();   
          });
        });
      });
    }

    function readIndex(done) {
      db.index.read(iname, 'person', 'true', function(err, node) {
        assert.equal(node.name, "Helge");
        db.index.remove(iname, node, 'person', function(err) {
          assert.ok(!err)
          db.index.read(iname, 'person', 'true', function(err, nodes) {
            assert.ok(!err);
            assert.ok(!nodes);
            db.index.read(iname, 'person', 'false', function(err, nodes) {
              assert.ok(!err);
              assert.ok(!nodes);
              done();
            });
          });
        });
      })
    }

    async.series([createAndIndex, readIndex], done);
  });

  it('should remove all instances of a node from an index', function(done) {
    var iname = uniqn();

    function createAndIndex(done) {
      db.save({ name: 'Helge' }, function(err, node) {
        db.node.index(iname, node, 'person', 'true', function(err) {
          db.node.index(iname, node, 'otherkey', 'false', function(err) {
            done();   
          });
        });
      });
    }

    function readIndex(done) {
      db.index.read(iname, 'person', 'true', function(err, node) {
        assert.equal(node.name, "Helge");
        db.index.remove(iname, node, function(err) {
          assert.ok(!err)
          db.index.read(iname, 'person', 'true', function(err, nodes) {
            assert.ok(!err);
            assert.ok(!nodes);
            db.index.read(iname, 'otherkey', 'false', function(err, nodes) {
              assert.ok(!err);
              assert.ok(!nodes);
              done();
            });
          });
        });
      })
    }

    async.series([createAndIndex, readIndex], done);
  });

  it('should delete an index', function(done) {
    var iname = uniqn();

    function createAndIndex(done) {
      db.save({ name: 'Helge' }, function(err, node) {
        db.node.index(iname, node, 'person', 'true', function(err) {
          db.node.index(iname, node, 'otherkey', 'false', function(err) {
            done();   
          });
        });
      });
    }

    function readIndex(done) {
      db.index.read(iname, 'person', 'true', function(err, node) {
        assert.equal(node.name, "Helge");
        db.index.delete(iname, function(err) {
          assert.ok(!err)
          db.index.read(iname, 'person', 'true', function(err, nodes) {
            assert.ok(err);
            assert.ok(!nodes);
            db.index.read(iname, 'otherkey', 'false', function(err, nodes) {
              assert.ok(err);
              assert.ok(!nodes);
              done();
            });
          });
        });
      })
    }

    async.series([createAndIndex, readIndex], done);
  });

  describe('uniqueness', function() {
    it('should create a unique node', function(done) {
      var index = uniqn();
      var node = { name: 'Johanna' };

      db.index.getOrSaveUnique(node, index, 'name', 'johanna', 
      function(err, node) {
        assert(!err);
        assert.equal(node.name, 'Johanna');
        assert(node.id);
        done();
      });
    });

    it('should get an existing node instead of creating a new', function(done) {
      var index = uniqn();
      var node = { name: 'Johanna' };

      db.index.getOrSaveUnique(node, index, 'name', 'johanna', 
      function(err, originalNode) {
        assert(!err);
        db.index.getOrSaveUnique(node, index, 'name', 'johanna',
        function(err, newNode) {
          assert(!err);
          assert.equal(newNode.id, originalNode.id);
          db.index.read(index, 'name', 'johanna', function(err, node) {
            assert(!err);
            assert(node);
            assert.equal(node.id, originalNode.id);
            assert.equal(node.name, 'Johanna');
            done();
          });
        });
      });
    });
    
    it('should create a unique rel', function(done) {
      var index = uniqn();

      function setupNodes(cb) {
        var node = { name: 'Johanna' };
        var node2 = { name: 'Sun sarkyä anna mä en' };
        db.save([node, node2], function(err,nodes) {
          assert(!err);
          cb(nodes[0], nodes[1]);
        });
      }

      setupNodes(function(node, node2) {
        db.rel.index.getOrSaveUnique(node, 'sings', node2, index, 'name', 
          'johanna', function(err, rel) {
          assert(!err);
          assert(rel.id);
          assert(rel.start);
          assert.equal(rel.start, node.id);
          assert(rel.end);
          assert.equal(rel.end, node2.id);
          assert.equal(rel.type, 'sings');
          done();
        });
      });
    });

    it('should create a unique rel with properties', function(done) {
      var index = uniqn();

      function setupNodes(cb) {
        var node = { name: 'Johanna' };
        var node2 = { name: 'Sun sarkyä anna mä en' };
        db.save([node, node2], function(err,nodes) {
          assert(!err);
          cb(nodes[0], nodes[1]);
        });
      }

      var props = { original: true };

      setupNodes(function(node, node2) {
        db.rel.index.getOrSaveUnique(node, 'sings', node2, props, index, 'name', 
          'johanna', function(err, rel) {
          assert(!err);
          assert(rel.id);
          assert(rel.start);
          assert.equal(rel.start, node.id);
          assert(rel.end);
          assert.equal(rel.end, node2.id);
          assert.equal(rel.type, 'sings');
          assert.deepEqual(rel.properties, props);
          done();
        });
      });
    });

    it('should get original rel in get-or-save mode when saving', 
    function(done) {
      var index = uniqn();

      function setupNodes(cb) {
        var node = { name: 'Johanna' };
        var node2 = { name: 'Sun sarkyä anna mä en' };
        db.save([node, node2], function(err,nodes) {
          assert(!err);
          cb(nodes[0], nodes[1]);
        });
      }

      setupNodes(function(node, node2) {
        db.rel.index.getOrSaveUnique(node, 'sings', node2, index, 'name', 
          'johanna', function(err, rel) {
          assert(!err);
          db.rel.index.getOrSaveUnique(node, 'sung', node2, index, 'name',
            'johanna', function(err, newRel) {
            assert(!err);
            assert.deepEqual(newRel, rel);
            done();
          });
        });
      });
    });
    
    it('should create a unique node in save-or-fail mode', function(done) {
      var index = uniqn();
      var node = { name: 'Johanna' };

      db.index.saveUniqueOrFail(node, index, 'name', 'johanna', 
      function(err, node) {
        assert(!err);
        assert.equal(node.name, 'Johanna');
        assert(node.id);
        done();
      });
    });

    it('should create a unique rel in save-or-fail mode', function(done) {
      var index = uniqn();

      function setupNodes(cb) {
        var node = { name: 'Johanna' };
        var node2 = { name: 'Sun sarkyä anna mä en' };
        db.save([node, node2], function(err,nodes) {
          assert(!err);
          cb(nodes[0], nodes[1]);
        });
      }

      setupNodes(function(node, node2) {
        db.rel.index.saveUniqueOrFail(node, 'sings', node2, index, 'name', 
          'johanna', function(err, rel) {
          assert(!err);
          assert(rel.id);
          assert(rel.start);
          assert.equal(rel.start, node.id);
          assert(rel.end);
          assert.equal(rel.end, node2.id);
          assert.equal(rel.type, 'sings');
          done();
        });
      });
    });

    it('should create a unique rel with properties in save-or-fail mode', 
    function(done) {
      var index = uniqn();

      function setupNodes(cb) {
        var node = { name: 'Johanna' };
        var node2 = { name: 'Sun sarkyä anna mä en' };
        db.save([node, node2], function(err,nodes) {
          assert(!err);
          cb(nodes[0], nodes[1]);
        });
      }

      var props = { original: true };

      setupNodes(function(node, node2) {
        db.rel.index.saveUniqueOrFail(node, 'sings', node2, props, index, 'name', 
          'johanna', function(err, rel) {
          assert(!err);
          assert(rel.id);
          assert(rel.start);
          assert.equal(rel.start, node.id);
          assert(rel.end);
          assert.equal(rel.end, node2.id);
          assert.equal(rel.type, 'sings');
          assert.deepEqual(rel.properties, props);
          done();
        });
      });
    });

    it('should fail in save-or-fail mode when re-writing a unique rel', 
    function(done) {
      var index = uniqn();

      function setupNodes(cb) {
        var node = { name: 'Johanna' };
        var node2 = { name: 'Sun sarkyä anna mä en' };
        db.save([node, node2], function(err,nodes) {
          assert(!err);
          cb(nodes[0], nodes[1]);
        });
      }

      setupNodes(function(node, node2) {
        db.rel.index.saveUniqueOrFail(node, 'sings', node2, index, 'name', 
          'johanna', function(err, rel) {
          assert(!err);
          db.rel.index.saveUniqueOrFail(node, 'sung', node2, index, 'name',
            'johanna', function(err, newRel) {
            assert(err);
            assert(err.statusCode == 419);
            assert(!newRel);
            done();
          });
        });
      });
    });

    it('should fail in save-or-fail mode when re-writing a unique node', 
    function(done) {
      var index = uniqn();
      var node = { name: 'Johanna' };

      db.index.saveUniqueOrFail(node, index, 'name', 'johanna', 
      function(err, originalNode) {
        assert(!err);
        db.index.saveUniqueOrFail(node, index, 'name', 'johanna',
        function(err, newNode) {
          assert(!err);
          assert.equal(newNode.id, originalNode.id);
          db.index.read(index, 'name', 'johanna', function(err, node) {
            assert(err);
            assert(err.statusCode == 419);
            assert(!node);
            done();
          });
        });
      });
    });
  });

});
