var seraph = require('./lib/seraph');
var thunkify = require('thunkify');
var excludes = [
  'batch',
  'operation'
];

module.exports = function(opts) {
  var db = seraph(opts);
  return function wrapObject(obj) {
    var copy = {};
    Object.keys(obj).forEach(function(key) {
      if (typeof obj[key] == 'function' && excludes.indexOf(key) == -1 && key[0] != '_') {
        copy[key] = thunkify(obj[key]);
      } else if (typeof obj[key] == 'object') {
        copy[key] = wrapObject(obj[key]);
      } else {
        copy[key] = obj[key];
      }
    }); 
    return copy;
  }(db);
};
