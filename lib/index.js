var async = require('async');
var naan = require('naan');
var _ = require('underscore');
var util = require('util');

function isValidType(type, callback) {
  if (type !== 'node' && type !== 'relationship') {
    callback(new Error("Invalid index type (should be 'node' or " +
          "'relationship'."));
    return false;
  }
  return true;
}

var indexModule = module.exports = {
  create: function(type, name, config, callback) {
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
      var args = [ type, config ];
      var indexer = naan.b.ecurry(this, indexModule.create, args, [0, 2]);
      return async.map(name, indexer, callback);
    }

    if (!isValidType(type, callback)) {
      return;
    }

    var request = { name: name };
    if (config != null) {
      request.config = config;
    }

    var endpoint = util.format('index/%s', type);
    var op = this.operation(endpoint, 'POST', request);
    this.call(op, function(err) {
      callback(err);
    });
  },

  add: function(type, indexName, obj, key, value, callback) {
    if (typeof value === 'function') {
      callback = value;
      value = key;
      key = obj;
      obj = indexName;
      indexName = type;
      type = 'node';
    }
    
    if (Array.isArray(obj)) {
      var args = [type, indexName, key, value];
      var indexer = naan.b.ecurry(this, indexModule.add, args, [0, 1, 3, 4]);
      return async.map(obj, indexer, callback);
    }

    if (!isValidType(type, callback)) {
      return;
    }

    var id = this._getId(obj);
    if (!this._isValidId(id)) {
      return callback(new Error("Invalid ID"));
    }
    var location = this._location(type, id);

    var request = {
      uri: location,
      key: key,
      value: value
    };

    indexName = encodeURIComponent(indexName);

    var endpoint = util.format('index/%s/%s', type, indexName);
    var op = this.operation(endpoint, 'POST', request);
    this.call(op, function(err) {
      callback(err);
    });
  },

  read: function(type, indexName, key, value, callback) {
    if (typeof value === 'function') {
      callback = value;
      value = key;
      key = indexName;
      indexName = type;
      type = 'node';
    }

    if (!isValidType(type, callback)) {
      return;
    }

    indexName = encodeURIComponent(indexName);
    value = encodeURIComponent(value); 
    key = encodeURIComponent(key);

    var ep = util.format('index/%s/%s/%s/%s', type, indexName, key, value);
    var op = this.operation(ep, 'GET');
    var self = this;
    this.call(op, function(err, entities) {
      if (err) {
        return callback(err);
      }

      var entityObjects = entities.map(function(entity) {
        return type === 'node'
          ? self._createNodeObject(entity)
          : self._createRelationshipObject(entity);
      });

      if (entityObjects.length === 1) {
        entityObjects = entityObjects[0];
      } else if (entityObjects.length === 0) {
        entityObjects = false;
      }

      callback(null, entityObjects);
    });
  },

  remove: function(type, indexName, obj, key, value, callback) {
    if (typeof key === 'function') {
      callback = key, key = null, value = null;
    } else if (typeof value === 'function') {
      callback = value, value = null;
    }
    
    if (Array.isArray(obj)) {
      var args = [type, indexName, key, value];
      var rm = naan.b.ecurry(this, indexModule.remove, args, [0, 1, 3, 4]);
      return async.map(obj, rm, callback);
    }

    var id = this._getId(obj);
    if (!this._isValidId(id)) {
      return callback(new Error("Invalid ID"));
    }

    indexName = encodeURIComponent(indexName);
    var endpoint = util.format('index/%s/%s', type, indexName);
  
    if (key) endpoint += '/' + encodeURIComponent(key);
    if (value) endpoint += '/' + encodeURIComponent(value)

    endpoint += '/' + id;

    var op = this.operation(endpoint, 'DELETE');
    this.call(op, function(err) {
      callback(err);
    });
  },

  delete: function(type, indexName, callback) {
    if (Array.isArray(indexName)) {
      var delfn = naan.b.curry(this, indexModule.delete, type);
      return async.map(indexName, delfn, callback);
    }

    indexName = encodeURIComponent(indexName);
    var endpoint = util.format('index/%s/%s', type, indexName);
    var op = this.operation(endpoint, 'DELETE');
    this.call(op, function(err) {
      callback(err);
    });
  }
};
