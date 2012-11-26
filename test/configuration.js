/* -*- Mode: Javascript; js-indent-level: 2 -*- */

var testDatabase = require('./util/database');
var uniqn = require('./util/ponies').uniqn;
var seraph = require('../');

var assert = require('assert');
var async = require('async');

describe('configuration', function() {
  /* This checks that the server accepts seraph constructed node id
   * urls where the authority segment or the URL refers to the server
   * by a different name than it knows itself as. */
  it('should understand ids when ref the server by alias', function(done) {
    function testWithServerName(serverName, done) {
      var alias = 'http://' + serverName + ':' + testDatabase.port;
      var db = seraph(alias);
      var idxName = uniqn();
      var origNode = { jelly: "belly" };
      function mkNode(done) {
        db.save(origNode, done);
      }
      function mkIdx(node, done) {
        db.index(idxName, node.id, 'application', node.jelly, done);
      }
      function readIdx(done) {
        db.node.index.read(idxName, 'application',
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
});
