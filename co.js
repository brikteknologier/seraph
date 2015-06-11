var seraph = require('./lib/seraph');
var thunkify = require('thunkify');
var excludes = [
  'batch',
  'operation'
];

module.exports = function() {
  var db = seraph.apply(null, [].slice.call(arguments));
  return function wrapObject(obj) {
    Object.keys(obj).forEach(function(key) {
      if (typeof obj[key] == 'function' && excludes.indexOf(key) == -1 && key[0] != '_') {
        obj[key] = thunkify(obj[key]);
      } else if (typeof obj[key] == 'object') {
        obj[key] = wrapObject(obj[key]);
      }
    }); 
    return obj;
  }(db);
};
