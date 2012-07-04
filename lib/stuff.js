/* -*- Mode: Javascript; js-indent-level: 2 -*- */

var async = require('async');

// Run given functions in a parallel queue.  Each element of the
// "params" array will be passed to fn once, as the only parameter.
function throttle(params, fn, done) {
  var dead = false;
  var results = [];
  var q = async.queue(function worker(task, callback) {
    if (dead) return;
    fn(task, callback);
  }, 10);
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
}

module.exports = {
  throttle: throttle
}
