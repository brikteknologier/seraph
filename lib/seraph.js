var naan = require('naan');
var async = require('async');
var request = require('request');
var _ = require('underscore');
var assert = require('assert');
var util = require('util');

var defaultOptions = {
  // Location of the server
  server: 'http://localhost:7474',

  // datbase endpoint
  endpoint: '/db/data',

  // The key to use when inserting an id into objects. 
  id: 'id',

  // default username and password for authentication
  user: 'neo4j',
  pass: 'neo4j'
}, optionKeys = Object.keys(defaultOptions);

// Bind all functions of an object to a context (recursively)
var bindAllTo = function(context, all) {
  return Object.keys(all).reduce(function(bound, key) {
    if (typeof all[key] == 'object') bound[key] = bindAllTo(context, all[key]);
    else if (typeof all[key] == 'function') bound[key] = all[key].bind(context);
    else bound[key] = all[key];
    return bound;
  }, {});
}

function Seraph(options) {
  if (typeof options === 'string') {
    options = { server: options };
  };
  this.options = _.extend({}, defaultOptions, options);
  this.options.server = this.options.server
    .replace(/\/$/, '');        // remove trailing /
  this.options.endpoint = this.options.endpoint
    .replace(/\/$/, '')         // remove trailing /
    .replace(/^([^\/])/, '/$1'); // add leading /

  _.bindAll.apply(_, [this].concat(_.functions(this)));

  this.node = bindAllTo(this, require('./node'));
  this.relationship = this.rel = bindAllTo(this, require('./relationship'));
  this.index = bindAllTo(this, require('./index'));
  this.constraints = bindAllTo(this, require('./constraints'));
  var legacyindexGeneric = bindAllTo(this, require('./legacyindex'));


  // Alias & curry seraph.index on seraph.node & seraph.rel
  this.node.legacyindex = naan.curry(legacyindexGeneric.add, 'node');
  this.rel.legacyindex = naan.curry(legacyindexGeneric.add, 'relationship');
  naan.ecrock(this.node.legacyindex, legacyindexGeneric, naan.curry, 'node');
  naan.ecrock(this.rel.legacyindex, legacyindexGeneric, naan.curry, 'relationship');

  _.extend(this, this.node);
}

/**
 * Create an operation that can later be passed to call().
 *
 * Path is relative to the service endpoint - `node` gets
 * transformed to `<options.server><options.endpoint>/node`.
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
    'endpoint': this.options.endpoint,
    'to'    : path,
    'body'  : data
  };
};

// returns a new batch if the context was not already that of a batch - prevents
// batch nesting which can break intra-batch referencing
Seraph.prototype._safeBatch = function() {
  return this.isBatch ? this : this.batch();
};

// similarly, this takes a BatchSeraph and only commits it if the calling context 
// is not that of a batch.
Seraph.prototype._safeBatchCommit = function(txn, callback) {
  if (this.isBatch) {
    if (callback) this.commitCallbacks.push(callback);
  } else {
    txn.commit(callback);
  }
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
  var authString = new Buffer(this.options.user + ':' + this.options.pass).toString('base64');
  var endpoint = operation.endpoint || this.options.endpoint;
  var requestOpts = {
    uri: this.options.server + endpoint + '/' + operation.to,
    method: operation.method,
    headers: { 
      Accept: 'application/json',
      Authorization: 'Basic ' + authString
    }
  };
  

  if (operation.body) requestOpts.json = operation.body;
  callback = _.bind(callback, this);
  
  // allow mocking of "request". you can mock it by reassigning this._request to
  // something with the same API as the "request" module.
  var createRequest = this._request || request;

  createRequest(requestOpts, function(err, response, body) {
    if (err) {
      callback(err);
    } else if (response.statusCode < 200 || response.statusCode >= 300) {
      if (typeof body == 'string') {
        try {
          body = JSON.parse(body);
        } catch (error) {}
      }
      // Pass on neo4j error
      var error;
      if (typeof body == "object" && body.exception) {
        error = new Error(body.message);
        error.neo4jError = body;
        error.neo4jException = body.exception;
        error.neo4jStacktrace = body.stacktrace;
        if (body.cause) error.neo4jCause = body.cause;
      } else {
        if (typeof body == 'object' && body.errors) {
          error = new Error(body.errors[0].message);
        } else {
          error = new Error(body || response.statusCode);
        }
        error.code = response.statusCode;
        error.response = response;
      }
      error.statusCode = response.statusCode;
      callback(error);
    } else {
      if (operation.method === 'GET' && response.statusCode === 204) {
        var error = new Error("no content");
        error.statusCode = response.statusCode;
        return callback(error);
      }

      _.defer(function() {
        if (body === '') body = null;
        else if (typeof body === 'string') {
          try {
            body = JSON.parse(body);
          } catch (e) {
            return callback(e);
          }
        }

        callback(null, body, response.headers.location);
      });
    }
  });
};

/**
 * If `obj` is an object, return the value of key <options.id>. Otherwise,
 * return `obj`.
 *
 * If `requireData` is truthy, `obj` must be an object, otherwise undefined is
 * returned.
 */
