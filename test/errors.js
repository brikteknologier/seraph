var db = require('./util/database').db();
var assert = require('assert');

describe('errors', function() {
  it('should give Error objects with message', function(done) {
    db.read(console, function(err, data) {
      assert.ok(err instanceof Error);
      assert.ok(err.message);
      done();
    });
  });

  it('should decorate errors originating from neo4j', function(done) {
    db.query("herp derp;", function(err, data) {
      assert.ok(err.neo4jException);
      done();
    });
  });
});
