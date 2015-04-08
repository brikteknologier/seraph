var testDatabase = require('./util/database');

before(testDatabase.refreshDb);
after(testDatabase.stopDb);
