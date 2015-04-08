var counter = (function() {
  var count = Date.now();
  return function() {
    return ++count;
  };
})();

var uniqn = function() { return 'identity' + counter(); };

module.exports = {
  uniqn: uniqn
};
