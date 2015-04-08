var db = require('./util/database').db();
var uniqn = require('./util/ponies').uniqn;

var assert = require('assert');
var async = require('async');

describe('seraph.legacyindex', function() {
  it('should create an index with inferred type', function(done) {
    db.legacyindex.create(uniqn(), function(err) {
      assert.ok(!err);
      done();
    });
  });

  it('should create an index with a config', function(done) {
    db.legacyindex.create(uniqn(), {
      type: 'fulltext',
      provider: 'lucene'
    }, function(err) {
      assert.ok(!err);
      done();
    });
  });

  it('should create an index for a relationship', function(done) {
    db.rel.legacyindex.create(uniqn(), function(err) {
      assert.ok(!err);
      done();
    });
  });

  it('should create in index with config and inferred type', function(done) {
    db.legacyindex.create(uniqn(), {
      type: 'fulltext',
      provider: 'lucene'
    }, function(err) {
      assert.ok(!err);
      done();
    });
  });

  it('should accept an array of indexes to create', function(done) {
    db.rel.legacyindex.create([uniqn(), uniqn(), uniqn()],
                        function(err) {
      assert.ok(!err);
      done();
    });
  });

  it('should be aliased on `seraph.node`', function(done) {
    db.node.legacyindex.create(uniqn(), function(err) {
      assert.ok(!err);
      done();
    })
  });

  it('should be aliased on `seraph.rel`', function(done) {
    db.rel.legacyindex.create(uniqn(), function(err) {
      assert.ok(!err);
      done();
    })
  });

  it('should add a ndoe to an index', function(done) {
    db.save({name: 'Jon'}, function(err, node) {
      db.node.legacyindex.add(uniqn(), node, 'test', 'sannelig', function(err) {
        assert.ok(!err);
        done();
      });
    });
  });
  
  it('should alias seraph.index.add as seraph.node.index', function(done) {
    db.save({name: 'Jon'}, function(err, node) {
      db.node.legacyindex(uniqn(), node, 'test', 'sannelig', function(err) {
        assert.ok(!err);
        done();
      });
    });
  });

  it('should read zero objects from an index as `false`', function(done) {
    var iname = uniqn();

    function createAndIndex(done) {
      db.save({ name: 'Helge' }, function(err, node) {
        db.node.legacyindex(iname, node, 'person', 'true', function(err) {
          done();
        });
      });
    }

    function readIndex(done) {
      db.legacyindex.read(iname, 'person', 'false', function(err, results) {
        assert.ok(!err);
        assert.equal(results, false);
        done();
      })
    }

    async.series([createAndIndex, readIndex], done);
  });

  it('should read a single object from an index', function(done) {
    var iname = uniqn();

    function createAndIndex(done) {
      db.save({ name: 'Helge' }, function(err, node) {
        db.node.legacyindex(iname, node, 'person', 'true', function(err) {
          done();
        });
      });
    }

    function readIndex(done) {
      db.legacyindex.read(iname, 'person', 'true', function(err, node) {
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
        db.node.legacyindex(iname, node, 'person', 'has a space', function(err) {
          done();
        });
      });
    }

    function readIndex(done) {
      db.legacyindex.read(iname, 'person', 'has a space', function(err, node) {
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
        db.node.legacyindex(iname, node, 'person', 'has a space', function(err) {
          done();
        });
      });
    }

    function readIndex(done) {
      db.legacyindex.read(iname, 'person', 'has a space', function(err, node) {
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
        db.node.legacyindex(iname, nodes, 'company', 'brik', function(err) {
          done();
        });
      });
    }

    function readIndex(done) {
      db.legacyindex.read(iname, 'company', 'brik', function(err, nodes) {
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
          db.rel.legacyindex(iname, rel, 'company', 'brik', function(err) {
            done(null, nodes);   
          });
        })
      });
    }

    function readIndex(nodes, done) {
      db.rel.legacyindex.read(iname, 'company', 'brik', function(err, rel) {
        assert.ok(!err);
        assert.equal(rel.start, nodes[0].id);
        assert.equal(rel.end, nodes[1].id);
        assert.equal(rel.type, 'knows');
        done();
      })
    }

    async.waterfall([createAndIndex, readIndex], done);
  });

  it('should readAsList zero objects from an index as `[]`', function(done) {
    var iname = uniqn();

    function createAndIndex(done) {
      db.save({ name: 'Helge' }, function(err, node) {
        db.node.legacyindex(iname, node, 'person', 'true', function(err) {
          done();
        });
      });
    }

    function readIndex(done) {
      db.legacyindex.readAsList(iname, 'person', 'false', function(err, results) {
        assert.ok(!err);
        assert.deepEqual(results, []);
        done();
      })
    }

    async.series([createAndIndex, readIndex], done);
  });

  it('should readAsList a single object from an index as a list', function(done) {
    var iname = uniqn();

    function createAndIndex(done) {
      db.save({ name: 'Helge' }, function(err, node) {
        db.node.legacyindex(iname, node, 'person', 'true', function(err) {
          done();
        });
      });
    }

    function readIndex(done) {
      db.legacyindex.readAsList(iname, 'person', 'true', function(err, results) {
        assert.ok(!err);
        assert.equal(results.length, 1);
        assert.equal(results[0].name, 'Helge');
        done();
      })
    }

    async.series([createAndIndex, readIndex], done);
  });

  it('should readAsList all values of a kv pair in an index', function(done) {
    var iname = uniqn();

    function createAndIndex(done) {
      db.save([{ name: 'Helge' }, { name: 'Erlend' }], function(err, nodes) {
        db.node.legacyindex(iname, nodes, 'company', 'brik', function(err) {
          done();
        });
      });
    }

    function readIndex(done) {
      db.legacyindex.readAsList(iname, 'company', 'brik', function(err, nodes) {
        assert.ok(!err);
        var names = nodes.map(function(node) { return node.name });
        assert.ok(names.indexOf("Helge") !== -1);
        assert.ok(names.indexOf("Erlend") !== -1);
        done();
      })
    }

    async.series([createAndIndex, readIndex], done);
  });

  it('should remove a node from an index', function(done) {
    var iname = uniqn();

    function createAndIndex(done) {
      db.save({ name: 'Helge' }, function(err, node) {
        db.node.legacyindex(iname, node, 'person', 'true', function(err) {
          done();
        });
      });
    }

    function readIndex(done) {
      db.legacyindex.read(iname, 'person', 'true', function(err, node) {
        assert.equal(node.name, "Helge");
        db.legacyindex.remove(iname, node, 'person', 'true', function(err) {
          assert.ok(!err)
          db.legacyindex.read(iname, 'person', 'true', function(err, nodes) {
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
        db.node.legacyindex(iname, node, 'person', 'true', function(err) {
          db.node.legacyindex(iname, node, 'person', 'false', function(err) {
            done();
          });
        });
      });
    }

    function readIndex(done) {
      db.legacyindex.read(iname, 'person', 'true', function(err, node) {
        assert.equal(node.name, "Helge");
        db.legacyindex.remove(iname, node, 'person', function(err) {
          assert.ok(!err)
          db.legacyindex.read(iname, 'person', 'true', function(err, nodes) {
            assert.ok(!err);
            assert.ok(!nodes);
            db.legacyindex.read(iname, 'person', 'false', function(err, nodes) {
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
        db.node.legacyindex(iname, node, 'person', 'true', function(err) {
          db.node.legacyindex(iname, node, 'otherkey', 'false', function(err) {
            done();
          });
        });
      });
    }

    function readIndex(done) {
      db.legacyindex.read(iname, 'person', 'true', function(err, node) {
        assert.equal(node.name, "Helge");
        db.legacyindex.remove(iname, node, function(err) {
          assert.ok(!err)
          db.legacyindex.read(iname, 'person', 'true', function(err, nodes) {
            assert.ok(!err);
            assert.ok(!nodes);
            db.legacyindex.read(iname, 'otherkey', 'false', function(err, nodes) {
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
        db.node.legacyindex(iname, node, 'person', 'true', function(err) {
          db.node.legacyindex(iname, node, 'otherkey', 'false', function(err) {
            done();
          });
        });
      });
    }

    function readIndex(done) {
      db.legacyindex.read(iname, 'person', 'true', function(err, node) {
        assert.equal(node.name, "Helge");
        db.legacyindex.delete(iname, function(err) {
          assert.ok(!err)
          db.legacyindex.read(iname, 'person', 'true', function(err, nodes) {
            assert.ok(err);
            assert.ok(!nodes);
            db.legacyindex.read(iname, 'otherkey', 'false', function(err, nodes) {
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

      db.legacyindex.getOrSaveUnique(node, index, 'name', 'johanna', 
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

      db.legacyindex.getOrSaveUnique(node, index, 'name', 'johanna', 
      function(err, originalNode) {
        assert(!err);
        db.legacyindex.getOrSaveUnique(node, index, 'name', 'johanna',
        function(err, newNode) {
          assert(!err);
          assert.equal(newNode.id, originalNode.id);
          db.legacyindex.read(index, 'name', 'johanna', function(err, node) {
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
        db.rel.legacyindex.getOrSaveUnique(node, 'sings', node2, index, 'name', 
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
        db.rel.legacyindex.getOrSaveUnique(node, 'sings', node2, props, index, 'name', 
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
        db.rel.legacyindex.getOrSaveUnique(node, 'sings', node2, index, 'name', 
          'johanna', function(err, rel) {
          assert(!err);
          db.rel.legacyindex.getOrSaveUnique(node, 'sung', node2, index, 'name',
            'johanna', function(err, newRel) {
            assert(!err);
            assert.deepEqual(newRel, rel);
            db.rel.legacyindex.read(index, 'name', 'johanna', function(err, irel) {
              assert.equal(rel.id, irel.id);
              done();
            });
          });
        });
      });
    });
    
    it('should create a unique node in save-or-fail mode', function(done) {
      var index = uniqn();
      var node = { name: 'Johanna' };

      db.legacyindex.saveUniqueOrFail(node, index, 'name', 'johanna', 
      function(err, node) {
        assert(!err);
        assert.equal(node.name, 'Johanna');
        assert(node.id);
        db.legacyindex.read(index, 'name', 'johanna', function(err, inode) {
          assert(!err);
          assert.equal(inode.id, node.id);
          done();
        });
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
        db.rel.legacyindex.saveUniqueOrFail(node, 'sings', node2, index, 'name', 
          'johanna', function(err, rel) {
          assert(!err);
          assert(rel.id);
          assert(rel.start);
          assert.equal(rel.start, node.id);
          assert(rel.end);
          assert.equal(rel.end, node2.id);
          assert.equal(rel.type, 'sings');
          db.rel.legacyindex.read(index, 'name', 'johanna', function(err, irel) {
            assert(!err);
            assert.deepEqual(irel, rel);
            done();
          });
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
        db.rel.legacyindex.saveUniqueOrFail(node, 'sings', node2, props, index, 'name', 
          'johanna', function(err, rel) {
          assert(!err);
          assert(rel.id);
          assert(rel.start);
          assert.equal(rel.start, node.id);
          assert(rel.end);
          assert.equal(rel.end, node2.id);
          assert.equal(rel.type, 'sings');
          assert.deepEqual(rel.properties, props);
          db.rel.legacyindex.read(index, 'name', 'johanna', function(err, irel) {
            assert(!err);
            assert.deepEqual(rel, irel);
            done();
          });
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
        db.rel.legacyindex.saveUniqueOrFail(node, 'sings', node2, index, 'name', 
          'johanna', function(err, rel) {
          assert(!err);
          db.rel.legacyindex.saveUniqueOrFail(node, 'sung', node2, index, 'name',
            'johanna', function(err, newRel) {
            assert(err);
            assert(err.statusCode == 409);
            assert(!newRel);
            db.rel.legacyindex.read(index, 'name', 'johanna', function(err, irel) {
              assert(!err);
              assert.deepEqual(irel, rel);
              done();
            });
          });
        });
      });
    });

    it('should fail in save-or-fail mode when re-writing a unique node', 
    function(done) {
      var index = uniqn();
      var node = { name: 'Johanna' };

      db.legacyindex.saveUniqueOrFail(node, index, 'name', 'johanna', 
      function(err, originalNode) {
        assert(!err);
        db.legacyindex.saveUniqueOrFail(node, index, 'name', 'johanna',
        function(err, newNode) {
          assert(err);
          assert(err.statusCode == 409);
          assert(!newNode);
          done()
        });
      });
    });


    it('alias should fail in save-or-fail mode when re-writing a unique rel', 
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
        db.rel.legacyindex.saveUniqueOrFail(node, 'sings', node2, index, 'name', 
          'johanna', function(err, rel) {
          assert(!err);
          db.rel.legacyindex.saveUniqueOrFail(node, 'sung', node2, index, 'name',
            'johanna', function(err, newRel) {
            assert(err);
            assert(err.statusCode == 409);
            assert(!newRel);
            db.rel.legacyindex.read(index, 'name', 'johanna', function(err, irel) {
              assert(!err);
              assert.deepEqual(rel, irel);
              done();
            });
          });
        });
      });
    });

    it('alias should fail in save-or-fail mode when re-writing a unique node', 
    function(done) {
      var index = uniqn();
      var node = { name: 'Johanna' };

      db.legacyindex.saveUniqueOrFail(node, index, 'name', 'johanna', 
      function(err, originalNode) {
        assert(!err);
        db.legacyindex.saveUniqueOrFail(node, index, 'name', 'johanna', function(err, newNode) {
          assert(err);
          assert(err.statusCode == 409);
          assert(!newNode);
          db.legacyindex.read(index, 'name', 'johanna', function(err, inode) {
            assert(!err);
            assert.deepEqual(inode, originalNode);
            done();
          });
        });
      });
    });

    it('alias should get original rel in get-or-save mode when saving', 
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
        db.rel.legacyindex.getOrSaveUnique(node, 'sings', node2, index, 'name', 
          'johanna', function(err, rel) {
          assert(!err);
          db.rel.legacyindex.getOrSaveUnique(node, 'sung', node2, index, 'name',
            'johanna', function(err, newRel) {
            assert(!err);
            assert.deepEqual(newRel, rel);
            done();
          });
        });
      });
    });

    it('alias should get an existing node instead of creating a new', 
    function(done) {
      var index = uniqn();
      var node = { name: 'Johanna' };

      db.legacyindex.getOrSaveUnique(node, index, 'name', 'johanna', 
      function(err, originalNode) {
        assert(!err);
        db.legacyindex.getOrSaveUnique(node, index, 'name', 'johanna', 
        function(err, newNode) {
          assert(!err);
          assert.equal(newNode.id, originalNode.id);
          db.legacyindex.read(index, 'name', 'johanna', function(err, node) {
            assert(!err);
            assert(node);
            assert.equal(node.id, originalNode.id);
            assert.equal(node.name, 'Johanna');
            done();
          });
        });
      });
    });
  });

});