Seraph.prototype._getId = function(obj, requireData) {
  var id;
  if (requireData) {
    id = typeof obj == 'object' ? obj[this.options.id] : undefined;
  } else if (this._isBatchId(obj)) {
    return obj;
  } else {
    id = typeof obj == 'object' ? obj[this.options.id] : obj;
  }

  if (id != null) id = parseInt(id, 10);
  return id;
};

Seraph.prototype._isValidId = function(id) {
  return !isNaN(parseInt(id, 10)) || this._isBatchId(id);
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

Seraph.prototype._isBatchId = function(id) {
  return this.isBatch && typeof id == 'string' && id.match(/^{\d+}$/);
};

Seraph.prototype._nodeRoot = function(id) {
  return this._isBatchId(id) ? id : 'node/' + id;
};

Seraph.prototype._relRoot = function(id) {
  return this._isBatchId(id) ? id : 'relationship/' + id;
};

/**
 * Returns the url to an entity given an id
 */
Seraph.prototype._location = function(type, id) {
  if (this._isBatchId(id)) return id;
  return util.format('%s%s/%s/%d',
                     this.options.server, this.options.endpoint, type, id);
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
  if(!nodeObj[this.options.id]) nodeObj[this.options.id] = this._extractId(nodeData.self);

  return nodeObj;
};

// change password
Seraph.prototype.changePassword = function(newPassword, callback) {
  var op = {
    method: 'POST',
    endpoint: '/user',
    to: this.options.user + '/password',
    body: { password: newPassword }
  };
  var self = this;
  this.call(op, function(err, result) {
    if (err) return callback(err);
    self.options.pass = newPassword;
    callback();
  });
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
          if (self._isNode(item)) {
            return self._createNodeObject(item);
          } else if (self._isRelationship(item)) {
            return self._createRelationshipObject(item);
          } else if (item === Object(item)) {
            var temp = {};
            Object.keys(item).forEach(function(key) {
              temp[key] = extractAttributes(item[key])
            })
            return temp;
          } else {
            return item;
          }
        }
        if (Array.isArray(resultItem))
          rowObj[columnName] = resultItem.map(extractAttributes);
        else
          rowObj[columnName] = extractAttributes(resultItem);
        
        return rowObj;
      }, {});
    });

    if (namedResults.length > 0) {
      var resultsAreObjects = typeof namedResults[0][result.columns[0]] == 'object';
      if (result.columns.length === 1 && resultsAreObjects) {
        namedResults = namedResults.map(function(namedResult) {
          return namedResult[result.columns[0]];
        });
      } else if (namedResults.length == 1 && !resultsAreObjects) {
        namedResults = namedResults[0];
      }
    }

    callback(null, namedResults);
  });
};

var globalCounter = 0;
function wrapForBatchFormat(id) { return '{' + id + '}' };
function BatchSeraphId(id, refersTo, batch) {
  if (Array.isArray(refersTo)) {
    refersTo = refersTo.map(wrapForBatchFormat);
    refersTo.forEach(function(id, index) {
      this[index] = id;
    }.bind(this));
  } else {
    refersTo = wrapForBatchFormat(refersTo);
  }

  this.id = id;
  this.refersTo = refersTo;
  this.batch = batch;
}
Object.defineProperty(BatchSeraphId.prototype, 'valueOf', {
  enumerable: false, configurable: false, writable: false,
  value: function() { return this.id }
});
Object.defineProperty(BatchSeraphId.prototype, 'toString', {
  enumerable: false, configurable: false, writable: false,
  value: function() { return this.id } 
});

