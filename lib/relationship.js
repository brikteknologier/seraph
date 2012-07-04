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
  create: function(options, startNode, type, endNode, properties, callback) {
    if (typeof properties === 'function') {
      callback = properties;
      properties = null;
    }

    if (Array.isArray(startNode)) {
      var args = [ options, type, endNode, properties ];
      var createRel = naan.b.ecurry(this, this.rel.create, args, [0, 2, 3, 4]);
      return async.map(startNode, createRel, callback);
    } else if (Array.isArray(endNode)) {
      var args = [ options, startNode, type, properties ];
      var createRel = naan.b.ecurry(this, this.rel.create, args, [0, 1, 2, 4]);
      return async.map(endNode, createRel, callback);
    }
    
    var startNodeId = this._getId(options, startNode),
        endNodeId = this._getId(options, endNode);

    if (startNodeId == null || endNodeId == null) {
      return callback(new Error("Invalid ID"));
    }

    var request = {
      to: this._location(options, 'node', endNodeId),
      type: type,
    };

    if (properties) {
      request['data'] = properties;
    }

    var endpoint = util.format('node/%d/relationships', startNodeId);
    var op = this.operation(options, endpoint, 'POST', request);
    this.call(options, op, function(err, rel) {
      if (err) {
        callback(err);
      } else {
        callback(null, this._createRelationshipObject(options, rel));
      }
    });
  },

  /**
   * Update the properties of a given relationship. Maps to
   * POST relationship/<id>/properties
   */
  update: function(options, rel, callback) {
    if (Array.isArray(rel)) {
      var args = [ options, properties ];
      var updateRel = naan.b.ecurry(this.rel.update, args, [0, 2]);
      return async.map(rel, updateRel, callback);
    }

    var id = this._getId(options, rel);

    if (id == null) {
      return callback(new Error("Invalid ID"));
    }

    var endpoint = util.format('relationship/%d/properties', id);
    var op = this.operation(options, endpoint, 'PUT', rel.properties);
    this.call(options, op, function(err) {
      callback(err);
    });
  }, 

  read: function(options, id, callback) {
    if (Array.isArray(id)) {
      var boundReadRelationship = naan.b.curry(this, this.rel.read, options);
      return async.map(id, boundReadRelationship, callback);
    }

    id = this._getId(options, id);

    if (id == null) {
      return callback(new Error("Invalid ID"));
    }

    var endpoint = util.format('relationship/%d', id);
    var op = this.operation(options, endpoint);
    this.call(options, op, function(err, rel) {
      if (err) {
        callback(err);
      } else {
        callback(null, this._createRelationshipObject(options, rel));
      }
    });
  }
};
