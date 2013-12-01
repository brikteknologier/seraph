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

function saveUnique(mode) {
  return function() {
    var args = [].slice.call(arguments);
    var type = args.shift();
    args.push(mode);
    if (type == 'node') return saveUniqueNode.apply(this, args);
    else return saveUniqueRel.apply(this, args);
  };
};

function saveUniqueNode(node, index, key, value, callback, mode) {
  var self = this;

  var request = {
    key: key,
    value: value,
    properties: node
  };

  var endpoint = util.format('index/node/%s?uniqueness=%s', index, mode);
  var op = this.operation(endpoint, 'POST', request);
  this.call(op, function(err, node) {
    if (err) return callback(err);
    callback(null, this._createNodeObject(node));
  });
};

function saveUniqueRel(start, rel, end, props, idx, key, value, cb, mode) {
  var self = this;
  if (typeof props == 'string') {
    mode = cb;
    cb = value;
    value = key;
    key = idx;
    idx = props;
    props = undefined;
  }

  start = this._getId(start);
  end = this._getId(end);

  if (!this._isValidId(start) || !this._isValidId(end)) {
    return callback(new Error("Invalid ID"));
  }

  var request = {
    key: key,
    value: value,
    start: this._location('node', start),
    end: this._location('node', end),
    type: rel
  };

  if (props) request.properties = props;

  var endpoint = util.format('index/relationship/%s?uniqueness=%s', idx, mode);
  var op = this.operation(endpoint, 'POST', request);
  this.call(op, function(err, rel) {
    if (err) return cb(err);
    cb(null, self._createRelationshipObject(rel));
  });
};

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
      var txn = this._safeBatch();
      var indexer = naan.ncurry(txn[type].legacyindex.create, config, 1);
      async.map(name, indexer, callback);
      return this._safeBatchCommit(txn);
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
      var txn = this._safeBatch();
      var args = [indexName, key, value];
      var indexer = naan.ecurry(txn[type].legacyindex.add, args, [0, 2, 3]);
      async.map(obj, indexer, callback);
      return this._safeBatchCommit(txn);
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

  readAsList: function(type, indexName, key, value, callback) {
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

      callback(null, entityObjects);
    });
  },

  read: function(type, indexName, key, value, callback) {
    indexModule.readAsList.call(this, type, indexName, key, value, function (err, results) {
      if (err) return callback(err);

      if (results.length === 1) {
        callback(null, results[0]);
      } else if (results.length === 0) {
        callback(null, false);
      } else {
        callback(null, results);
      }
    });
  },

  getOrSaveUnique: saveUnique('get_or_create'),
  saveUniqueOrFail: saveUnique('create_or_fail'),

  remove: function(type, indexName, obj, key, value, callback) {
    if (typeof key === 'function') {
      callback = key, key = null, value = null;
    } else if (typeof value === 'function') {
      callback = value, value = null;
    }
    
    if (Array.isArray(obj)) {
      var txn = this._safeBatch();
      var args = [indexName, key, value];
      var rm = naan.ecurry(txn[type].legacyindex.remove, args, [0, 2, 3]);
      async.map(obj, rm, callback);
      return this._safeBatchCommit(txn);
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
      var txn = this._safeBatch();
      async.map(indexName, txn[type].legacyindex.delete, callback);
      return this._safeBatchCommit(txn);
    }

    indexName = encodeURIComponent(indexName);
    var endpoint = util.format('index/%s/%s', type, indexName);
    var op = this.operation(endpoint, 'DELETE');
    this.call(op, function(err) {
      callback(err);
    });
  }
};
