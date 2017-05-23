'use strict';

var ora = require('ora');
var path = require('path');
var chalk = require('chalk');
var latestVersion = require('latest-version');

var clog = require('./clearline-log');

module.exports = function (grunt, options, done) {
	var start = new Date().getTime();
	var spinner = ora('installing ' + chalk.cyan('kevoree-cli') + '@' + chalk.yellow(options.runtime) + '...');
	spinner.start();
	var localPkg = {};
	var runtimePkgPath = path.resolve(process.cwd(), 'node_modules', 'kevoree-cli', 'package.json');

	function goodToGo(already) {
		spinner.stop();
		var end = new Date().getTime();
		clog(grunt)(chalk.green('✔') + ' ' + chalk.cyan('kevoree-cli') + '@' + chalk.yellow(localPkg.version) + (already
			? ' already'
			: '') + ' installed ' + chalk.gray('(' + (end - start) + 'ms)'));
		done();
	}

	function doInstall() {
		var cmd = 'npm';
		var args = [
			'install', 'kevoree-cli@' + options.runtime
		];
		if (/^win/.test(process.platform)) {
			cmd = process.env.comspec;
			args.unshift('npm');
			args.unshift('/c');
		}
		grunt.util.spawn({
			cmd: cmd,
			args: args,
			opts: {
				cwd: path.resolve(process.cwd()),
				stdio: ['ignore', 'pipe', 'pipe']
			}
		}, function (err) {
			if (err) {
				clog(grunt)(chalk.red('✘') + ' unable to install ' + chalk.cyan('kevoree-cli') + '@' + chalk.yellow(options.runtime));
				done(err);
			} else {
				try {
					delete require.cache[require.resolve(runtimePkgPath)];
				} catch (ignore) { /* noop */ }
				localPkg = require(runtimePkgPath);
				goodToGo();
			}
		});
	}

	try {
		localPkg = require(runtimePkgPath);
	} catch (ignore) { /* noop */ }

	if (options.runtime === localPkg.version) {
		goodToGo(true);
	} else {
		if (localPkg.version) {
			if (localPkg._requested && localPkg._requested.spec === options.runtime) {
				goodToGo(true);
			} else {
				if (options.runtime === 'latest') {
					latestVersion('kevoree-cli').then(function (version) {
						if (localPkg.version === version) {
							goodToGo(true);
						} else {
							doInstall();
						}
					}).catch(done);
				} else {
					doInstall();
				}
			}
		} else {
			doInstall();
		}
	}
};
