'use strict';
var url = require('url');
var neo4j = require('neo4j-driver').v1;
var _ = require('underscore');
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
    return this.opts.session || this.driver.session();
  }

  _endSession(sess) {
    return (passthrough) => {
      if (this.opts.session != sess) sess.close();
      return passthrough;
    }
  }

  _aggregate(fn, arr, argnum, allargs) {
    var sess = this.session();
    return Promise.all(arr.map(arg => {
      allargs[argnum] = arg;
      return fn.apply(sess, allargs);
    }))
    .then((r) => { return sess.close(), r })
    .catch((e) => {
      sess.close();
      return new Promise((_, r) => r(e))
    });
  }

  session() { 
    var sess = this.driver.session();
    var sessSeraph = new Seraph(this.opts);
    sessSeraph.session = sess;
    return sessSeraph;
  }

  close() {
    this.opts.session && this.opts.session.close();
  }

  read(node, prop) {
    if (Array.isArray(node)) return this._aggregate(this.read, node, 0, arguments);
    var sess = this._session();
    return this._getId(node)
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

  save(node, label) {
    if (Array.isArray(node)) return this._aggregate(this.save, node, 0, arguments);
    if (arguments[2] != null) return this._saveProperty(node, arguments[1], arguments[2]);

    var sess = this._session();
    if (label) {
      if (!Array.isArray(label)) label = [label];
      label = label.map(l => `SET node:${l}`).join(' ');
    } else {
      label = '';
    }

    return this._getId(node)
      .then(id => {
        var props = _.omit(node, this.opts.id);
        return sess.run(`MATCH (node) WHERE id(node) = {id}
                         SET node = {props} ${label}
                         RETURN node`, { id, props });
      })
      .catch(() => {
        return sess.run(`CREATE (node) 
                         SET node = {node} ${label}
                         RETURN node`, {node})
      })
      .then(this._endSession(sess))
      .then((result) => this._processResult(result))
      .then(this._selectSingleOrNull)
  }

  _saveProperty(node, key, value) {
    var sess = this._session();
    return this._getId(node)
      .then(id => {
        return sess.run(`MATCH (node) WHERE id(node) = {id}
                         SET node.${key} = {value}
                         RETURN node`, { id, value });
      })
      .then(this._endSession(sess))
      .then((result) => this._processResult(result))
      .then(this._selectSingleOrNull)
  }

  nodesWithLabel(label) {
    var sess = this._session();
    return sess.run(`MATCH (n:${label}) RETURN n`)
      .then(this._endSession(sess))
      .then((result) => this._processResult(result));
  }

  readLabels(node) {
    var sess = this._session();
    return this._getId(node)
      .then(id => sess.run(`MATCH (node) WHERE id(node) = {id} RETURN labels(node)`, { id }))
      .then(this._endSession(sess))
      .then((result) => {
        var rows = this._processResult(result)
        return rows[0] || [];
      })
  }

}
