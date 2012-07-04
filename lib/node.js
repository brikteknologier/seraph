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
  save: function(options, obj, callback) {
    if (Array.isArray(obj)) {
      var fn = naan.b.curry(this, this.save, options);
      return this._throttleMap(obj, fn, callback);
    }
    
    var id = this._getId(options, obj, true);

    if (id == null) {
      if (typeof obj !== 'object') {
        return callback(new Error("No data to save"));
      }

      this.node._create(options, obj, callback);
    } else {
      this.node._update(options, obj, callback);
    }
  },

  /**
   * Create a new object. Maps to /node.
   */
  _create: function(options, obj, callback) {
    var op = this.operation(options, 'node', obj);
    this.call(options, op, function(err, body, response) {
      if (err) {
        return callback(err);
      }

      var result = _.clone(obj);
      result[options.id] = this._extractId(response.headers.location);

      callback(null, result);
    });
  },

  /**
   * Save the properties of an object. Maps to PUT /node/{id}/properties.
   */
  _update: function(options, obj, callback) {
    var id = this._getId(options, obj, true);
    if (!id) {
      return callback(new Error("Invalid ID"));
    }

    obj = _.clone(obj);
    var endpoint = util.format('node/%d/properties', id);
    var op = this.operation(options, endpoint, 'PUT', obj);
    this.call(options, op, function(err, body, response) {
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
  read: function(options, id, callback) {
    if (Array.isArray(id)) {
      var fn = naan.b.curry(this, this.read, options);
      return this._throttleMap(id, fn, callback);
    }

    id = this._getId(options, id);
    if (id == null) {
      return callback(new Error("Invalid ID"));
    }

    var endpoint = util.format('node/%d/properties', id);
    var op = this.operation(options, endpoint);
    this.call(options, op, function(err, body) {
      if (err) {
        return callback(err);
      } else {
        body[options.id] = id;
        return callback(null, body);
      }
    });
  },

  /**
   * Delete an object. Maps to DELETE node/{id}
   * TODO: delete all relationships as well (optionally?)
   */
  delete: function(options, id, callback) {
    if (Array.isArray(id)) {
      var fn = naan.b.curry(this, this.node.delete, options);
      return this._throttleMap(id, fn, callback);
    }

    id = this._getId(options, id);
    if (id == null) {
      return callback(new Error("Invalid ID"));
    }

    var endpoint = util.format('node/%d', id);
    var op = this.operation(options, endpoint, 'DELETE');
    this.call(options, op, function(err) {
      callback(err);
    });
  },

  /**
   * Relate objects together. maps to POST node/{first}/relationships
   */
  relate: function(options, startNode, type, endNode, properties, callback) {
    this.rel.create(options, startNode, type, endNode, properties, callback);
  },

  /**
   * Retrieve a set of relationships for the given node. Optionally specify the
   * direction and relationship name.
   *
   * `direction` must be one of "all", "in" or "out".
   *
   * db.relationships(obj|id, [direction, [relationshipName]], callback)
   */
  relationships: function(options, obj, direction, relName, callback) {
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
      var args = [ options, direction, relName ];
      var rels = naan.b.ecurry(this, this.node.relationships, args, [0, 2, 3]);
      return this._throttleMap(obj, rels, callback);
    }

    obj = this._getId(options, obj);

    if (obj == null) {
      callback(new Error("Invalid ID"));
    }

    var endpoint = util.format('node/%d/relationships/%s', obj, direction);
    if (relName) {
      endpoint += "/" + relName;
    }
    var op = this.operation(options, endpoint);
    var self = this;
    this.call(options, op, function(err, rels) {
      if (err) {
        callback(err);
      } else {
        rels = rels.map(function(rel) {
          return self._createRelationshipObject(options, rel);
        });
        callback(null, rels);
      }
    });
  },

  /**
   * Perform a query based on a predicate. The predicate is translated to a
   * cypher query.
   */
  find: function(options, predicate, any, callback) {
    if (typeof any === 'function') {
      callback = any;
      any = false;
    }

    if (Array.isArray(predicate)) {
      var finder = naan.b.ecurry(this, this.node.find, [options, any], [0, 2]);
      return this._throttleMap(predicate, finder, callback);
    } 

    if (typeof predicate !== 'object') {
      callback(new Error('Invalid Predicate'));
    }

    var matchers = Object.keys(predicate).reduce(function(matchers, key) {
      return matchers.push(util.format(" (n.%s! = {%s}) ", key, key)), matchers;
    }, []);

    var cypher = [ 
      "START n = node(*) WHERE", 
      matchers.join(any ? "or" : "and"), 
      "RETURN n"
    ].join(" ");

    var self = this;
    this.query(options, cypher, predicate, callback);
  }
}