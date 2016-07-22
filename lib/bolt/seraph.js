'use strict';
var url = require('url');
var neo4j = require('neo4j-driver');
module.exports = class Seraph {
  constructor(opts) {
    if (!opts) opts = 'bolt://neo4j:neo4j@localhost';
    if (typeof opts != 'object') {
      var server = url.parse(opts);
      var opts = {
        user: server.auth ? server.auth.split(':')[0] : 'neo4j'
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
    this.driver = opts.driver ||  neo4j.v1.driver(opts.server, neo4j.v1.auth.basic(opts.user, opts.pass));
    this.session = opts.session || neo4j.v1.session();
  }

  _getId(obj, requireData) {
    var id;
    if (requireData) {
      id = typeof obj == 'object' ? obj[this.opts.id] : undefined;
    } else {
      id = typeof obj == 'object' ? obj[this.opts.id] : obj;
    }

    if (id != null) id = parseInt(id, 10);
    return id;
  }