function BatchSeraph(parentSeraph) {
  var self = this;
  var uniq = Date.now() + ++globalCounter;

  function isBatchId(id) {
    return id instanceof BatchSeraphId && id.batch == uniq;
  };

  function createId(id, refersTo) {
    return new BatchSeraphId(id, refersTo, uniq);
  };

  function transformBatchArgs(args) {
    return args.map(function(arg) {
      if (Array.isArray(arg)) return transformBatchArgs(arg);
      return isBatchId(arg) ? arg.refersTo : arg;
    });
  };

  function wrapFunctions(parent, target) {
    var derived = target || {};

    Object.keys(parent).forEach(function(key) {
      var valueType = typeof parent[key];

      if (valueType === 'function') {
        derived[key] = wrapFunction(parent[key]);

        if (Object.keys(parent[key]).length > 0) {
          derived[key] = wrapFunctions(parent[key], derived[key]);
        }
      } else if (valueType === 'object') {
        derived[key] = wrapFunctions(parent[key]);
      } else {
        derived[key] = parent[key];
      }
    });
    return derived;
  }

  function wrapFunction(fn) {
    fn = naan.rcurry(fn, function(err, result) {
      if (err && !self.error) self.error = err;
      self.results.push(result);
      var cb = self.callbacks.shift();
      if (cb) cb(err, result);
    });
    return function() {
      self.operationQueueStack.unshift([]);

      var args = [].slice.apply(arguments);

      if (args.length > 1 && typeof args[args.length - 1] == 'function') {
        self.callbacks.push(args.pop());
      } else {
        self.callbacks.push(null);
      }

      args = transformBatchArgs(args);

      // Context does not matter because all functions are bound upon seraph init
      fn.apply(undefined, args);

      var operationIds = _.pluck(self.operationQueueStack[0], 'id');
      self.operationQueueStack.shift();

      var operationId = operationIds.length 
        ? operationIds[0] - self.operationOffset : undefined;

      if (operationIds.length > 1) {
        self.operationOffset += operationIds.length - 1;
        operationId = createId(operationId, operationIds);
      } else if (operationId != null) {
        operationId = createId(operationId, operationIds[0]);
      }

      return operationId;
    };
  }

  this.super = new Seraph(parentSeraph.options);
  this.__proto__ = wrapFunctions(this.super);
  this.isBatch = this.super.isBatch = true;
  this.batch = undefined; // disabled nesting.
  this.processors = [];
  this.operations = [];
  this.callbacks = [];
  this.results = [];
  this.operationOffset = 0;
  this.operationQueueStack = [];
  this.commitCallbacks = [];

  this.super.call = function(operation, processor) {
    operation.id = self.operations.length;
    if (!operation.body) delete operation.body;

    self.operations.push(operation);
    self.processors.push(processor.bind(self.super));
    self.operationQueueStack[0].push(operation);
  };
  
  this.commit = function(callback) {
    if (callback) self.commitCallbacks.push(callback);
    if (self.error) {
      return self.commitCallbacks.forEach(function(callback) {
        callback(self.error);
      });
    }
    var op = parentSeraph.operation('batch', 'POST', self.operations);
    parentSeraph.call(op, function(err, results) {
      if (err) {
        while (self.callbacks.length) {
          var cb = self.callbacks.shift();
          if (cb) cb(err);
        }
        return self.commitCallbacks.forEach(function(callback) {
          callback(err);
        });
      }

      results.forEach(function(result) {
        self.processors.shift()(null, result.body || {}, result.location);
      });

      self.commitCallbacks.forEach(function(callback) {
        callback(null, self.results);
      });
    });
  };
}

Seraph.prototype.isBatch = false;

Seraph.prototype.batch = function(operations, callback) {
  if (!arguments.length) return new BatchSeraph(this);

  var batchSeraph = new BatchSeraph(this);
  operations(batchSeraph);
  batchSeraph.commit(callback);
};

module.exports = function(options) {
  return new Seraph(options);
};
