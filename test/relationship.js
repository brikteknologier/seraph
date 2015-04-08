var db = require('./util/database').db();

var assert = require('assert');
var naan = require('naan');
var async = require('async');

describe('seraph.rel', function() {
  it('should accept id of 0 on rel.read', function(done) {
    db.rel.read(0, function(err, data) {
      if (err)
        assert.ok(err.statusCode); // not seraph error
      done();
    });
  });

  it('should accept id of 0 on rel.update', function(done) {
    db.rel.update({ id: 0, properties: { x: "y" } }, function(err, data) {
      if (err)
        assert.ok(err.statusCode); // not seraph error
      done();
    });
  });

  it('should link two objects together', function(done) {
    function createObjs(done) {
      db.save([{name: 'Jon'}, {name: 'Helge'}], function(err, users) {
        assert.ok(!err);
        assert.equal(users[0].name, 'Jon');
        assert.equal(users[1].name, 'Helge');
        done(null, users[0], users[1]);
      });
    }

    function linkObjs(user1, user2, done) {
      db.rel.create(user1, 'coworker', user2, function(err, link) {
        assert.ok(!err);
        assert.equal(link.start, user1.id);
        assert.equal(link.end, user2.id);
        assert.equal(link.type, 'coworker');
        assert.deepEqual(link.properties, {});
        assert.ok(link.id != null);
        done(null, link, user1, user2);
      });
    }

    function readLink(link, user1, user2, done) {
      var linkId = link.id;
      db.rel.read(link.id, function(err, link) {
        assert.ok(!err, err);
        assert.equal(link.start, user1.id);
        assert.equal(link.end, user2.id);
        assert.equal(link.type, 'coworker');
        assert.deepEqual(link.properties, {});
        assert.equal(linkId, link.id);
        done(null);
      });
    }

    async.waterfall([createObjs, linkObjs, readLink], done);
  });

  it('should link arrays as set multiplication', function(done) {
    async.auto({
      dudes: function(cb) {
        db.save([{name: 'Jon'}, {name: 'Helge'}], cb);
      },
      
      fuels: function(cb) {
        db.save([{name: 'beer'}, {name: 'coffee'}], cb);
      },
      
      link: ['dudes', 'fuels', function(cb, res) {
        db.rel.create(res.dudes, 'craves', res.fuels, cb);
      }],

      readLink: ['link', function(cb, res) {
        db.rel.read(res.link, cb);
      }],

      check: ['readLink', function(cb, res) {
        assert.equal(res.readLink.length, 4);
        cb();
      }]
    }, done);
  });

  it('should delete a relationship', function(done) {
    function createObjs(done) {
      db.save([{name: 'Jon'}, {name: 'Helge'}], function(err, users) {
        done(null, users[0], users[1]);
      });
    }

    function linkObjs(user1, user2, done) {
      db.rel.create(user1, 'coworker', user2, function(err, link) {
        done(null, link, user1, user2);
      });
    }

    function delLink(link, user1, user2, done) {
      var linkId = link.id;
      db.rel.read(link.id, function(err, link) {
        assert.equal(link.start, user1.id);
        assert.equal(link.end, user2.id);
        db.rel.delete(link.id, function(err) {
          assert.ok(!err);
          db.rel.read(link.id, function(err, link) {
            assert.ok(!!err);
            assert.ok(!link);
          })
        })
        done(null);
      });
    }

    async.waterfall([createObjs, linkObjs, delLink], done);
  });

  it('should link two objects with props on the link', function(done) {
    function createObjs(done) {
      db.save([{name: 'Jon'}, {name: 'Helge'}], function(err, users) {
        done(null, users[0], users[1]);
      });
    }

    function linkObjs(user1, user2, done) {
      db.rel.create(user1, 'coworker', user2, {
        prop: 'test'
      }, function(err, link) {
        assert.ok(!err);
        assert.deepEqual(link.properties, {prop: 'test'});
        done(null, link);
      });
    }

    function readLink(link, done) {
      var linkId = link.id;
      db.rel.read(link.id, function(err, link) {
        assert.deepEqual(link.properties, {prop: 'test'});
        done(null);
      });
    }

    async.waterfall([createObjs, linkObjs, readLink], done);
  });

  it('should update the properties of a link', function(done) {
    function createObjs(done) {
      db.save([{name: 'Jon'}, {name: 'Helge'}], function(err, users) {
        done(null, users[0], users[1]);
      });
    }

    function linkObjs(user1, user2, done) {
      db.rel.create(user1, 'coworker', user2, {
        prop: 'test',
        anotherProp: 'test2',
        thirdProp: 'test3'
      }, function(err, link) {
        done(null, link);
      });
    }

    function updateLink(link, done) {
      link.properties.newProp = 'test4';
      delete link.properties.thirdProp;
      db.rel.update(link, function(err) {
        assert.ok(!err);
        done(null, link);
      });
    }

    function readLink(link, done) {
      var linkId = link.id;
      db.rel.read(link.id, function(err, link) {
        assert.deepEqual(link.properties, {
          prop: 'test',
          anotherProp: 'test2',
          newProp: 'test4'
        });
        done(null);
      });
    }

    async.waterfall([createObjs, linkObjs, updateLink, readLink], done);
  });

  it('should update a single property of a rel', function(done) {
    function createObjs(done) {
      db.save([{name: 'Jon'}, {name: 'Helge'}], function(err, users) {
        done(null, users[0], users[1]);
      });
    }

    function linkObjs(user1, user2, done) {
      db.rel.create(user1, 'coworker', user2, {
        prop: 'test',
        anotherProp: 'test2',
        thirdProp: 'test3'
      }, function(err, link) {
        assert.deepEqual(link.properties, {
          prop: 'test',
          anotherProp: 'test2',
          thirdProp: 'test3'
        });
        done(null, link);
      });
    }

    function updateLink(link, done) {
      link.properties.thirdProp = 'fake new value';
      db.rel.update(link, 'anotherProp', 'amazing new value', function(err) {
        assert.ok(!err);
        done(null, link);
      });
    }

    function readLink(link, done) {
      var linkId = link.id;
      db.rel.read(link.id, function(err, link) {
        assert.deepEqual(link.properties, {
          prop: 'test',
          anotherProp: 'amazing new value',
          thirdProp: 'test3'
        });
        done(null);
      });
    }

    async.waterfall([createObjs, linkObjs, updateLink, readLink], done);
  });

});

