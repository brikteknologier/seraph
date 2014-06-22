/* -*- Mode: Javascript; js-indent-level: 2 -*- */

/* Handles environment variables, all optional:
 * - TEST_INSTANCE_PORT : run neo4j test instance off specific port
 */

var TEST_INSTANCE_PORT = parseInt(process.env.TEST_INSTANCE_PORT || '10507', 10);
var disposableSeraph = require('disposable-seraph');

var _nsv;

var refreshDb = function(done) {
  disposableSeraph({
      version: '2.1.2', 
      edition: 'community', 
      port: TEST_INSTANCE_PORT 
    },
    function(err, _, nsv) {
      _nsv = nsv;
      done(err);
    });
};

var stopDb = function(done) {
  _nsv.stop(done);
}

module.exports = {
  port: TEST_INSTANCE_PORT,
  url: 'http://localhost:' + TEST_INSTANCE_PORT,
  refreshDb: refreshDb,
  stopDb: stopDb
};
