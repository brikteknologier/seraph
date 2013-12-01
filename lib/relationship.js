var async = require('async');
var naan = require('naan');
var _ = require('underscore');
var util = require('util');

module.exports = {
  /**
   * Create a new relationship between two nodes. Maps to 
   * POST node/<startNodeId>/relationship
   */
  create: function(startNode, type, endNode, properties, callback) {
    if (typeof properties === 'function') {
      callback = properties;
      properties = null;
    }

    if (Array.isArray(startNode)) {
      var txn = this._safeBatch();
      var args = [ type, endNode, properties ];
      async.map(startNode, naan.ecurry(txn.rel.create, args, [1,2,3]), 
          function(err, rels) {
            if (!err && Array.isArray(endNode))
              return callback(err, _.flatten(rels));
            callback(err, rels);
          });
      return this._safeBatchCommit(txn);
    } else if (Array.isArray(endNode)) {
      var txn = this._safeBatch();
      var args = [ startNode, type, properties ];
      async.map(endNode, naan.ecurry(txn.rel.create, args, [0,1,3]), callback);
      return this._safeBatchCommit(txn);
    }
    
    var startNodeId = this._getId(startNode),
        endNodeId = this._getId(endNode);

    if (!this._isValidId(startNodeId) ||
        !this._isValidId(endNodeId)) {
      return callback(new Error("Invalid ID"));
    }

    var request = {
      to: this._location('node', endNodeId),
      type: type,
    };

    if (properties) {
      request['data'] = properties;
    }

    var endpoint = util.format('%s/relationships', this._nodeRoot(startNodeId));
    var op = this.operation(endpoint, 'POST', request);
    this.call(op, function(err, rel) {
      if (err) {
        callback(err);
      } else {
        callback(null, this._createRelationshipObject(rel));
      }
    });
  },

  /**
   * Update the properties of a given relationship. Maps to
   * PUT relationship/<id>/properties
   */
  update: function(rel, key, val, callback) {
    if (typeof key == 'function') {
      callback = key;
      key = val = undefined;
    }

    if (Array.isArray(rel)) {
      var txn = this._safeBatch();
      var args = [key, val];
      async.map(rel, naan.ecurry(txn.rel.update, args, [1, 2]), callback);
      return this._safeBatchCommit(txn);
    }

    var id = this._getId(rel);

    if (!this._isValidId(id)) {
      return callback(new Error("Invalid ID"));
    }

    var endpoint = util.format('%s/properties', this._relRoot(id));
    if (key) endpoint += '/' + key;

    var op = this.operation(endpoint, 'PUT', key ? val : rel.properties);
    this.call(op, function(err) {
      callback(err);
    });
  }, 

  read: function(id, callback) {
    if (Array.isArray(id)) {
      var txn = this._safeBatch();
      async.map(id, txn.rel.read, callback);
      return this._safeBatchCommit(txn);
    }

    id = this._getId(id);

    if (!this._isValidId(id)) {
      return callback(new Error("Invalid ID"));
    }

    var endpoint = this._relRoot(id);
    var op = this.operation(endpoint);
    this.call(op, function(err, rel) {
      if (err) {
        callback(err);
      } else {
        callback(null, this._createRelationshipObject(rel));
      }
    });
  },

  delete: function(id, callback) {
    if (Array.isArray(id)) {
      var txn = this._safeBatch();
      async.map(id, txn.rel.delete, callback);
      return this._safeBatchCommit(txn);
    }

    id = this._getId(id);

    if (!this._isValidId(id)) {
      return callback(new Error("Invalid ID"));
    }

    var endpoint = this._relRoot(id);
    var op = this.operation(endpoint, 'DELETE');
    this.call(op, function(err, rel) {
      callback(err);
    });
  }
};
