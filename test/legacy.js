var db = require('./util/database').db();
var uniqn = require('./util/ponies').uniqn;

var assert = require('assert');
var async = require('async');
describe('legacy tests', function() {
  describe('batching', function() {
    it('should throw an error if attempting to save nodes with a label in batch mode', function(done) {
      var label = uniqn();
      var txn = db.batch();
      txn.save({name:'Jon'}, label);
      txn.commit(function(err, res) {
        assert(err);
        done();
      });
    });
  })
});
