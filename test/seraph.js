var testDatabase = require('./util/database');
var uniqn = require('./util/ponies').uniqn;
var seraph = require('../'), _seraph = seraph;

var assert = require('assert');
var async = require('async');

describe('configuration', function() {
  /* This checks that the server accepts seraph constructed node id
   * urls where the authority segment or the URL refers to the server
   * by a different name than it knows itself as. */
  it('should understand ids when ref the server by alias', function(done) {
    function testWithServerName(serverName, done) {
      var alias = 'http://' + serverName + ':' + testDatabase.port;
      var db = seraph({
        server: alias,
        user: 'neo4j',
        pass: 'test'
      });
      var idxName = uniqn();
      var origNode = { jelly: "belly" };
      function mkNode(done) {
        db.save(origNode, done);
      }
      function mkIdx(node, done) {
        db.legacyindex(idxName, node.id, 'application', node.jelly, done);
      }
      function readIdx(done) {
        db.node.legacyindex.read(idxName, 'application',
                           origNode.jelly, done);
      }
      function check(nodeFromIndex, done) {
        assert.equal(nodeFromIndex.jelly, origNode.jelly);
        done();
      }
      async.waterfall([mkNode, mkIdx, readIdx, check], done);
    }

    testWithServerName('127.0.0.1', function(err) {
      if (err) return done(err);
      testWithServerName('localhost', done);
    });
  });

  it('should work with a trailing slash on the server url', function(done) {
    var db = seraph({
      server: 'http://127.0.0.1:' + testDatabase.port + '/',
      user: 'neo4j',
      pass: 'test'
    });
    db.save({name:'mr potato'}, function(err,node) {
      assert(!err);
      done();
    });
  });

  it('should work with a trailing slash on the server endpoint', function(done) {
    var db = seraph({
      server: 'http://127.0.0.1:' + testDatabase.port + '/',
      endpoint: '/db/data/',
      user: 'neo4j',
      pass: 'test'
    });
    db.save({name:'mr potato'}, function(err,node) {
      assert(!err);
      done();
    });
  });
});

describe('seraph#call, seraph#operation', function() {
  var seraph;
  function setupMock(opts, mock) {
    if (typeof opts == 'function') {
      seraph = _seraph(testDatabase.url);
      mock = opts;
    } else {
      seraph = _seraph(opts);
    }
    seraph._request = mock;
  };
  
  it('should infer GET request if no data or method supplied', function(done) {
    setupMock(function(opts, callback) {
      assert.ok(typeof callback === 'function');
      assert.equal(opts.method, 'GET');
      done();
    });
    var op = seraph.operation('');
    seraph.call(op);
  });

  it('should infer POST request if data supplied', function(done) {
    var testObject = {
      foo: 'foo',
      bar: 10
    };
    setupMock(function(opts, callback) {
      assert.ok(typeof callback === 'function');
      assert.equal(opts.method, 'POST');
      assert.deepEqual(opts.json, testObject);
      done();
    });
    var op = seraph.operation('', testObject);
    seraph.call(op);
  });

  it('should infer http://localhost:7474 as server', function(done) {
    var obj = {};
    setupMock({ }, function(opts, callback) {
      assert.ok(opts.uri.match('http://localhost:7474'));
      done();
    });
    var op = seraph.operation('', obj);
    seraph.call(op);
  });

  it('should infer /db/data/ as endpoint', function(done) {
    var obj = {};
    setupMock(function(opts, callback) {
      assert.ok(opts.uri.match('/db/data/'));
      done();
    });
    var op = seraph.operation('', obj);
    seraph.call(op);
  });

  it('should accept specific endpoint', function(done) {
    var obj = {};
    setupMock({ endpoint: '/herp/derp' }, function(opts, callback) {
      assert.ok(opts.uri.match('/herp/derp/'));
      done();
    });
    var op = seraph.operation('', obj);
    seraph.call(op);
  });

  it('should accept specific server', function(done) {
    var obj = {};
    setupMock({ server: 'http://legit.ru:1337' }, function(opts, callback) {
      assert.ok(opts.uri.match('http://legit.ru:1337'));
      done();
    });
    var op = seraph.operation('', obj);
    seraph.call(op);
  });
});
