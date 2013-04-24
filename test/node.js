/* -*- Mode: Javascript; js-indent-level: 2 -*- */

var testDatabase = require('./util/database');
var db = require('../')(testDatabase.url);

var assert = require('assert');
var async = require('async');

describe('seraph#save, seraph#read', function() {
  it('should accept id of 0 on read', function(done) {
    db.read(0, function(err, data) {
      if (err)
        assert.equal(err.statusCode, 204); // neo4j gives 204 no content
      done();
    });
  });

  it('should accept id of 0 on save', function(done) {
    db.save({ id: 0, herp: "DERP" }, function(err, data) {
      if (err)
        assert.ok(err.statusCode); // not seraph error
      done();
    });
  });

  it('should handle alternative id property name', function(done) {
    function create(done) {
      db.save({ name: 'Jon', age: 23 }, function(err, user) {
        assert.ok(!err, err);
        assert.ok(typeof user.ponies !== 'undefined');
        assert.equal(user.name, 'Jon');
        assert.equal(user.age, 23);

        done(null, user.ponies);
      });
    }

    function read(userId, done) {
      db.read(userId, function(err, user) {
        assert.ok(!err, err);
        assert.equal(user.name, 'Jon');
        assert.equal(user.age, 23);
        done(null, user);
      });
    }

    var origId = db.options.id;
    db.options.id = "ponies";
    try {
      async.waterfall([create, read], function(err, res) {
        db.options.id = origId;
        done(err, res);
      });
    } catch (e) {
      db.options.id = origId;
      throw e;
    }
  });

  it('should be able to create an object and read it back', function(done) {
    function create(done) {
      db.save({ name: 'Jon', age: 23 }, function(err, user) {
        assert.ok(!err, err);
        assert.ok(typeof user.id !== 'undefined');
        assert.equal(user.name, 'Jon');
        assert.equal(user.age, 23);

        done(null, user.id);
      });
    }

    function read(userId, done) {
      db.read(userId, function(err, user) {
        assert.ok(!err, err);
        assert.equal(user.name, 'Jon');
        assert.equal(user.age, 23);
        done(null, user);
      });
    }

    async.waterfall([create, read], done);
  });

  it('should take an array of objects to save/read', function(done) {
    function createObjs(done) {
      db.save([{name: 'Jon'}, {name: 'Helge'}], function(err, users) {
        assert.ok(!err, err);
        assert.equal(users[0].name, 'Jon');
        assert.equal(users[1].name, 'Helge');
        done(null, users[0], users[1]);
      });
    }

    function readObjs(user1, user2, done) {
      db.read([user1.id, user2.id], function(err, users) {
        assert.ok(!err, err);
        assert.equal(users[0].name, 'Jon');
        assert.equal(users[1].name, 'Helge');
        done();
      });
    }

    async.waterfall([createObjs, readObjs], done);
  });

  it('should handle an empty array of objects to save', function(done) {
    db.save([], done);
  });

  it('should not introduce id fields into the database', function(done) {
    db.save({pie: 'potato'}, function(err, thing) {
      db.read(thing, function(err, thingamajig) {
        db.save(thingamajig, function(err, thingamajiggy) {
          db.query('START n = node({id}) RETURN n.id? as thingamajiggle',
                   thingamajiggy, function(err, thingamajoggle) {
            assert.ok(thingamajoggle[0] === null);
            done();
          });
        });
      });
    });
  });
})

