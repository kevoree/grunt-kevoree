'use strict';

var readline = require('readline');

module.exports = function (grunt) {
	return function (txt) {
		readline.clearLine(process.stdout);
		readline.cursorTo(process.stdout, 0);
		grunt.log.writeln(txt);
	};
};
