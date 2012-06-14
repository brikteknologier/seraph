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
      return async.map(obj, naan.b.curry(this, this.save, options), callback);
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

      var result = _.extend({}, obj);
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

    obj = _.extend({}, obj);
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
      return async.map(id, naan.b.curry(this, this.read, options), callback);
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
      var del = naan.b.curry(this, this.node.delete, options);
      return async.map(id, del, callback);
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
   * Link two objects together. maps to POST node/{first}/relationships
   */
  link: function(options, first, relationshipName, second, props, callback) {
    if (typeof props === 'function') {
      callback = props;
      props = null;
    }

    if (Array.isArray(first)) {
      var args = [ options, relationshipName, second, props ];
      var linker = naan.b.ecurry(this, this.node.link, args, [0, 2, 3, 4]);
      return async.map(first, linker, callback);
    } else if (Array.isArray(second)) {
      var args = [ options, first, relationshipName, props ];
      var linker = naan.b.ecurry(this, this.node.link, args, [0, 1, 2, 4]);
      return async.map(second, linker, callback);
    }
    
    var firstId = this._getId(options, first),
        secondId = this._getId(options, second);

    if (firstId == null || secondId == null) {
      return callback(new Error("Invalid ID"));
    }

    var request = {
      to: this._location(options, 'node', secondId),
      type: relationshipName,
    };

    if (props) {
      request['data'] = props;
    }

    var endpoint = util.format('node/%d/relationships', firstId);
    var op = this.operation(options, endpoint, 'POST', request);
    this.call(options, op, function(err, linkData) {
      if (err) {
        callback(err);
      } else {
        callback(null, this._createLinkObject(options, linkData));
      }
    });
  },

  /**
   * Retrieve a set of links/relationships for the given node. Optionally
   * specify the direction and link/relationship name.
   *
   * `direction` must be one of "all", "in" or "out".
   *
   * db.links(obj|id, [direction, [linkName]], callback)
   */
  links: function(options, obj, direction, linkName, callback) {
    if (typeof direction === 'function') {
      callback = direction;
      direction = 'all';
      linkName = '';
    } else {
      if (typeof linkName === 'function') {
        callback = linkName;
        linkName = '';
      }

      if (typeof direction !== 'string') {
        return callback(new Error('Invalid direction - ' + direction));
      } else if (typeof linkName !== 'string') {
        return callback(new Error('Invalid link name - ' + linkName));
      }

      direction = direction.toLowerCase();
      if (['in', 'all', 'out'].indexOf(direction) === -1) {
        return callback(new Error('Invalid direction - ' + direction));
      }
    }

    if (Array.isArray(obj)) {
      var args = [ options, direction, linkName ];
      var findLinks = naan.b.ecurry(this, this.node.links, args, [0, 2, 3]);
      return async.map(obj, findLinks, callback);
    }

    obj = this._getId(options, obj);

    if (obj == null) {
      callback(new Error("Invalid ID"));
    }

    var endpoint = util.format('node/%d/relationships/%s', obj, direction);
    if (linkName) {
      endpoint += "/" + linkName;
    }
    var op = this.operation(options, endpoint);
    var self = this;
    this.call(options, op, function(err, links) {
      if (err) {
        callback(err);
      } else {
        links = links.map(function(link) {
          return self._createLinkObject(options, link);
        });
        callback(null, links);
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
      return async.map([predicate, finder], callback);
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
    this.query(options, cypher, predicate, function(err, results) {
      if (err) {
        return callback(err);
      }

      var parsedResults = results.map(function(node) {
        return self._createNodeObject(options, node.n);
      });

      callback(null, parsedResults);
    });
  }
}