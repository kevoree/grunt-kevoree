'use strict';

var fs = require('fs');
var ora = require('ora');
var path = require('path');
var chalk = require('chalk');
var kevoree = require('kevoree-library');
var kHash = require('kevoree-hash');

var clog = require('./clearline-log');

module.exports = function (grunt, options, done) {
  var pkg, error;
  var start = new Date().getTime();

  try {
    pkg = require(path.join(process.cwd(), 'package.json'));
  } catch (err) {
    error = err;
  }

	function doInstall() {
		spinner.text = 'installing ' + chalk.cyan(pkg.name) + '@' + chalk.yellow(pkg.version) + ' in ' + options.modulesPath + '...';
		var cmd = 'npm';
		var args = [ 'install', process.cwd(), '--production' ];
		if (/^win/.test(process.platform)) {
			cmd = process.env.comspec;
			args.unshift('npm');
			args.unshift('/c');
		}
		grunt.util.spawn({
				cmd: cmd,
				args: args,
				opts: {
					cwd: path.resolve(options.modulesPath),
					stdio: ['ignore', 'pipe', 'pipe']
				}
			},
			function (err) {
				if (err) {
					clog(grunt)(chalk.red('✘') + ' unable to install ' + chalk.cyan(pkg.name) + '@' + chalk.yellow(pkg.version));
					done(err);
				} else {
					spinner.stop();
					var end = new Date().getTime();
					clog(grunt)(chalk.green('✔') + ' ' + chalk.cyan(pkg.name) + '@' + chalk.yellow(pkg.version) + ' installed ' + chalk.gray('('+(end - start)+'ms)'));
					done();
				}
			});
	}

  if (error) {
    done(error);
  } else {
		var spinner = ora('reading local model "' + chalk.cyan(modelFile) + '" for ' + chalk.cyan(pkg.name) + '@' + chalk.yellow(pkg.version));
		spinner.start();

		// check if already installed
		var modelFile = path.join(options.localModel);
		fs.readFile(modelFile, { encoding: 'utf8' }, function (err, modelStr) {
			if (err) {
				clog(grunt)(chalk.red('✘') + ' unable to read local model "' + chalk.yellow(modelFile) + '"');
				done(err);
			} else {
				var factory = new kevoree.factory.DefaultKevoreeFactory();
				var loader = factory.createJSONLoader();
				try {
					var model = loader.loadModelFromString(modelStr).get(0);
				} catch (e) {
					error = e;
				}

				if (error) {
					clog(grunt)(chalk.red('✘') + ' unable to parse model "' + chalk.yellow(modelFile) + '"');
					done(error);
				} else {
					var du = model.select('**/deployUnits[]').array[0];
					// compare local kHash with the one in options.modulesPath
					spinner.text = 'generating hash for ' + chalk.cyan(pkg.name) + '@' + chalk.yellow(pkg.version) + ' in ' + options.modulesPath + '...';
					var modulePath = path.resolve(options.modulesPath, 'node_modules', pkg.name);
					try {
						var pkgJson = grunt.file.read(path.join(modulePath, 'package.json'));
						kHash(modulePath, function (err, hash) {
							if (err) {
								clog(grunt)(chalk.red('✘') + ' unable to generate hash from ' + chalk.yellow(modulePath));
								done(error);
							} else {
								spinner.text = 'comparing hashes...';
								if (hash === du.hashcode) {
									spinner.stop();
									var end = new Date().getTime();
									clog(grunt)(chalk.green('✔') + ' ' + chalk.cyan(pkg.name) + '@' + chalk.yellow(pkg.version) + ' installed ' + chalk.gray('('+(end - start)+'ms)'));
									done();
								} else {
									// there are differences in hash => re-install
									clog(grunt)(chalk.yellow('!') + ' ' + chalk.cyan(du.hashcode) + ' (local hash) !== ' + chalk.yellow(hash) + ' (hash from '+path.join('.kevoree', 'node_modules', pkg.name)+')');
									doInstall();
								}
							}
						});
					} catch (err) {
						// module is not installed yet => install it anyway
						doInstall();
					}
				}
			}
		});
  }
};
