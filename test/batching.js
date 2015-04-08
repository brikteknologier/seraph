var db = require('./util/database').db();
var uniqn = require('./util/ponies').uniqn;

var assert = require('assert');
var async = require('async');

describe('seraph#batch', function() {
  it('should properly indicate if the current context is a batch', function() {
    assert(!db.isBatch);
    var b = db.batch();
    assert(b.isBatch);
  });

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
        db.legacyindex(iname, user, 'something', 'magical');
      }, function(err, results) {
        assert(!err);
        db.legacyindex.read(iname, 'something', 'magical', function(err, node) {
          assert(!err);
          assert(node.person == 'indexable');
          done();
        });
      });
    });
  });

  it('should work in procedural mode', function(done) {
    var txn = db.batch();

    var bob = txn.save({name:'Bob'});
    var tim = txn.save([{name:'Tim'}, {name:'Jan'}]);

    txn.commit(function(err, results) {
      assert(!err);
      assert(results[bob].name == 'Bob');
      assert(results[bob].id);
      assert(results[tim][0].name == 'Tim');
      assert(results[tim][0].id);
      assert(results[tim][1].name == 'Jan');
      assert(results[tim][1].id);
      done();
    });
  });

  it('should return sensible values corresponding to the result', function() {
    var txn = db.batch();

    var bob = txn.save({name:'Bob'});
    var tim = txn.save([{name:'Tim'}, {name:'Jan'}]);

    assert(bob >= 0);
    assert(tim >= 0);
    assert(!Array.isArray(tim));
  });

  it('should handle group saves and return sane refs', function(done) {
    var txn = db.batch();

    var bob = txn.save({name:'Bob'});
    var tim = txn.save([{name:'Tim'}, {name:'Jan'}]);
    var thing = txn.save({stuff:'Things'});

    txn.commit(function(err, results) {
      assert(!err);
      assert(results[bob].name == 'Bob');
      assert(results[tim][0].name == 'Tim');
      assert(results[tim][1].name == 'Jan');
      assert(results[thing].stuff == 'Things');
      done();
    });
  });

  it('should allow callbacks in procedural mode', function(done) {
    var txn = db.batch();

    var call1 = false;
    var call2 = false;
    
    txn.save({name: 'Tim'}, function(err, person) {
      assert(!err);
      assert(person.name == 'Tim');
      assert(person.id);
      call1 = true;
    });

    txn.save({name: 'Bob'}, function(err, person) {
      assert(!err);
      assert(person.name == 'Bob');
      assert(person.id);
      call2 = true;
    });

    txn.commit(function(err, results) {
      assert(!err);
      process.nextTick(function() {
        assert(call1);
        assert(call2);
        done();
      });
    });
  });

  it('should not require a commit callback in procedural mode', function(done) {
    var txn = db.batch();

    txn.save({name: 'Tim'}, function(err, person) {
      assert(person.name == 'Tim');
      assert(person.id);
      done();
    });

    txn.commit();
  });

  describe('Self Referencing', function() {
    it('should support self referencing', function(done) {
      var txn = db.batch();

      var bob = txn.save({name: "Bob"});
      var james = txn.save({name: "James"});
      
      var rel = txn.relate(bob, 'knows', james, { since: "2011" });

      txn.commit(function(err, results) {
        assert(!err);
        assert(results[bob].name == 'Bob');
        assert(results[james].name == 'James');
        assert(results[bob].id);
        assert(results[james].id);
        assert(results[rel].start == results[bob].id);
        assert(results[rel].end == results[james].id);
        assert(results[rel].properties.since == '2011');
        db.relationships(results[bob], function(err, rels) {
          assert(!err);
          assert(rels.length == 1);
          assert(rels[0].end == results[james].id);
          done();
        });
      });
    });

    it('should support group saves', function(done) {
      var txn = db.batch();

      var beers = txn.save([{name:'Lucky Jack'}, {name:'Galaxy IPA'}]);
      var brewery = txn.save({name:'Lervig Aktiebryggeri'});
      var rel = txn.relate(brewery, 'brews', beers);

      txn.commit(function(err, results) {
        assert(!err);
        assert(results[beers][0].name == 'Lucky Jack');
        assert(results[beers][0].id);
        assert(results[beers][1].name == 'Galaxy IPA');
        assert(results[beers][1].id);
        assert(results[brewery].name == 'Lervig Aktiebryggeri');
        assert(results[brewery].id);
        db.relationships(results[brewery], function(err, rels) {
          assert(!err);
          assert(rels.length == 2);
          assert(rels[0].start == results[brewery].id);
          assert(rels[1].start == results[brewery].id);
          assert(rels[0].end == results[beers][0].id ||
                 rels[0].end == results[beers][1].id);
          assert(rels[1].end == results[beers][0].id ||
                 rels[1].end == results[beers][1].id);
          done();
        });
      });
    });

    it('should support referencing separate parts of a group', function(done) {
      var txn = db.batch();

      var people = txn.save([{name:'Taru'}, {name: 'Ella'}]);
      txn.relate(people[0], 'knows', people[1]);

      txn.commit(function(err, results) {
        assert(!err);
        db.relationships(results[people][0], function(err, rels) {
          assert(!err);
          assert(rels.length > 0);
          assert(rels[0].end == results[people][1].id);
          done();
        });
      });
    });

    it('should support indexing', function(done) {
      var txn = db.batch();
      var idx = uniqn();

      var person = txn.save({name:'Jon'});
      txn.legacyindex(idx, person, 'thing', 'stuff');

      txn.commit(function(err, results) {
        assert(!err);
        db.legacyindex.read(idx, 'thing', 'stuff', function(err, person1) {
          assert(!err);
          assert.deepEqual(person1, results[person]);
          done();
        });
      });
    });

    it('should support indexing and index.readAsList', function(done) {
      var txn = db.batch();
      var idx = uniqn();

      var person = txn.save({name:'Jon'});
      txn.legacyindex(idx, person, 'thing', 'stuff');

      txn.commit(function(err, txnResults) {
        assert(!err);
        db.legacyindex.readAsList(idx, 'thing', 'stuff', function(err, readResults) {
          assert(!err);
          assert.equal(readResults.length, 1);
          assert.deepEqual(readResults[0], txnResults[person]);
          done();
        });
      });
    });

    it('should support updating a rel', function(done) {
      var txn = db.batch();
      var people = txn.save([{name:'Taru'},{name:'Ella'}]);
      var rel = txn.relate(people[0], 'knows', people[1], {thing:'stuff'});

      txn.commit(function(err, result) {
        assert(!err);
        assert(result[rel].properties.thing == 'stuff');
        result[rel].properties.thing = 'other_stuff';
        txn = db.batch();
        var rup = txn.rel.update(result[rel]);
        txn.commit(function(err, res) {
          assert(!err);
          db.rel.read(result[rel].id, function(err, rel) {
            assert(!err);
            assert(rel.properties.thing == 'other_stuff');
            done();
          });
        });
      });
    });


  });
}); 
