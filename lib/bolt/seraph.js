'use strict';
const url = require('url');
const neo4j = require('neo4j-driver').v1;
const _ = require('underscore');
const asCallback = require('ascallback');

const proxyFilter = function(db) {
  if (db.options.nodeify) {
    db = new Proxy(db, {
      get: function(target, name) {
        if (name in target && typeof target[name] == 'function') {
          return function() {
            if (typeof arguments[arguments.length - 1] != 'function') {
              return target[name].apply(target, arguments);
            }
            const args = [].slice.call(arguments, 0, arguments.length - 1);
            const cb = arguments[arguments.length - 1];
            
            return asCallback(target[name].apply(target, args), cb);
          }
        } else {
          return target[name]
        }
      }
    });
  }

  var recursiveProxy = (obj) => {
    return new Proxy(obj, {
      get: (_, k) => {
        if (!obj[k]) return undefined;
        if (typeof obj[k] == 'object') return recursiveProxy(obj[k]);
        return db[obj[k]].bind(db);
      }
    });
  }

  return new Proxy(db, {
    get: (target, key) => {
      if (target[key]) return target[key];
      var proxy = proxyMap[key];
      if (!proxy) return undefined;
      if (typeof proxy == 'object') return recursiveProxy(proxy);
      else return db[proxy].bind(db);
    }
  })
}

var seraph = module.exports = (opts) => proxyFilter(new Seraph(opts))

var proxyMap = {
  node: {
    save: 'save',
    find: 'find',
    delete: 'delete',
    read: 'read',
    relate: 'relate',
    relationships: 'relationships',
    label: 'label',
    removeLabel: 'removeLabel',
    nodesWithLabel: 'nodesWithLabel',
    readLabels: 'readLabels'
  },
  constraints: {
    uniqueness: {
      create: 'createUniquenessConstraint',
      createIfNone: 'createUniquenessConstraint',
      drop: 'dropUniquenessConstraint'
    }
  },
  index: {
    create: 'createIndex',
    drop: 'dropIndex'
  },
  rel: {
    read: 'readRel',
    create: 'createRel',
    update: 'updateRel',
    delete: 'deleteRel'
  }
}

class Seraph {
  constructor(options) {
    if (!options) options = 'bolt://neo4j:neo4j@localhost';
    if (typeof options != 'object') {
      var server = url.parse(options);
      options = {
        user: server.auth ? server.auth.split(':')[0] : 'neo4j',
        pass: server.auth ? server.auth.split(':')[1] : 'neo4j'
      };
      delete server.auth;
      options.server = url.format(server);
    }

    options.user = options.user || 'neo4j';
    options.pass = options.pass || 'neo4j';   
    options.server = options.server || 'bolt://localhost';
    options.id = options.id || 'id';

    this.options = options;
    this.driver = options.driver ||  neo4j.driver(options.server, neo4j.auth.basic(options.user, options.pass));
    this.options.unboxInts = options.unboxInts === false ? false : true;
  }

  _unboxInt(i) {
    return this.options.unboxInts ? i.toNumber() : i;
  }

  _unboxAll(obj) {
    Object.keys(obj).forEach((key) => {
      if (neo4j.isInt(obj[key])) obj[key] = this._unboxInt(obj[key]);
    });
    return obj;
  }

  _getId(obj, requireData) {
    return new Promise((resolve, reject) => {
      if (neo4j.isInt(obj)) return resolve(obj);
      var id;
      if (requireData) {
        id = typeof obj == 'object' ? obj[this.options.id] : undefined;
      } else {
        id = typeof obj == 'object' ? obj[this.options.id] : obj;
      }

      if (id != null) id = parseInt(id, 10);
      if (isNaN(id) || id == null) return reject(new Error("Invalid ID"));
      resolve(neo4j.int(id));
    });
  }

