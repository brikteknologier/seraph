var async = require('async');
var naan = require('naan');
var _ = require('underscore');
var util = require('util');

// although it looks like this will support compound keys, neo4j-2 doesn't yet, 
// so attempting to create one will just give you an error from neo4j.
exports.create = function(label, keys, callback) {
  if (!Array.isArray(keys)) keys = [keys];

  label = encodeURIComponent(label);
  var body = { property_keys: keys };

  var endpoint = util.format('schema/index/%s', label);
  var op = this.operation(endpoint, 'POST', body);
  this.call(op, function(err, index) {
    if (err) callback(err);
    else callback(null, index);
  });
};

// this will need to be updated when compound keys are supported
exports.createIfNone = function(label, keys, callback) {
  var self = this;
  exports.create.call(self, label, keys, function(err, index) {
    if (!err) return callback(null, index);
    if (err.statusCode != 409) return callback(err);
    exports.list.call(self, label, function(err, indexes) {
      if (err) return callback(err);
      var index = indexes.filter(function(index) {
        return index.property_keys[0] == keys;
      });
      callback(null, index[0]);
    });
  });
};

exports.list = function(label, callback) {
  label = encodeURIComponent(label);
  var endpoint = util.format('schema/index/%s', label);
  var op = this.operation(endpoint, 'GET');
  this.call(op, function(err, indexes) {
    if (err) callback(err);
    else callback(null, indexes);
  });
};

exports.drop = function(label, key, callback) {
  label = encodeURIComponent(label);
  key = encodeURIComponent(key);
  var endpoint = util.format('schema/index/%s/%s', label, key);
  var op = this.operation(endpoint, 'DELETE');
  this.call(op, function(err) {
    if (err) callback(err);
    else callback();
  });
}
