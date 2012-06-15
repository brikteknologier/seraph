var async = require('async');
var naan = require('naan');
var _ = require('underscore');
var util = require('util');

module.exports = {
  create: function(options, type, name, config, callback) {
    if (typeof name === 'function') {
      callback = name;
      name = type;
      type = 'node';
      config = null;
    } else if (typeof config === 'function') {
      callback = config;
      if (typeof name === 'object' && !Array.isArray(name)) {
        config = name;
        name = type;
        type = 'node';
      } else {
        config = null;
      }
    } 

    if (Array.isArray(name)) {
      var args = [ options, type, config ];
      var indexer = naan.b.ecurry(this, this.index.create, args, [0, 1, 3]);
      return async.map(name, indexer, callback);
    }

    if (type !== 'node' && type !== 'relationship') {
      return callback(new Error("Invalid index type (should be 'node' or " +
            "'relationship'."));
    }

    var request = { name: name };
    if (config != null) {
      request.config = config;
    }

    var endpoint = util.format('index/%s', type);
    var op = this.operation(options, endpoint, 'POST', request);
    this.call(options, op, function(err) {
      callback(err);
    });
  },

  add: function(options, type, indexName, obj, key, value, callback) {
    if (typeof indexName === 'object') {
      callback = value;
      value = key;
      key = obj;
      obj = indexName;
      indexName = type;
      type = 'node';
    }

    if (Array.isArray(obj)) {
      var args = [options, type, indexName, key, value];
      var indexer = naan.b.ecurry(this, this.index.add, args, [0, 1, 3, 4, 5]);
      return async.map(obj, indexer, callback);
    }

    var id = this._getId(options, obj);
    var location = this._location(options, type, id);
    
    var request = {
      uri: location,
      key: key,
      value: value
    };

    var endpoint = util.format('index/%s/%s', type, indexName);
    var op = this.operation(options, endpoint, 'POST', request);
    this.call(options, op, function(err) {
      callback(err);
    });
  }
};
