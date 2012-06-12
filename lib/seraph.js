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
  
  // Copy all the fns from the main seraph, and always supply the first arg as
  // our `options` variable. 
  naan.ecrock(this, seraph, naan.curry(naan.b.curry, seraph), this.options);
}

var seraph = {
  db: function(options) {
    return new Seraph(options);
  },

  /**
   * Function to create a HTTP request to the rest service. Path is relative to
   * the service endpoint - `node` gets transformed to
   * `<options.endpoint>/data/db/node`.
   * 
   * If `method` is not supplied, it will default GET, unless `data` is
   * supplied, in which case it will default to 'POST'.
   *
   * seraph#call(opts, path, [method='get'], [data], callback);
   */
  call: function(options, path, method, data, callback) {
    // Get args in the right order
    if (['undefined', 'function'].indexOf(typeof data) !== -1) {
      callback = data;
      if (typeof method === 'string') {
        data = null;
      }
    } 
    if (['object', 'undefined', 'function'].indexOf(typeof method) !== -1) {
      if (typeof method === 'function') {
        callback = method;
        method = undefined;
      } 
      
      if (typeof method === 'object') {
        data = method;
        method = 'POST';
      } else {
        data = null;
        method = 'GET';
      }
    }
    
    // Ensure callback is callable. Throw instead of calling back if none.
    if (typeof callback !== 'function') {
      callback = function(err) {
        if (err) throw err;
      }
    }

    // Ensure we have a usable HTTP verb.
    if (typeof method !== 'string') { 
      callback(new Error('Invalid HTTP Verb - ' + method));
    } else {
      method = method.toUpperCase();
    }

    var requestOpts = {
      uri: options.endpoint + '/db/data/' + path,
      method: method,
      headers: { 'Accept': 'application/json' }
    };

    if (data) requestOpts.json = data;
    callback = _.bind(callback, this);
    
    // Allows mocking
    (this._request || request)(requestOpts, function(err, response, body) {
      if (err) {
        callback(err);
      } else if (response.statusCode < 200 || response.statusCode >= 300) {;
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
   * Returns the url to an entity given an id
   */
  _location: function(options, type, id) {
    return util.format('%s/data/db/%s/%d', options.endpoint, type, id);
  },

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

      this._create(options, obj, callback);
    } else {
      this._update(options, obj, callback);
    }
  },

  /**
   * Create a new object. Maps to /node.
   */
  _create: function(options, obj, callback) {
    this.call(options, 'node', obj, function(err, body, response) {
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
    this.call(options, endpoint, 'PUT', obj, function(err, body, response) {
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
    if (!id) {
      return callback(new Error("Invalid ID"));
    }

    var endpoint = util.format('node/%d/properties', id);
    this.call(options, endpoint, function(err, body) {
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
   * TODO: delete all relationships as well
   */
  delete: function(options, id, callback) {
    if (Array.isArray(id)) {
      return async.map(id, naan.b.curry(this, this.delete, options), callback);
    }

    id = this._getId(options, id);
    if (!id) {
      return callback(new Error("Invalid ID"));
    }

    var endpoint = util.format('node/%d', id);
    this.call(options, endpoint, 'DELETE', function(err) {
      callback(err);
    });
  },

  /**
   * Create a relationship link object from the given link data returned from
   * the neo4j server
   */
  _createLinkObject: function(options, linkData) {
    var linkObj = { 
      start: this._extractId(linkData.start),
      end: this._extractId(linkData.end),
      type: linkData.type,
      properties: linkData.data
    };

    linkObj[options.id] = this._extractId(linkData.self);

    return linkObj;
  },

  /** 
   * Create a node object from the given node data return from the neo4j server
   */
  _createNodeObject: function(options, nodeData) {
    var nodeObj = nodeData.data || {};
    nodeObj[options.id] = this._extractId(nodeData.self);

    return nodeObj;
  },

  readLink: function(options, id, callback) {
    if (Array.isArray(id)) {
      var boundReadLink = naan.b.curry(this, this.readLink, options);
      return async.map(id, boundReadLink, callback);
    }

    id = this._getId(options, id);

    if (!id) {
      return callback(new Error("Invalid ID"));
    }

    var endpoint = util.format('relationship/%d', id);
    this.call(options, endpoint, function(err, linkData) {
      if (err) {
        callback(err);
      } else {
        callback(null, this._createLinkObject(options, linkData));
      }
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
      var linker = naan.b.ecurry(this, this.link, args, [0, 2, 3, 4]);
      return async.map(first, linker, callback);
    } else if (Array.isArray(second)) {
      var args = [ options, first, relationshipName, props ];
      var linker = naan.b.ecurry(this, this.link, args, [0, 1, 2, 4]);
      return async.map(second, linker, callback);
    }
    
    var firstId = this._getId(options, first),
        secondId = this._getId(options, second);

    if (!firstId || !secondId) {
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
    this.call(options, endpoint, 'POST', request, function(err, linkData) {
      if (err) {
        callback(err);
      } else {
        callback(null, this._createLinkObject(options, linkData));
      }
    });
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
    this.call(options, 'cypher', query, function(err, result) {
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

    this.queryRaw(options, query, params, function(err, result) {
      if (err) {
        return callback(err);
      }

      var namedResults = result.data.map(function(row) {
        return result.columns.reduce(function(rowObj, columnName, columnIndex) {
          rowObj[columnName] = row[columnIndex];
          return rowObj;
        }, {});
      });

      callback(null, namedResults);
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
      var finder = naan.b.ecurry(this, this.find, [options, any], [0, 2]);
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

};

// Returns a version of `seraph` with enforced context
var ref = {};
module.exports = naan.ecrock(ref, seraph, naan.rcurry(_.bind, ref));
