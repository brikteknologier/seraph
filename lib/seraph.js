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
  naan.crock(this, naan.curry(naan.bound.curry, this), this.options);
}

var seraph = {
  db: function(options) {
    return new Seraph(options);
  },

  // seraph#call(opts, path, [method='get'], [data], callback);
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
      } else if (response.statusCode != 200) {
        callback(new Error(body || response.statusCode));
      } else {
        callback(body);
      }
    });
  }
};

// Allows us to insert a mock for unit testing.
seraph.call._request = request;

// Returns a version of `seraph` with enforced context
var ref = {};
module.exports = naan.ecrock(ref, seraph, naan.rcurry(_.bind, ref));
