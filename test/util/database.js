/* Handles environment variables, all optional:
 * - TEST_INSTANCE_PORT : run neo4j test instance off specific port
 */

var TEST_INSTANCE_PORT = parseInt(process.env.TEST_INSTANCE_PORT || '10507', 10);
var disposableSeraph = require('disposable-seraph');

var _nsv;

var refreshDb = function(done) {
  disposableSeraph({
      version: '2.3.1', 
      edition: 'community', 
      port: TEST_INSTANCE_PORT 
    },
    function(err, _, nsv) {
      _nsv = nsv;
      if (err) return done(err);
      var db = module.exports.db();
      db.options.pass = 'neo4j';
      db.changePassword('test', function(err) {
        if (err) {
          if (err.code == 401) 
            done();
          else
            done(err);
          return;
        }
        done()
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
    return require('../../')({
      server: module.exports.url,
      user: 'neo4j',
      pass: 'test'
    });
  },
  refreshDb: refreshDb,
  stopDb: stopDb
};
