/* -*- Mode: Javascript; js-indent-level: 2 -*- */

var async = require('async');
var naan = require('naan');
var _ = require('underscore');
var util = require('util');

module.exports = {
  /**
   * Save or update an object. If a new object is passed, the callback will
   * return a copy of that object with the <options.id> key set to the id of the
   * created object.
   */
  save: function(obj, callback) {
    if (Array.isArray(obj)) {
      return this.throttleMap(obj, this.node.save, callback);
    }
    
    var id = this._getId(obj, true);

    if (!this._isValidId(id)) {
      if (typeof obj !== 'object') {
        return callback(new Error("No data to save"));
      }

      this.node._create(obj, callback);
    } else {
      this.node._update(obj, callback);
    }
  },

  /**
   * Create a new object. Maps to /node.
   */
  _create: function(obj, callback) {
    var op = this.operation('node', obj);
    this.call(op, function(err, body, location) {
      if (err) {
        return callback(err);
      }

      var result = _.clone(obj);
      result[this.options.id] = this._extractId(location);

      callback(null, result);
    });
  },

  /**
   * Save the properties of an object. Maps to PUT /node/{id}/properties.
   */
  _update: function(obj, callback) {
    var id = this._getId(obj, true);
    if (!this._isValidId(id)) {
      return callback(new Error("Invalid ID"));
    }

    var untouchedObj = _.clone(obj);
    if (untouchedObj[this.options.id] != null) {
      delete untouchedObj[this.options.id];
    }

    var endpoint = util.format('%s/properties', this._nodeRoot(id));
    var op = this.operation(endpoint, 'PUT', untouchedObj);
    this.call(op, function(err, body, response) {
      if (err) {
        return callback(err);
      } else {
        return callback(null, obj);
      }
    });
  },

  /**
   * Read an object's properties. Maps to GET node/{id}/properties.
   */
  read: function(id, callback) {
    if (Array.isArray(id)) {
      return this.throttleMap(id, this.node.read, callback);
    }

    id = this._getId(id);
    if (!this._isValidId(id)) {
      return callback(new Error("Invalid ID"));
    }

    var endpoint = util.format('%s/properties', this._nodeRoot(id));
    var op = this.operation(endpoint);
    this.call(op, function(err, body) {
      if (err) {
        return callback(err);
      } else {
        body[this.options.id] = id;
        return callback(null, body);
      }
    });
  },

  /**
   * Delete an object. Maps to DELETE node/{id}
   * If force is truthy, delete node and all its relations.
   */
  delete: function(id, force, callback) {
    if (typeof force === 'function') {
      callback = force;
      force = false;
    }

    if (Array.isArray(id)) {
      return this.throttleMap(id, this.node.delete, callback);
    }

    id = this._getId(id);
    if (!this._isValidId(id)) {
      return callback(new Error("Invalid ID"));
    }

    if (!force) {
      var endpoint = this._nodeRoot(id);
      var op = this.operation(endpoint, 'DELETE');
      this.call(op, function(err) { callback(err) });
    } else {
      this.query([
        'START node=node({root})',
        'MATCH node-[rel?]->()',
        'DELETE node, rel'
      ].join(' '), {root: id}, function(err) { callback(err) });
    }
  },

  /**
   * Relate objects together. maps to POST node/{first}/relationships
   */
  relate: function(startNode, type, endNode, properties, callback) {
    this.rel.create(startNode, type, endNode, properties, callback);
  },

  /**
   * Retrieve a set of relationships for the given node. Optionally specify the
   * direction and relationship name.
   *
   * `direction` must be one of "all", "in" or "out".
   *
   * db.relationships(obj|id, [direction, [relationshipName]], callback)
   */
  relationships: function(obj, direction, relName, callback) {
    if (typeof direction === 'function') {
      callback = direction;
      direction = 'all';
      relName = '';
    } else {
      if (typeof relName === 'function') {
        callback = relName;
        relName = '';
      }

      if (typeof direction !== 'string') {
        return callback(new Error('Invalid direction - ' + direction));
      } else if (typeof relName !== 'string') {
        return callback(new Error('Invalid relationship name - ' + relName));
      }

      direction = direction.toLowerCase();
      if (['in', 'all', 'out'].indexOf(direction) === -1) {
        return callback(new Error('Invalid direction - ' + direction));
      }
    }

    if (Array.isArray(obj)) {
      var args = [ direction, relName ];
      var rels = naan.ecurry(this.node.relationships, args, [1, 2]);
      return this.throttleMap(obj, rels, callback);
    }

    var objId = this._getId(obj);

    if (!this._isValidId(objId)) {
      callback(new Error("Invalid ID"));
    }

    var nodeRoot = this._nodeRoot(objId);
    var endpoint = util.format('%s/relationships/%s', nodeRoot, direction);
    if (relName) {
      endpoint += "/" + relName;
    }
    var op = this.operation(endpoint);
    var self = this;
    this.call(op, function(err, rels) {
      if (err) {
        callback(err);
      } else {
        rels = rels.map(function(rel) {
          return self._createRelationshipObject(rel);
        });
        callback(null, rels);
      }
    });
  },

  /**
   * Perform a query based on a predicate. The predicate is translated to a
   * cypher query.
   */
  find: function(predicate, any, start, callback) {
    if (typeof any === 'function') {
      callback = any;
      any = false;
      start = 'node(*)';
    } else if (typeof start === 'function') {
      callback = start;
      start = 'node(*)';
    }
    
    if (Array.isArray(predicate)) {
      var finder = naan.ncurry(this.node.find, any, 2);
      return this.throttleMap(predicate, finder, callback);
    } 

    if (typeof predicate !== 'object') {
      callback(new Error('Invalid Predicate'));
    }

    var matchers = Object.keys(predicate).reduce(function(matchers, key) {
      return matchers.push(util.format(" (n.%s! = {%s}) ", key, key)), matchers;
    }, []);

    var cypher = [ 
      "START n = " + start + " WHERE", 
      matchers.join(any ? "or" : "and"), 
      "RETURN n"
    ].join(" ");

    var self = this;
    this.query(cypher, predicate, callback);
  }
}
