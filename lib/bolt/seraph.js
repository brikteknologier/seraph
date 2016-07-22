'use strict';
var url = require('url');
module.exports = class Seraph {
  constructor(opts) {
    if (!opts) opts = 'bolt://neo4j:neo4j@localhost:7474';
    if (typeof opts != 'object') {
      var server = url.parse(opts);
      var opts = {
        user: server.auth ? server.auth.split(':')[0] : 'neo4j'
        pass: server.auth ? server.auth.split(':')[1] : 'neo4j'
      };
      delete server.auth;
      opts.server = url.format(server);
    }

  }
}