  _processResult(result, singleOrNull) {
    var records = result.records;
    var assemble = (field) => {
      if (Array.isArray(field)) return field.map(assemble);
      else if (typeof field != 'object' || !field) return field;
      else if (neo4j.isInt(field)) return this._unboxInt(field);
      else if (field instanceof neo4j.types.Node) {
        var obj = field.properties;
        if (this.options.label) obj.labels = field.labels;
        obj[this.options.id] = this._unboxInt(field.identity);
        return this._unboxAll(obj);
      }
      else if (field instanceof neo4j.types.Relationship) {
        field.start = this._unboxInt(field.start);
        field.end = this._unboxInt(field.end);
        field[this.options.id] = this._unboxInt(field.identity);
        if (this.options.id != 'identity') delete field.identity;
        field.properties = this._unboxAll(field.properties);
        return field;
      }
      else if (field instanceof neo4j.types.UnboundRelationship ||
               field instanceof neo4j.types.PathSegment ||
               field instanceof neo4j.types.Path) {
        // no processing for these types yet.
        return field;
      }
      else {
        return _.reduce(field, (obj, val, key) => {
          obj[key] = assemble(val);
          return obj;
        }, {});
      }
    }
    var processed = records.map((record) => {
      var row = {};
      record.keys.forEach((key) => {
        row[key] = assemble(record._fields[record._fieldLookup[key]])
      });
      if (record.keys.length == 1 && typeof row[record.keys[0]] == 'object') {
        return row[record.keys[0]];
      } else {
        return row;
      }
    });
    if (singleOrNull) processed = this._selectSingleOrNull(processed);
    return processed;
  }

  _selectSingleOrNull(results) {
    return results.length > 0 ? results[0] : null;
  }

  _session() {
    return this.options.session || this.driver.session();
  }

  _endSession(sess) {
    return (passthrough) => {
      if (this.options.session != sess) sess.close();
      return passthrough;
    }
  }

  _aggregates(key) {
    return Array.isArray(key) || key instanceof Promise;
  }

  _aggregate(fn, arr, argnum, allargs) {
    if (arr instanceof Promise) {
      return arr.then((result) => {
        if (this._aggregates(result)) return this._aggregate(fn, result, argnum, allargs);
        allargs[argnum] = result;
        return fn.apply(this, allargs);
      });
    }

    var sess = this.options.session ? this : this.session();

    var flatten = false;
    sess = new Proxy(sess, { get: (target, key) => {
      if (key == '_aggregate') flatten = true;
      return target[key];
    } });

    
    var promises = arr.map(arg => {
        allargs[argnum] = arg;
        return fn.apply(sess, allargs);
      });
    var aggregated = Promise.all(promises)
      .then(result => {
        return flatten ? _.flatten(result, true) : result;
      });

    if (!this.options.session) {
      aggregated = aggregated
        .then((r) => { return sess.close(), r })
        .catch((e) => {
          sess.close();
          return new Promise((_, r) => r(e))
        });
    }

    return _.extend(aggregated, _.object(_.range(arr.length), promises));
  }

  _treatParams(params) {
    var pr = (v) => { return new Promise(r => r(v)) };
    var treatObj = obj => {
      if (typeof obj == 'number') return pr(obj % 1 === 0 ? neo4j.int(obj) : obj);
      else if (obj instanceof Promise) return obj.then(val => treatObj(val));
      else if (neo4j.isInt(obj)) return pr(obj);
      else if (Array.isArray(obj)) return Promise.all(obj.map(treatObj));
      else if (typeof obj == 'object' && obj !== null) 
        return Promise.all(_.map(obj, (v,k) => { return treatObj(v).then(v => [k,v]) }))
          .then(tuples => _.object(tuples))
      else return pr(obj);
    }
    return params ? treatObj(params) : pr(params);
  }

  _run(query, params) {
    var sess = this._session();
    return this._treatParams(params)
      .then(params => sess.run(query, params))
      .then(this._endSession(sess))
      .catch((e) => {
        this._endSession(sess)();
        return new Promise((_, r) => r(e));
      });
  }

  session() { 
    var sess = this.driver.session();
    var sessSeraph = seraph(_.clone(this.options));
    sessSeraph.options.session = sess;
    return sessSeraph;
  }

  close() {
    this.options.session && this.options.session.close();
  }

  transaction(aggregateResults) {
    var sess = this._session();
    var txn = sess.beginTransaction();
    
    var txnSeraph = new Seraph(_.clone(this.options));
    if (aggregateResults) {
      var ops = [];
      txnSeraph.commit = () => {
        return Promise.all(ops).then(result => {
          return txn.commit().then(() => result)
        })
      }
      txnSeraph = new Proxy(txnSeraph, { get: (target, key) => {
        if (typeof target[key] != 'function') return target[key];
        return function() {
          var result = target[key].apply(target, arguments);
          if (result instanceof Promise) {
            var idx = ops.push(result) - 1;
            Object.defineProperty(result, 'toString', {
              enumerable: false, configurable: false, writable: false,
              value: () => idx });
            Object.defineProperty(result, 'valueOf', {
              enumerable: false, configurable: false, writable: false,
              value: () => idx });
          }
          return result;
        }
      }});
    } else {
      txnSeraph.commit = () => txn.commit()
    }

    txnSeraph.rollback = () => txn.rollback()
    txnSeraph.options.session = txn;
    txnSeraph.isTransaction = txnSeraph.isBatch = true;
    
    return proxyFilter(txnSeraph);
  }
  
