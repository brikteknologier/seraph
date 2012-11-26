/* -*- Mode: Javascript; js-indent-level: 2 -*- */

/* Handles environment variables, all optional:
 * - TEST_INSTANCE_PORT : run neo4j test instance off specific port
 * - USE_DIRTY_DATABASE : use running database instead of restarting
 * - TEST_VERBOSE       : print output from neo4j startup/shutdown
 */

var path = require('path');
var fs = require('fs');
var async = require('async');
var spawn = require('child_process').spawn;
var naan = require('naan');

var neoBase = '../../db';
var neo4j = path.join(__dirname, neoBase, 'bin/neo4j');
var neo4jconf = path.join(__dirname, neoBase, 'conf/neo4j-server.properties');
var datapath = path.join(__dirname, neoBase, 'data');

var TEST_INSTANCE_PORT = parseInt(process.env.TEST_INSTANCE_PORT || '10507', 10);

var VERBOSE = process.env.TEST_VERBOSE == 'true';

var updateConf = function(port, done) {
  var readConf = naan.curry(fs.readFile, neo4jconf, 'utf8');
  var writeConf = naan.curry(fs.writeFile, neo4jconf);
  var setPorts = function(confData, callback) {
    callback(null, confData
      .replace(/(webserver\.port=)(\d+)/gi, '$1' + port)
      .replace(/(https\.port=)(\d+)/gi, '$1' + (port + 1))
    );
  }
  async.waterfall([readConf, setPorts, writeConf], done);
}

var refreshDb = function(done) {
  if (process.env.USE_DIRTY_DATABASE === 'true') {
    return done();
  }
  async.series([
    function(next) {
      spawn(neo4j, ['stop']).on('exit', next);
    },
    function(next) {
      spawn('rm', ['-rf', datapath]).on('exit', next);
    },
    function(next) {
      spawn('mkdir', ['-p', datapath]).on('exit', next);
    },
    function(next) {
      updateConf(TEST_INSTANCE_PORT, next);
    },
    function(next) {
      var n = spawn(neo4j, ['start'])
      n.stdout.on('data', function(d) { 
        if (VERBOSE)
          process.stdout.write(d.toString()); 
      })
      n.on('exit', function() {
        if (VERBOSE)
          console.log('');
        next();
      });
    }
  ], done);
};

var stopDb = function(done) {
  if (process.env.NO_STOP === 'true') {
    return done();
  }

  var n = spawn(neo4j, ['stop']);
  n.stdout.on('data', function(d) {
    if (VERBOSE)
      process.stdout.write(d.toString()); 
  });
  n.on('exit', function() {
    if (VERBOSE)
      console.log('');
    done();
  });
}

module.exports = {
  port: TEST_INSTANCE_PORT,
  url: 'http://localhost:' + TEST_INSTANCE_PORT,
  refreshDb: refreshDb,
  stopDb: stopDb
};
