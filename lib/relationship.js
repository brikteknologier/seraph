var async = require('async');
var naan = require('naan');
var _ = require('underscore');
var util = require('util');

module.exports = {
  read: function(options, id, callback) {
    if (Array.isArray(id)) {
      var boundReadLink = naan.b.curry(this, this.rel.read, options);
      return async.map(id, boundReadLink, callback);
    }

    id = this._getId(options, id);

    if (id == null) {
      return callback(new Error("Invalid ID"));
    }

    var endpoint = util.format('relationship/%d', id);
    var op = this.operation(options, endpoint);
    this.call(options, op, function(err, linkData) {
      if (err) {
        callback(err);
      } else {
        callback(null, this._createLinkObject(options, linkData));
      }
    });
  }
};