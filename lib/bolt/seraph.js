'use strict';
var url = require('url');
var neo4j = require('neo4j-driver').v1;
var nodeify = require('ascallback');
module.exports = function(opts) {
  if (!opts || !opts.nodeify) return new Seraph(opts);
  var handler = {
    get: function(target, name) {
      if (name in target && typeof target[name] == 'function') {
        return function() {
          var args = [].slice.call(arguments, 0, arguments.length - 1);
          var cb = arguments[arguments.length - 1];
          nodeify(target[name].apply(target, args), cb);
        }
      } else {
        return target[name]
      }
    }
  }
  var db = new Seraph(opts);
  return new Proxy(db, handler);
}
class Seraph {
  constructor(opts) {
    if (!opts) opts = 'bolt://neo4j:neo4j@localhost';
    if (typeof opts != 'object') {
      var server = url.parse(opts);
      opts = {
        user: server.auth ? server.auth.split(':')[0] : 'neo4j',
        pass: server.auth ? server.auth.split(':')[1] : 'neo4j'
      };
      delete server.auth;
      opts.server = url.format(server);
    }

    opts.user = opts.user || 'neo4j';
    opts.pass = opts.pass || 'neo4j';   
    opts.server = opts.server || 'bolt://localhost';
    opts.id = opts.id || 'id';

    this.opts = opts;
    this.driver = opts.driver ||  neo4j.driver(opts.server, neo4j.auth.basic(opts.user, opts.pass));
    this.label = opts.label === false ? false : true;
    this.unboxInts = opts.unboxInts === false ? false : true;
  }

  _unboxInt(i) {
    return this.unboxInts ? i.toNumber() : i;
  }

  _unboxAll(obj) {
    Object.keys(obj).forEach((key) => {
      if (neo4j.isInt(obj[key])) obj[key] = this._unboxInt(obj[key]);
    });
    return obj;
  }

  _getId(obj, requireData) {
    return new Promise((resolve, reject) => {
      var id;
      if (requireData) {
        id = typeof obj == 'object' ? obj[this.opts.id] : undefined;
      } else {
        id = typeof obj == 'object' ? obj[this.opts.id] : obj;
      }

      if (id != null) id = parseInt(id, 10);
      if (isNaN(id) || id == null) return reject(new Error("Invalid ID"));
      resolve(neo4j.int(id));
    });
  }

  _processResult(result) {
    var records = result.records;
    var assemble = (field) => {
      console.log(this);
      if (typeof field != 'object' || !field) return field;
      else if (neo4j.isInt(field)) return this._unboxInt(field);
      else if (field instanceof neo4j.types.Node) {
        var obj = field.properties;
        if (this.opts.label) obj.labels = field.labels;
        obj[this.opts.id] = this._unboxInt(field.identity);
        return this._unboxAll(obj);
      }
      else if (field instanceof neo4j.types.Relationship) {
        field.start = this._unboxInt(field.start);
        field.end = this._unboxInt(field.end);
        field[this.opts.id] = this._unboxInt(field.identity);
        if (this.opts.id != 'identity') delete field.identity;
        field.properties = this._unboxAll(field.properties);
        return field;
      }
      else return field;
    }
    return records.map((record) => {
      console.log(record);
      if (record.keys.length == 1) return assemble(record._fields[0]);
      else {
        var row = {};
        Object.keys(record).forEach((key) => {
          row[key] = assemble(record._fields[record._fieldLookup[key]])
        });
        return row;
      }
    });
  }

  _selectSingleOrNull(results) {
    return results.length > 0 ? results[0] : null;
  }

  _session() {
    return this.session || this.driver.session();
  }

  _endSession(sess) {
    return (passthrough) => {
      if (this.session != sess) sess.close();
      return passthrough;
    }
  }

  read(node, prop) {
    var sess = this._session();
    return this._getId(node, false, true)
      .then((id) => {
        return sess.run(`
          MATCH (node) WHERE id(node) = {id}
          RETURN ${prop ? "node." + prop : "node"}
        `, {id});
      })
      .then(this._endSession(sess))
      .then((result) => this._processResult(result))
      .then(this._selectSingleOrNull)
  }
}
