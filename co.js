var seraph = require('./lib/seraph');
module.exports = function() {
  var db = seraph.apply(null, [].slice.call(arguments));
  console.log(db);
};
