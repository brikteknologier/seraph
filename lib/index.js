var async = require('async');
var naan = require('naan');
var _ = require('underscore');
var util = require('util');

exports.create = function(indexName, keys, callback) {
  if (!Array.isArray(keys)) keys = [keys];

  indexName = encodeURIComponent(indexName);
  var body = { property_keys: keys };

  var endpoint = util.format('schema/index/%s', indexName);
  var op = this.operation(endpoint, 'POST', body);
  this.call(op, function(err, index) {
    if (err) callback(err);
    else callback(null, index);
  });
};
