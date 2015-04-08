/* -*- Mode: Javascript; js-indent-level: 2 -*- */

var testDatabase = require('./util/database');

before(testDatabase.refreshDb);
after(testDatabase.stopDb);
