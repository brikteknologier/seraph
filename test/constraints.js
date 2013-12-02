var testDatabase = require('./util/database');
var db = require('../')(testDatabase.url);
var uniqn = require('./util/ponies').uniqn;

var assert = require('assert');
var async = require('async');

describe('seraph#constraints', function() {
  it('should be able to add a uniqueness constraint', function(done) {
    var label = uniqn();
    db.constraints.uniqueness.create(label, 'name', function(err, constraint) {
      assert(!err);
      assert.equal(constraint.label, label);
      assert.equal(constraint.type, 'UNIQUENESS');
      assert.equal(constraint.property_keys.length, 1);
      assert.equal(constraint.property_keys[0], 'name');
      done();
    });
  });
});
