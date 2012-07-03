/* -*- Mode: Javascript; js-indent-level: 2 -*- */

var naan = require('naan');
var async = require('async');
var request = require('request');
var _ = require('underscore');
var util = require('util');

var defaultOptions = {
    // Location of the server
    endpoint: 'http://localhost:7474'

    // The key to use when inserting an id into objects. 
  , id: 'id'
}, optionKeys = Object.keys(defaultOptions);

function inferOptions(options) {
  if (typeof options === 'string') {
    options = { endpoint: options };
  }

  return _.extend({}, defaultOptions, options);
}

function Seraph(options) {
  this.options = inferOptions(options);

  // Copy all the methods from `seraph` to `context`, currying the `options`
  // variable into them. Works recursively, so the namespaced stuff gets curried
  // as well. 
  naan.recursiveExtendGroupCurry(this, seraph, naan.curry, this.options);

  // Since we jam the index functions on a function, naan can't detect this.
  // We have to curry them ourselves.
  naan.ecrock(this.node.index, seraph.node.index, naan.curry, this.options);
  naan.ecrock(this.rel.index, seraph.rel.index, naan.curry, this.options);
  naan.ecrock(this.index, seraph.index, naan.curry, this.options);
}

var seraph = {
  db: function(options) {
    return new Seraph(options);
  },

  /**
   * Create an operation that can later be passed to call().
   *
   * Path is relative to the service endpoint - `node` gets
   * transformed to `<options.endpoint>/data/db/node`.
   * 
   * If `method` is not supplied, it will default GET, unless `data`
   * is supplied, in which case it will default to 'POST'.
   *
   * seraph#operation(opts, path, [method='get'], [data]);
   */
  operation: function(options, path, method, data) {
    // Get args in the right order
    if (typeof data === 'undefined') {
      data = null;
    }
    if (typeof method === 'object') {
      data = method;
      method = 'POST';
    }
    if (typeof method === 'undefined') {
      method = 'GET';
    }

    // Ensure we have a usable HTTP verb.
    if (typeof method !== 'string') {
      throw new Error('Invalid HTTP Verb - ' + method);
    } else {
      method = method.toUpperCase();
    }

    return {
      'method': method,
      'to'    : path,
      'body'  : data
    };
  },

  /**
   * Function to call an HTTP request to the rest service.
   * 
   * Requires an operation object of form:
   *   { method: 'PUT'|'POST'|'GET'|'DELETE'
   *   , to    : path,
   *   , body  : object }
   *
   * Operation objects are easily created by seraph#operation.
   *
   * seraph#call(opts, operation, callback);
   */
  call: function(options, operation, callback) {
    // Ensure callback is callable. Throw instead of calling back if none.
    if (typeof callback !== 'function') {
      callback = function(err) {
        if (err) throw err;
      }
    }

    var requestOpts = {
      uri: options.endpoint + '/db/data/' + operation.to,
      method: operation.method,
      headers: { 'Accept': 'application/json' }
    };

    if (operation.body) requestOpts.json = operation.body;
    callback = _.bind(callback, this);
    
    // Allows mocking
    (this._request || request)(requestOpts, function(err, response, body) {
      if (err) {
        callback(err);
      } else if (response.statusCode < 200 || response.statusCode >= 300) {
        callback(body || response.statusCode);
      } else {
        if (typeof body === 'string') {
          try {
            body = JSON.parse(body);
          } catch (e) {
            return callback(e);
          }
        }

        callback(null, body, response);
      }
    });
  },

  /**
   * If `obj` is an object, return the value of key <options.id>. Otherwise,
   * return `obj`.
   *
   * If `requireData` is truthy, `obj` must be an object, otherwise undefined is
   * returned.
   */
  _getId: function(options, obj, requireData) {
    if (requireData) {
      return typeof obj === 'object' ? obj[options.id] : undefined;
    } else {
      return typeof obj === 'object' ? obj[options.id] : obj;
    }
  },

  /**
   * Take the end off a url and parse it as an int
   */
  _extractId: function(location) {
    var matches = location.match(/\/(\d+)$/);
    if (!matches) {
      return null;
    }

    return parseInt(matches[1], 10);
  },

  /**
   * Infer whether or not the given object is a node
   */
  _isNode: function(options, node) {
    var flags = [ 'outgoing_relationships', 'incoming_relationships',
      'all_relationships', 'data', 'properties', 'self' ];

    var inNode = node.hasOwnProperty.bind(node);
    return  typeof node === 'object' && 
            flags.every(inNode) && 
            typeof node.data === 'object';
  },

  /**
   * Infer whether or not the given object is a relationship
   */
  _isRelationship: function(options, rel) {
    var flags = [ 'start', 'data', 'self', 'properties', 'end' ];

    var inRelationship = rel.hasOwnProperty.bind(rel);
    return  typeof rel === 'object' &&
            flags.every(inRelationship) &&
            typeof rel.data === 'object';
  },

  /**
   * Returns the url to an entity given an id
   */
  _location: function(options, type, id) {
    return util.format('%s/data/db/%s/%d', options.endpoint, type, id);
  },

  /**
   * Create a relationship object from the given relationship data returned from
   * the neo4j server
   */
  _createRelationshipObject: function(options, relationshipData) {
    var relationshipObj = { 
      start: this._extractId(relationshipData.start),
      end: this._extractId(relationshipData.end),
      type: relationshipData.type,
      properties: relationshipData.data
    };

    relationshipObj[options.id] = this._extractId(relationshipData.self);

    return relationshipObj;
  },

  /** 
   * Create a node object from the given node data return from the neo4j server
   */
  _createNodeObject: function(options, nodeData) {
    var nodeObj = nodeData.data || {};
    nodeObj[options.id] = this._extractId(nodeData.self);

    return nodeObj;
  },

  /**
   * Perform a cypher query. Maps to POST cypher
   */
  queryRaw: function(options, query, params, callback) {
    if (typeof query !== 'string') {
      return callback(new Error('Invalid Query'));
    }
    if (typeof params !== 'object') {
      if (typeof params === 'function') {
        callback = params;
      }
      params = {};
    }

    query = { query: query, params: params };
    var op = this.operation(options, 'cypher', query);
    this.call(options, op, function(err, result) {
      if (err) {
        callback(err);
      } else {
        callback(null, result);
      }
    });
  },

  /**
   * Perform a cypher query and map the columns and results together.
   */
  query: function(options, query, params, callback) {
    if (typeof params !== 'object') {
      if (typeof params === 'function') {
        callback = params;
      }
      params = {};
    }

    var self = this;
    this.queryRaw(options, query, params, function(err, result) {
      if (err) {
        return callback(err);
      }
      
      var namedResults = result.data.map(function(row) {
        return result.columns.reduce(function(rowObj, columnName, columnIndex) {
          var resultItem = row[columnIndex];
          function extractAttributes(item) {
            if (self._isNode(options, item)) {
              return self._createNodeObject(options, item);
            } else if (self._isRelationship(options, item)) {
              return self._createRelationshipObject(options, item);
            } else {
              return item;
            }
          }
          if (Object.prototype.toString.apply(resultItem)
              === '[object Array]') {
            for (var i = 0; i < resultItem.length; i++) {
              resultItem[i] = extractAttributes(resultItem[i]);
            }
          } else {
            resultItem = extractAttributes(resultItem);
          }

          rowObj[columnName] = resultItem;
          return rowObj;
        }, {});
      });

      if (result.columns.length === 1) {
        namedResults = namedResults.map(function(namedResult) {
          return namedResult[result.columns[0]];
        });
      }

      callback(null, namedResults);
    });
  }
};

var bindToRoot = function(obj) {
  return _.functions(obj).reduce(function(boundObj, key) {
    boundObj[key] = obj[key].bind(seraph);
    return boundObj;
  }, _.clone(obj));
}

_.bindAll(seraph);

// Add namespaced functions
seraph.node = bindToRoot( require('./node') );
seraph.rel = bindToRoot( require('./relationship') );

// Have to create the root index function before we can put it into place
var indexfns = bindToRoot( require('./index') );

// Alias & curry seraph.index on seraph.node & seraph.rel
seraph.node.index = naan.ncurry(indexfns.add, 'node', 1);
seraph.rel.index = naan.ncurry(indexfns.add, 'relationship', 1);

naan.ecrock(seraph.node.index, indexfns, naan.ncurry, 'node', 1);
naan.ecrock(seraph.rel.index, indexfns, naan.ncurry, 'relationship', 1);

// Drop all `node` functions onto the base
_.extend(seraph, seraph.node);

module.exports = seraph;
