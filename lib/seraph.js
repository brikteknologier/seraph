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
  this.options = seraph.readOptions(options);
  
  // Copy all the fns from the main seraph, and always supply the first arg as
  // our `options` variable. 
  naan.crock(this, naan.curry(naan.bound.curry, this), this.options);
}

var seraph = {
  db: function(options) {
    return new Seraph(options);
  },
  
  _httpRequest: request,

  // seraph#call(opts, path, [method='get'], [data], callback);
  call: function(options, path, method, data, callback) {
    // Get args in the right order
    if (typeof data === 'function') {
      callback = data;
      if (typeof method === 'string') {
        data = null;
      } else {
        data = method;
        method = 'post';
      }
    } else if (typeof method === 'function') {
      callback = method;
      method = 'get';
      data = null;
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

    if (data) requestOpts.data = data;
    
    this._httpRequest(requestOpts, function(err, response, body) {
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

// Returns a version of `seraph` with enforced context
module.exports = naan.crock(seraph, naan.rcurry(_.bind, seraph));
