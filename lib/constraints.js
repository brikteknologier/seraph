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
