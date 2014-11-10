var async = require('async');
var naan = require('naan');
var _ = require('underscore');
var util = require('util');

exports.uniqueness = {};

exports.uniqueness.create = function(label, keys, callback) {
  if (!Array.isArray(keys)) keys = [keys];

  label = encodeURIComponent(label);
  var body = { property_keys: keys };

  var endpoint = util.format('schema/constraint/%s/uniqueness', label);
  var op = this.operation(endpoint, 'POST', body);
  this.call(op, function(err, index) {
    if (err) callback(err);
    else callback(null, index);
  });
};

exports.uniqueness.createIfNone = function(label, keys, callback) {
  var self = this;
  exports.uniqueness.list.call(self, label, keys, function(err, constraints) {
    if (err) {
      if (err.statusCode != 404) return callback(err);
    } else if (constraints.length > 0) return callback(null, constraints[0]);
    // Seems like sometimes if this is being called very early in neo4j's init
    // phase, the list command doesn't return a constraint, but the following
    // calls sends back a 409. So we check for that, and don't send that error
    // through.
    exports.uniqueness.create.call(self, label, keys, function(err, constraint) {
      if (err) {
        if (err.statusCode == 409) {
          // in this edgecase there's no way really for us to get the constraint
          // object, so send back without (for now). hopefully there's a better
          // way to handle this in the future.
          return callback();
        } else {
          return callback(err);
        }
      }

      callback(null, constraint);
    });
  });
};

exports.uniqueness.list = function(label, key, callback) {
  if (typeof key == 'function') {
    callback = key;
    key = null;
  }

  label = encodeURIComponent(label);
  var endpoint = util.format('schema/constraint/%s/uniqueness', label);

  if (key) {
    key = encodeURIComponent(key);
    endpoint += '/' + key;
  }

  var op = this.operation(endpoint, 'GET');
  this.call(op, function(err, constraints) {
    if (err) callback(err);
    else callback(null, constraints);
  });
};

exports.uniqueness.drop = function(label, key, callback) {
  label = encodeURIComponent(label);
  key = encodeURIComponent(key);
  var endpoint = util.format('schema/constraint/%s/uniqueness/%s', label, key);
  var op = this.operation(endpoint, 'DELETE');
  this.call(op, function(err) {
    if (err) callback(err);
    else callback();
  });
};

exports.list = function(label, callback) {
  if (typeof label == 'function') {
    callback = label;
    label = null; 
  }

  var endpoint = 'schema/constraint';

  if (label) endpoint += '/' + encodeURIComponent(label);

  var op = this.operation(endpoint, 'GET');
  this.call(op, function(err, constraints) {
    if (err) callback(err);
    else callback(null, constraints);
  });
};
