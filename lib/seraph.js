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
  
  // db.call(path, [method='get'], [data], callback);
  call: function(options, path, method, data, callback) {
    if (typeof method !== 'string') {
      if (typeof method === 'undefined' && arguments.length === 2) {
        callback = function(){};
      } else if (typeof method === 'object') {
        if (typeof data !== 'function' && arguments.length === 3) {
          callback = function(){};
        } else {
          callback = data;
        }
        data = method;
      } else {
        callback(new Error('Invalid HTTP method'));
      }
      method = 'get'
    }
  }
};

// Returns a version of `seraph` with enforced context
module.exports = naan.crock(seraph, naan.rcurry(_.bind, seraph));
