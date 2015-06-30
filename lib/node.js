var async = require('async');
var naan = require('naan');
var _ = require('underscore');
var util = require('util');

var node = module.exports = {
  /**
   * Save or update an object. If a new object is passed, the callback will
   * return a copy of that object with the <options.id> key set to the id of the
   * created object.
   */
  save: function(obj, key, val, callback) {
    if (typeof key == 'function') {
      callback = key;
      key = val = undefined;
    } else if (typeof val == 'function') {
      callback = val;
      val = undefined;
    }

    var label = undefined;
    if (key != undefined && val == undefined) label = key;

    if (label) {
      if (this.isBatch) {
        return callback(new Error("node.save with labels is not compatible with "
                + "batch mode. Use db.save & db.label instead."));
      }
      var txn = this._safeBatch();
      var node = txn.save(obj);
      if (obj[this.options.id] != null) node = txn.read(obj);
      txn.label(node, label);
      return this._safeBatchCommit(txn, function(err, result) {
        if (err) callback(err);
        else callback(null, result[node]);
      });
    } 

    if (Array.isArray(obj)) {
      var txn = this._safeBatch();
      var args = [key, val];
      async.map(obj, naan.ecurry(txn.save, args, [1, 2]), callback);
      return this._safeBatchCommit(txn);
    }
    
    var id = this._getId(obj, !key);
    
    if (!this._isValidId(id)) {
      if (typeof obj !== 'object') {
        return callback(new Error("No data to save"));
      }

      this.node._create(obj, callback);
    } else {
      if (val) this.node._updateProp(obj, key, val, callback);
      else this.node._update(obj, callback);
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

  _updateProp: function(obj, key, val, callback) {
    var id = this._getId(obj);
    if (!this._isValidId(id)) {
      return callback(new Error("Invalid ID"));
    }

    var endpoint = util.format('%s/properties/%s', this._nodeRoot(id), key);
    var op = this.operation(endpoint, 'PUT', val);
    this.call(op, function(err, body) {
      if (err) return callback(err);
      else {
        obj = _.clone(obj);
        obj[key] = val;
        callback(null, obj);
      }
    });
  },

  /**
   * Read an object's properties. Maps to GET node/{id}/properties.
   */
  read: function(id, property, callback) {
    if (typeof property == 'function') {
      callback = property;
      property = null;
    }

    if (Array.isArray(id)) {
      var txn = this._safeBatch();
      async.map(id, naan.ncurry(txn.read, property, 1), callback);
      return this._safeBatchCommit(txn);
    }

    id = this._getId(id);
    if (!this._isValidId(id)) {
      return callback(new Error("Invalid ID"));
    }

    var endpoint;
    if (!property) 
      endpoint = util.format('%s/properties', this._nodeRoot(id));
    else
      endpoint = util.format('%s/properties/%s', this._nodeRoot(id), property);
    var op = this.operation(endpoint);
    this.call(op, function(err, body) {
      if (err) {
        return callback(err);
      } else {
        if (!property) body[this.options.id] = id;
        return callback(null, body);
      }
    });
  },

  /**
   * Delete an object. Maps to DELETE node/{id}
   * If force is truthy, delete node and all its relations.
   */
  delete: function(id, force, callback) {
    var property = null;
    if (typeof force == 'function') {
      callback = force;
      force = false;
    } else if (typeof force == 'string') {
      property = force;
      force = false;
    }

    if (Array.isArray(id)) {
      var txn = this._safeBatch();
      async.map(id, naan.ncurry(txn.node.delete, force || property, 1), callback);
      return this._safeBatchCommit(txn);
    }

    var object = id;
    id = this._getId(id);
    if (!this._isValidId(id)) {
      return callback(new Error("Invalid ID"));
    }

    if (!force) {
      var endpoint;
      if (!property) endpoint = this._nodeRoot(id);
      else
        endpoint = util.format('%s/properties/%s', this._nodeRoot(id), property);
      var op = this.operation(endpoint, 'DELETE');
      this.call(op, function(err) { 
        if (!property || err || typeof object != 'object') callback(err);
        else {
          delete object[property];
          callback(null, object);
        }
      });
    } else {
      this.query([
        'START node=node({root})',
        'OPTIONAL MATCH node-[rel]-()',
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
      var txn = this._safeBatch();
      var args = [ direction, relName ];
      var rels = naan.ecurry(txn.node.relationships, args, [1, 2]);
      async.map(obj, rels, callback);
      return this._safeBatchCommit(txn);
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
  find: function(predicate, any, label, callback) {
    if (typeof any == 'function') {
      callback = any;
      any = false;
      label = null;
    } else if (typeof label == 'function') {
      callback = label;
      if (typeof any == 'string') {
        label = any;
        any = false;
      } else {
        label = null;
      }
    } 
    
    if (Array.isArray(predicate)) {
      var txn = this._safeBatch();
      var finder = naan.ecurry(txn.node.find, [any, label], [1, 2]);
      async.map(predicate, finder, callback);
      return this._safeBatchCommit(txn);
    } 

    if (typeof predicate !== 'object') callback(new Error('Invalid Predicate'));

    var matchers = Object.keys(predicate).reduce(function(matchers, key) {
      return matchers.push(util.format("n.%s = {%s}", key, key)), matchers;
    }, []);

    var cypher = [ 
      label == null ? "MATCH n" : util.format("MATCH (n:`%s`)", label),
      matchers.length > 0 ? "WHERE" : "",
      matchers.join(any ? " or " : " and "), 
      "RETURN n"
    ].join(" ");

    this.query(cypher, predicate, callback);
  },

  label: function(node, label, replace, callback) {
    if (typeof replace == 'function') {
      callback = replace;
      replace = false;
    }

    if (Array.isArray(node)) {
      var txn = this._safeBatch();
      async.map(node, naan.ecurry(txn.label, [label, replace], [1,2]), callback);
      return this._safeBatchCommit(txn);
    }
    
    var id = this._getId(node);
    if (!this._isValidId(id)) return callback(new Error("Invalid ID"));

    var endpoint = util.format('%s/labels', this._nodeRoot(id));
    var op = this.operation(endpoint, replace ? 'PUT' : 'POST', label);
    this.call(op, function(err) {
      if (err) callback(err);
      else callback();
    });
  },

  removeLabel: function(node, label, callback) {
    if (Array.isArray(node)) {
      var txn = this._safeBatch();
      async.map(node, naan.ncurry(txn.removeLabel, label, 1), callback);
      return this._safeBatchCommit(txn);
    }

    var id = this._getId(node);
    if (!this._isValidId(id)) return callback(new Error("Invalid ID"));

    var endpoint = util.format('%s/labels/%s', this._nodeRoot(id), label);
    var op = this.operation(endpoint, 'DELETE');
    this.call(op, function(err) {
      if (err) callback(err);
      else callback();
    });
  },

  nodesWithLabel: function(label, callback) {
    var endpoint = util.format('label/%s/nodes', label);
    var op = this.operation(endpoint, 'GET');
    this.call(op, function(err, nodes) {
      if (err || !nodes) return callback(err, nodes);
      nodes = nodes.map(this._createNodeObject);
      callback(null, nodes);
    });
  },

  readLabels: function(node, callback) {
    if (typeof node == 'function') {
      callback = node;
      node = undefined;
    }

    if (Array.isArray(node)) {
      var txn = this._safeBatch();
      async.map(node, txn.readLabels, function(err, allLabels) {
        if (err) return callback(err);
        callback(null, _.uniq(_.flatten(allLabels)));
      });
      return this._safeBatchCommit(txn);
    }

    var endpoint;
    if (node) {
      var id = this._getId(node);
      if (!this._isValidId(id)) return callback(new Error("Invalid ID"));
      endpoint = util.format('%s/labels', this._nodeRoot(id));
    } else {
      endpoint = 'labels';
    }
    var op = this.operation(endpoint, 'GET');
    this.call(op, function(err, labels) {
      if (err) callback(err);
      else callback(null, labels);
    });
  }
}
