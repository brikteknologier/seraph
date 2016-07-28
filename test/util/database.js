/* Handles environment variables, all optional:
 * - TEST_INSTANCE_PORT : run neo4j test instance off specific port
 */

var nodeify = require('bluebird-nodeify');

var TEST_INSTANCE_PORT = parseInt(process.env.TEST_INSTANCE_PORT || '10507', 10);
var disposableSeraph = require('disposable-seraph');

var _nsv;

var refreshDb = function(done) {
  disposableSeraph({
      version: '3.0.3', 
      edition: 'community', 
      port: TEST_INSTANCE_PORT 
    },
    function(err, _, nsv) {
      _nsv = nsv;
      if (err) return done(err);
      var db = require('../../')({server:module.exports.url});
      db.options.user = 'neo4j';
      db.options.pass = 'test';
      db.changePassword('test', function(err) {
        done();
      });
    });
};

var stopDb = function(done) {
  _nsv.stop(done);
}

module.exports = {
  port: TEST_INSTANCE_PORT,
  url: 'http://localhost:' + TEST_INSTANCE_PORT,
  db: function() {
    // return require('../../')({
      //server: module.exports.url,
    var db =  (require('../../lib/bolt/seraph'))({
      user: 'neo4j',
      pass: 'test',
      nodeify: true
    });
    return db;
  },
  refreshDb: refreshDb,
  stopDb: stopDb
};