describe('seraph#links', function() {
  function createObjs(done) {
    var create = naan.curry(db.save, [
      {name: 'Jon'},
      {name: 'Helge'},
      {name: 'Bertin'}
    ]);
    var link = function(users, callback) {
      var knows = naan.curry(db.relate, users[0], 'knows', users[1], {
        since: 'January'
      });
      var coworker = naan.curry(db.relate, users[0], 'coworker', users[1]);
      var coworker2 = naan.curry(db.relate, users[0], 'coworker', users[2]);
      var friends = naan.curry(db.relate, users[1], 'friends', users[0]);
      async.series([ knows, coworker, coworker2, friends ], function() {
        setTimeout(function() { callback(null, users); }, 20);
      });
    };

    async.waterfall([create, link], done);
  }

  it('should retrieve all links for an object', function(done) {
    createObjs(function(err, users) {
      db.relationships(users[0], function(err, links) {
        assert.ok(!err);
        var types = links.map(function(link) { return link.type; });
        assert.ok(types.indexOf('coworker') !== -1);
        assert.ok(types.indexOf('friends') !== -1);
        assert.ok(types.indexOf('knows') !== -1);
        done();
      });
    });
  });

  it('should retreive all incoming links for an object', function(done) {
    createObjs(function(err, users) {
      db.relationships(users[0], 'in', function(err, links) {
        assert.ok(!err);
        var types = links.map(function(link) { return link.type; });
        assert.ok(types.indexOf('coworker') === -1);
        assert.ok(types.indexOf('friends') !== -1);
        assert.ok(types.indexOf('knows') === -1);
        done();
      });
    });
  });

  it('should retrieve all outgoing links for an object', function(done) {
    createObjs(function(err, users) {
      db.relationships(users[0], 'out', function(err, links) {
        assert.ok(!err);
        var types = links.map(function(link) { return link.type; });
        assert.ok(types.indexOf('coworker') !== -1);
        assert.ok(types.indexOf('friends') === -1);
        assert.ok(types.indexOf('knows') !== -1);
        done();
      });
    });
  });
  
  it('should fetch links of a certain type', function(done) {
    createObjs(function(err, users) {
      db.relationships(users[0], 'all', 'coworker', function(err, links) {
        assert.ok(!err);
        assert.equal(links.length, 2);
        assert.equal(links[0].start, users[0].id);
        assert.equal(links[1].start, users[0].id);
        assert.equal(links[0].type, 'coworker');
        assert.equal(links[1].type, 'coworker');
        done();
      });
    });
  });

  it('should fetch properties of links', function(done) {
    createObjs(function(err, users) {
      db.relationships(users[0], 'all', 'knows', function(err, links) {
        assert.ok(!err);
        assert.deepEqual(links[0].properties, { since: 'January' });
        done();
      });
    });
  });

  it('should fetch links for multiple objects', function(done) {
    createObjs(function(err, users) {
      db.relationships(users, 'all', function(err, links) {
        assert.ok(!err);
        assert.equal(links[0].length, 4);
        assert.equal(links[1].length, 3);
        assert.equal(links[2].length, 1);
        done();
      });
    });
  });
});