  batch() {
    return this.transaction(true);
  }

  query(cypher, params) {
    return this._run(cypher, params)
      .then((result) => this._processResult(result));
  }

  find(predicate, any, label) {
    if (this._aggregates(predicate)) return this._aggregate(this.find, predicate, 0, arguments);

    if (typeof any != 'boolean') {
      label = any;
      any = false;
    }

    var matchers = _.map(predicate, (_, key) => `node.${key} = {${key}}`);
    var label = label ? `:\`${label}\`` : '';

    return this.query(`
      MATCH (node${label})
      ${ matchers.length ? 'WHERE' : '' } 
      ${ matchers.join(any ? ' OR ' : ' AND ') }
      RETURN node
    `, predicate);
  }

  read(node, prop) {
    if (this._aggregates(node)) return this._aggregate(this.read, node, 0, arguments);
    return this._getId(node)
      .then((id) => {
        return this._run(`
          MATCH (node) WHERE id(node) = {id}
          RETURN ${prop ? "node." + prop : "node"}
        `, {id});
      })
      .then((result) => {
        result = this._processResult(result, true)
        if (prop && result != null) result = result["node." + prop];
        return result;
      })
  }

  save(node, label) {
    if (this._aggregates(node)) return this._aggregate(this.save, node, 0, arguments);
    if (arguments[2] != null) return this._saveProperty(node, arguments[1], arguments[2]);

    if (label) {
      if (!Array.isArray(label)) label = [label];
      label = label.map(l => `SET node:${l}`).join(' ');
    } else {
      label = '';
    }

    return this._getId(node)
      .then(id => {
        var props = _.omit(node, this.options.id);
        return this._run(`
          MATCH (node) WHERE id(node) = {id}
          SET node = {props} ${label}
          RETURN node
        `, { id, props });
      })
      .catch(() => {
        return this._run(`
          CREATE (node) 
          SET node = {node} ${label}
          RETURN node
        `, {node})
      })
      .then((result) => this._processResult(result, true))
  }

  _saveProperty(node, key, value) {
    return this._getId(node)
      .then(id => {
        return this._run(`
          MATCH (node) WHERE id(node) = {id}
          SET node.${key} = {value}
          RETURN node
        `, { id, value });
      })
      .then((result) => this._processResult(result, true))
  }

  delete(node, detach) {
    if (this._aggregates(node)) return this._aggregate(this.delete, node, 0, arguments);
    if (detach != null && typeof detach != 'boolean') return this.remove(node, detach);

    return this._getId(node)
      .then(id => {
        return this._run(`
          MATCH (node) WHERE id(node) = {id}
          ${detach ? 'detach' : ''} DELETE node
        `, { id })
      })
      .then(() => true);
  }

  remove(node, prop) {
    if (this._aggregates(node)) return this._aggregate(this.remove, node, 0, arguments);
    return this._getId(node)
      .then(id => {
        return this._run(`
          MATCH (node) WHERE id(node) = {id}
          REMOVE node.${prop}
          RETURN node
        `, { id })
      })
      .then((result) => this._processResult(result, true))
  }

