/* -*- Mode: Javascript; js-indent-level: 2 -*- */

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
      var args = [ type, endNode, properties ];
      var createRel = naan.ecurry(this.rel.create, args, [1, 2, 3]);
      return this.throttleMap(startNode, createRel, function (err, rels) {
        if (!err && Array.isArray(endNode))
          return callback(err, _.flatten(rels));
        callback(err, rels);
      });
    } else if (Array.isArray(endNode)) {
      var args = [ startNode, type, properties ];
      var createRel = naan.ecurry(this.rel.create, args, [0, 1, 3]);
      return this.throttleMap(endNode, createRel, callback);
    }
    
    var startNodeId = this._getId(startNode),
        endNodeId = this._getId(endNode);

    if (startNodeId === undefined || endNodeId === undefined) {
      return callback(new Error("Invalid ID"));
    }

    var request = {
      to: this._location('node', endNodeId),
      type: type,
    };

    if (properties) {
      request['data'] = properties;
    }

    var endpoint = util.format('node/%d/relationships', startNodeId);
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
  update: function(rel, callback) {
    if (Array.isArray(rel)) {
      return this.throttleMap(rel, this.rel.update, callback);
    }

    var id = this._getId(rel);

    if (id === undefined) {
      return callback(new Error("Invalid ID"));
    }

    var endpoint = util.format('relationship/%d/properties', id);
    var op = this.operation(endpoint, 'PUT', rel.properties);
    this.call(op, function(err) {
      callback(err);
    });
  }, 

  read: function(id, callback) {
    if (Array.isArray(id)) {
      return this.throttleMap(id, this.rel.read, callback);
    }

    id = this._getId(id);

    if (id === undefined) {
      return callback(new Error("Invalid ID"));
    }

    var endpoint = util.format('relationship/%d', id);
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
      return this.throttleMap(id, this.rel.delete, callback);
    }

    id = this._getId(id);

    if (id === undefined) {
      return callback(new Error("Invalid ID"));
    }

    var endpoint = util.format('relationship/%d', id);
    var op = this.operation(endpoint, 'DELETE');
    this.call(op, function(err, rel) {
      callback(err);
    });
  }
};
