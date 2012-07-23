/* -*- Mode: Javascript; js-indent-level: 2 -*- */

var naan = require('naan');
var async = require('async');
var request = require('request');
var _ = require('underscore');
var util = require('util');
var jsonStream = require('JSONStream');

var defaultOptions = {
    // Location of the server
    endpoint: 'http://localhost:7474'

    // The key to use when inserting an id into objects. 
  , id: 'id'

    // Whether streaming is used
  , streaming: true
}, optionKeys = Object.keys(defaultOptions);

// Bind all functions of an object to a context
var bindAllTo = function(context, all) {
  return _.functions(all).reduce(function(bound, key) {
    bound[key] = all[key].bind(context);
    return bound;
  }, _.clone(all));
}

function Seraph(options) {
  if (typeof options === 'string') {
    options = { endpoint: options };
  };
  this.options = _.extend({}, defaultOptions, options);

  _.bindAll(this);

  this.node = bindAllTo(this, require('./node'));
  this.rel = bindAllTo(this, require('./relationship'));
  var indexGeneric = bindAllTo(this, require('./index'));

  // Alias & curry seraph.index on seraph.node & seraph.rel
  this.node.index = naan.curry(indexGeneric.add, 'node');
  this.rel.index = naan.curry(indexGeneric.add, 'relationship');
  naan.ecrock(this.node.index, indexGeneric, naan.curry, 'node');
  naan.ecrock(this.rel.index, indexGeneric, naan.curry, 'relationship');

  _.extend(this, this.node);
}

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
Seraph.prototype.operation = function(path, method, data) {
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
};

/**
 * Like `async.map`, run `fn` once per element of `params`.  Unlike
 * `async.map`, throttle this through an `async.queue`.
 * `done(err, data)` will be called on completion, where `data`
 * is the result from each of the function calls, in the exact same
 * order as in the `params` array.
 */
Seraph.prototype.throttleMap = function(params, fn, done) {
  if (params.length === 0)
    done();

  var dead = false;
  var results = [];
  var q = async.queue(function worker(task, callback) {
    if (dead) return;
    fn(task, callback);
  }, 1);
  q.drain = function () {
    if (dead) return;
    done(null, results);
  };
  params.forEach(function (param, idx) {
    q.push(param, function (err, data) {
      if (dead) return;
      if (err) {
        dead = true;
        done(err);
      }
      results[idx] = data;
    });
  });
};

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
 * seraph#call(operation, callback);
 */
Seraph.prototype.call = function(operation, callback) {
  // Ensure callback is callable. Throw instead of calling back if none.
  if (typeof callback !== 'function') {
    callback = function(err) {
      if (err) throw err;
    }
  }

  var requestOpts = {
    uri: this.options.endpoint + '/db/data/' + operation.to,
    method: operation.method,
    headers: { 'Accept': 'application/json' }
  };

  if (operation.body) requestOpts.json = operation.body;
  callback = _.bind(callback, this);
  
  // Allows injection for testing.
  var createRequest = this._request || request;

  if (this.options.streaming) {
    createRequest(requestOpts)
     .on('response', function(response) {
        var parser = jsonStream.parse([]);
        if (response.statusCode < 200 || response.statusCode >= 300) {
          parser
            .on('data', callback)
            .on('error', function() {
              callback(response.statusCode);
            });
          response.pipe(parser);
        } else {
          parser
            .on('data', naan.curry(callback, undefined))
            .on('error', callback);
          response.pipe(parser);
        }
      })
      .on('error', callback);
  } else {
    createRequest(requestOpts, function(err, response, body) {
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
  }
};

/**
 * If `obj` is an object, return the value of key <options.id>. Otherwise,
 * return `obj`.
 *
 * If `requireData` is truthy, `obj` must be an object, otherwise undefined is
 * returned.
 */
Seraph.prototype._getId = function(obj, requireData) {
  if (requireData) {
    return typeof obj === 'object' ? obj[this.options.id] : undefined;
  } else {
    return typeof obj === 'object' ? obj[this.options.id] : obj;
  }
};

/**
 * Take the end off a url and parse it as an int
 */
Seraph.prototype._extractId = function(location) {
  var matches = location.match(/\/(\d+)$/);
  if (!matches) {
    return null;
  }

  return parseInt(matches[1], 10);
};

/**
 * Infer whether or not the given object is a node
 */
Seraph.nodeFlags = [ 
  'outgoing_relationships',
  'incoming_relationships',
  'all_relationships',
  'data',
  'properties',
  'self'
];
Seraph.prototype._isNode = function(node) {
  if (!node || typeof node !== 'object') {
    return false;
  }

  var inNode = node.hasOwnProperty.bind(node);
  return Seraph.nodeFlags.every(inNode) && 
         typeof node.data === 'object';
};

/**
 * Infer whether or not the given object is a relationship
 */
Seraph.relationshipFlags = [
  'start',
  'data',
  'self',
  'properties',
  'end'
];
Seraph.prototype._isRelationship = function(rel) {
  if (!rel || typeof rel !== 'object') {
    return false;
  }

  var inRelationship = rel.hasOwnProperty.bind(rel);
  return Seraph.relationshipFlags.every(inRelationship) &&
         typeof rel.data === 'object';
};

/**
 * Returns the url to an entity given an id
 */
Seraph.prototype._location = function(type, id) {
  return util.format('%s/data/db/%s/%d', this.options.endpoint, type, id);
};

/**
 * Create a relationship object from the given relationship data returned from
 * the neo4j server
 */
Seraph.prototype._createRelationshipObject = function(relationshipData) {
  var relationshipObj = { 
    start: this._extractId(relationshipData.start),
    end: this._extractId(relationshipData.end),
    type: relationshipData.type,
    properties: relationshipData.data
  };

  relationshipObj[this.options.id] = this._extractId(relationshipData.self);

  return relationshipObj;
};

/** 
 * Create a node object from the given node data return from the neo4j server
 */
Seraph.prototype._createNodeObject = function(nodeData) {
  var nodeObj = nodeData.data || {};
  nodeObj[this.options.id] = this._extractId(nodeData.self);

  return nodeObj;
};

  /**
   * Perform a cypher query. Maps to POST cypher
   */
Seraph.prototype.queryRaw = function(query, params, callback) {
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
  var op = this.operation('cypher', query);
  this.call(op, function(err, result) {
    if (err) {
      callback(err);
    } else {
      callback(null, result);
    }
  });
};

/**
 * Perform a cypher query and map the columns and results together.
 */
Seraph.prototype.query = function(query, params, callback) {
  if (typeof params !== 'object') {
    if (typeof params === 'function') {
      callback = params;
    }
    params = {};
  }

  var self = this;
  this.queryRaw(query, params, function(err, result) {
    if (err) {
      return callback(err);
    }
    
    var namedResults = result.data.map(function(row) {
      return result.columns.reduce(function(rowObj, columnName, columnIndex) {
        var resultItem = row[columnIndex];
        function extractAttributes(item) {
          if (self._isNode(item))
            return self._createNodeObject(item);
          else if (self._isRelationship(item))
            return self._createRelationshipObject(item);
          return item;
        }
        if (Array.isArray(resultItem))
          rowObj[columnName] = resultItem.map(extractAttributes);
        else
          rowObj[columnName] = extractAttributes(resultItem);
        
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
};

module.exports = function(options) {
  return new Seraph(options);
};
