var naan = require('naan');
var request = require('request');
var _ = require('underscore');

var defaultOptions = {
    // Location of the server
    endpoint: 'http://localhost:7474'

    // The key to use when inserting an id into objects. 
  , id: 'id'
}, optionKeys = Object.keys(defaultOptions);

function Seraph(options) {
  // TODO: check if options is a url and handle that.
  this.options = options;
  
  // Copy all the fns from the main seraph, and always supply the first arg as
  // our `options` variable. 
  naan.ecrock(this, seraph, naan.curry, this.options);
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
      } else if (typeof method === 'object') {
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
      uri: options.endpoint + path,
      method: method,
      headers: { 'Accept': 'application/json' }
    };

    if (data) requestOpts.json = data;
    
    this.call._request(requestOpts, function(err, response, body) {
      if (err) {
        callback(err);
      } else if (response.statusCode < 200 || response.statusCode >= 300) {
        callback(new Error(body || response.statusCode));
      } else {
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
   * Save or update an object. If a new object is passed, the callback will
   * return a copy of that object with the <options.id> key set to the id of the
   * created object.
   */
  save: function(options, obj, callback) {
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

      var location = response.headers.location;
      var locationComponents = location.match(/\/node\/(\d+)$/);
      
      var result = _.extend({}, obj);
      result[options.id] = parseInt(locationComponents[1]);

      callback(null, result);
    });
  }

  /**
   * Save the properties of an object. Maps to PUT /node/{id}/properties.
   */
  _update: function(options, obj, callback) {
    var id = this._getId(options, obj, true);
    if (!id) {
      return callback(new Error("No ID given"));
    }

    obj = _.extend({}, obj);
    var endpoint = util.format('node/%d/properties');
    this.call(options, endpoint, 'PUT', obj, function(err, body, response) {
      if (err) {
        return callback(err);
      } else {
        return callback(null, obj);
      }
    });
  }
};

// Allows us to insert a mock for unit testing.
seraph.call._request = request;

// Returns a version of `seraph` with enforced context
var ref = {};
module.exports = naan.ecrock(ref, seraph, naan.rcurry(_.bind, ref));