  label(node, labels, replace) {
    if (this._aggregates(node)) return this._aggregate(this.label, node, 0, arguments);
    if (!Array.isArray(labels)) labels = [labels];
    
    var sets = labels.map(l => `SET node:\`${l}\``)
    
    var id = this._getId(node)
    
    if (replace) {
      id = id.then(id => {
        return this.readLabels(id).then(labels => { return {labels, id} })
      })
    } else id = id.then(id => { return { id } })

    return id.then(args => {
        var query = `MATCH (node) WHERE id(node) = {id} `;
        query += `SET node${labels.map(l => `:\`${l}\``).join('')}`;
        if (replace && args.labels.length > 0) 
          query += `REMOVE node${args.labels.map(l => `:\`${l}\``).join('')}`;
        return this._run(query, {id:args.id});
      })
      .then(() => true);
  }

  nodesWithLabel(label) {
    return this.query(`MATCH (n:${label}) RETURN n`)
  }

  readLabels(node) {
    if (this._aggregates(node)) {
      return this._aggregate(this.readLabels, node, 0, arguments).then(l => _.uniq(_.flatten(l)));
    }

    return this._getId(node)
      .then(id => this._run(`MATCH (node) WHERE id(node) = {id} RETURN labels(node)`, { id }))
      .catch(() => this._run(`MATCH (node) WITH labels(node) as n UNWIND n as l RETURN collect(DISTINCT l)`))
      .then((result) => {
        var rows = this._processResult(result)
        return rows[0] || [];
      })
  }

  removeLabel(node, labels) {
    if (this._aggregates(node)) return this._aggregate(this.removeLabel, node, 0, arguments);
    if (!Array.isArray(labels)) labels = [labels];
    labels = labels.map(l => `:\`${l}\``);
    return this._getId(node)
      .then(id => {
        return this._run(`
          MATCH (node) WHERE id(node) = {id}
          REMOVE node${labels}
        `, { id });
      })
      .then(() => true);
  }

  relationships(node, direction, type) {
    if (this._aggregates(node)) return this._aggregate(this.relationships, node, 0, arguments);
    if (direction == null) direction = 'all';
    
    type = type == null ? '' : `:\`${type}\``;
    var query = `${direction == 'in' ? '<' : ''}-[rel${type}]-${direction == 'out' ? '>' : ''}`;

    return this._getId(node)
      .then(id => {
        return this.query(`
          MATCH (node)${query}(to)
          WHERE id(node) = {id}
          RETURN rel
        `, { id });
      })
  }

  readRel(rel) {
    if (this._aggregates(rel)) return this._aggregate(this.readRel, rel, 0, arguments);
    return this._getId(rel)
      .then(id => {
        return this._run(`
          MATCH (a)-[rel]-(b)
          WHERE id(rel) = {id}
          RETURN rel
        `, { id })
      })
      .then((result) => this._processResult(result, true))
  }

  relate() { return this.createRel.apply(this, arguments) }
  createRel(startNode, type, endNode, properties) {
    if (this._aggregates(startNode)) return this._aggregate(this.createRel, startNode, 0, arguments);
    if (this._aggregates(endNode)) return this._aggregate(this.createRel, endNode, 2, arguments);
    properties = properties || {};

    return Promise.all([ this._getId(startNode), this._getId(endNode) ])
      .then(ids => {
        return this._run(`
          MATCH (start), (end)
          WHERE id(start) = {startId} AND id(end) = {endId}
          CREATE (start)-[rel:\`${type}\`]->(end)
          SET rel = {properties}
          RETURN rel
        `, { startId: ids[0], endId: ids[1], properties });
      })
      .then((result) => this._processResult(result, true))
  }

  updateRel(rel) {
    if (this._aggregates(rel)) return this._aggregate(this.updateRel, rel, 0, arguments);
    if (arguments[2] != null) return this._updateRelProperty.apply(this, arguments);
    return this._getId(rel)
      .then(id => {
        return this._run(`
          MATCH (a)-[rel]-(b)
          WHERE id(rel) = {id}
          SET rel = {props}
          RETURN rel
        `, { id, props: rel.properties });
      })
      .then((result) => this._processResult(result, true))
  }

  _updateRelProperty(rel, key, value) {
    return this._getId(rel)
      .then(id => {
        return this._run(`
          MATCH (a)-[rel]-(b)
          WHERE id(rel) = {id}
          SET rel.\`${key}\` = {value}
          RETURN rel
        `, { id, value });
      })
      .then((result) => this._processResult(result, true))
  }

  deleteRel(rel) {
    if (this._aggregates(rel)) return this._aggregate(this.deleteRel, rel, 0, arguments);
    return this._getId(rel)
      .then(id => {
        return this._run(`
          MATCH (a)-[rel]-(b)
          WHERE id(rel) = {id}
          DELETE rel
        `, { id });
      })
      .then(() => true)
  }

  createUniquenessConstraint(label, key) {
    return this._run(`CREATE CONSTRAINT ON (n:\`${label}\`) ASSERT n.\`${key}\` IS UNIQUE`)
      //compat. query returns nothing anyway
      .then(() => { return { type: 'UNIQUENESS', label: label, property_keys: [key] } });
  }

  dropUniquenessConstraint(label, key) {
    return this._run(`DROP CONSTRAINT ON (n:\`${label}\`) ASSERT n.\`${key}\` IS UNIQUE`)
      //compat. query returns nothing anyway
      .then(() => { return { type: 'UNIQUENESS', label: label, property_keys: [key] } });
  }

  createIndex(label, key) {
    return this._run(`CREATE INDEX ON :\`${label}\`(\`${key}\`)`)
      .then(() => true);
  }
  
  dropIndex(label, key) {
    return this._run(`DROP INDEX ON :\`${label}\`(\`${key}\`)`)
      .then(() => true);
  }
}