describe('seraph#update', function() {
  it('should perform an update on an object', function(done) {
    function create(done) {
      db.save({ name: 'Jan', age: 55 }, function(err, user) {
        assert.ok(!err);
        assert.equal(user.name, 'Jan');
        assert.equal(user.age, 55);
        done(null, user);
      });
    }

    function update(user, done) {
      user.name = 'Belinda';
      user.age = 26;
      var userId = user.id;
      db.save(user, function(err, user) {
        assert.ok(!err);
        assert.equal(userId, user.id);
        assert.equal(user.name, 'Belinda');
        assert.equal(user.age, 26);
        db.read(userId, function(err, user) {
          assert.ok(!err);
          assert.equal(userId, user.id);
          assert.equal(user.name, 'Belinda');
          assert.equal(user.age, 26);
          done(null, user);
        });
      });
    }

    async.waterfall([create, update], done);
  });

  it('should take an array of objects to save/read', function(done) {
    function createObjs(done) {
      db.save([{name: 'Jon'}, {name: 'Helge'}], function(err, users) {
        assert.ok(!err);
        assert.equal(users[0].name, 'Jon');
        assert.equal(users[1].name, 'Helge');
        done(null, users[0], users[1]);
      });
    }

    function readObjs(user1, user2, done) {
      db.read([user1.id, user2.id], function(err, users) {
        assert.ok(!err);
        assert.equal(users[0].name, 'Jon');
        assert.equal(users[1].name, 'Helge');
        done(null, users[0], users[1]);
      });
    }

    function updateObjs(user1, user2, done) {
      user1.name = 'Bertin';
      user2.name = 'Erlend';
      db.save([user1, user2], function(err, users) {
        assert.ok(!err);
        assert.equal(users[0].name, 'Bertin');
        assert.equal(users[1].name, 'Erlend');
        done();
      });
    }

    async.waterfall([createObjs, readObjs, updateObjs], done);
  });
});

describe('seraph#delete', function() {
  it('should delete an object', function(done) {
    function create(done) {
      db.save({ name: 'Neil', age: 61 }, function(err, user) {
        assert.ok(!err);
        assert.equal(user.name, 'Neil');
        assert.equal(user.age, 61);
        done(null, user);
      });
    }

    function del(user, done) {
      db.delete(user, function(err) {
         assert.ok(!err);
        db.read(user, function(err) {
          assert.ok(!!err);
          done();
        });
      });
    }

    async.waterfall([create, del], done);
  });

  it('should not delete node w/relations if not forced', function(done) {
    async.auto({
      n: function(cb) {
        db.save({}, cb);
      },
      m: function(cb) {
        db.save({}, cb);
      },
      r: ["n", "m", function(cb, res) {
        db.rel.create(res.n, "abscurs", res.m, cb);
      }],
      d: ["n", "r", function(cb, res) {
        db.delete(res.n, cb);
      }]
    }, function(err, res) {
      assert.ok(err);
      done();
    });
  });

  it('should delete node+relations if forced', function(done) {
    async.auto({
      n: function(cb) {
        db.save({potato:'mega'}, cb);
      },
      m: function(cb) {
        db.save({llol:'stuf'}, cb);
      },
      r: ["n", "m", function(cb, res) {
        db.rel.create(res.n, "abscurs", res.m, cb);
      }],
      d: ["n", "r", function(cb, res) {
        db.delete(res.n, true, cb);
      }]
    }, function(err, res) {
      assert.ok(!err, err);
      done();
    });
  });
  
  it('should delete node+relations if forced', function(done) {
    async.auto({
      n: function(cb) {
        db.save({potato:'mega'}, cb);
      },
      d: ["n", function(cb, res) {
        db.delete(res.n, true, function(err) {
          cb(err, res.n);
        });
      }]
    }, function(err, res) {
      assert.ok(!err, err);
      db.read(res.d, function(err, node) {
        assert(err.statusCode == 404);
        assert(!node);
        done();
      });
    });
  });

  it('should take an array of objects to delete', function(done) {
    function createObjs(done) {
      db.save([{name: 'Jon'}, {name: 'Helge'}], function(err, users) {
        assert.ok(!err);
        assert.equal(users[0].name, 'Jon');
        assert.equal(users[1].name, 'Helge');
        done(null, users[0], users[1]);
      });
    }

    function readObjs(user1, user2, done) {
      db.read([user1.id, user2.id], function(err, users) {
        assert.ok(!err);
        assert.equal(users[0].name, 'Jon');
        assert.equal(users[1].name, 'Helge');
        done(null, users[0], users[1]);
      });
    }

    function delObjs(user1, user2, done) {
      db.delete([user1.id, user2.id], function(err) {
        assert.ok(!err);
        db.read([user1.id, user2.id], function(err) {
          assert.ok(!!err);
          done();
        });
      });
    }

    async.waterfall([createObjs, readObjs, delObjs], done);
  });
});
