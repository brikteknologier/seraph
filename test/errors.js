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

});
