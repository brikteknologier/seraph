/* -*- Mode: Javascript; js-indent-level: 2 -*- */

var testDatabase = require('./util/database');
var db = require('../')(testDatabase.url);

before(testDatabase.refreshDb);
after(testDatabase.stopDb);
