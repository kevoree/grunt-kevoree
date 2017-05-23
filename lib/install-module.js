'use strict';

var fs = require('fs');
var ora = require('ora');
var path = require('path');
var chalk = require('chalk');
var semver = require('semver');
var kHash = require('kevoree-hash');
var kevoree = require('kevoree-library');

// var cacheModel = require('./cache-model');
var clog = require('./clearline-log');

module.exports = function (grunt, options, done) {
  var pkg, error;
  var start = new Date().getTime();

  try {
    pkg = require(path.join(process.cwd(), 'package.json'));
  } catch (err) {
    error = err;
  }

	function doInstall(namespace, name, version, duVersion) {
		var TAG = semver.prerelease(duVersion) ? 'LATEST' : 'RELEASE';
		var cacheRoot = path.join(options.modulesPath, 'tdefs');
		var cachePath = path.join(cacheRoot, namespace, name, version + '-' + TAG + '.json');
		spinner.text = 'caching model into ' + chalk.cyan(cachePath) + '...';
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
          clog(grunt)(chalk.green('✔') + ' ' + chalk.cyan(pkg.name) + '@' + chalk.yellow(pkg.version) + ' installed ' + chalk.gray('('+(Date.now() - start)+'ms)'));
          done();
        }
      });
	}

  if (error) {
    done(error);
  } else {
		// read local model
		var modelFile = path.join(options.localModel);
    var spinner = ora('reading local model ' + chalk.cyan(modelFile) + ' for ' + chalk.cyan(pkg.name) + '@' + chalk.yellow(pkg.version));
		spinner.start();
		fs.readFile(modelFile, { encoding: 'utf8' }, function (err, modelStr) {
			if (err) {
				clog(grunt)(chalk.red('✘') + ' unable to read local model "' + chalk.yellow(modelFile) + '"');
				done(err);
			} else {
				var factory = new kevoree.factory.DefaultKevoreeFactory();
				var loader = factory.createJSONLoader();
				var model;
				try {
					model = loader.loadModelFromString(modelStr).get(0);
					var m = JSON.parse(modelStr);
					m.generated_KMF_ID = Date.now() + '';
					modelStr = JSON.stringify(m, null, 2);
				} catch (e) {
					error = e;
				}

				if (error) {
					clog(grunt)(chalk.red('✘') + ' unable to parse model "' + chalk.yellow(modelFile) + '"');
					done(error);
				} else {
					var namespace = model.packages.array[0].name;
					var name = model.packages.array[0].typeDefinitions.array[0].name;
					var version = model.packages.array[0].typeDefinitions.array[0].version;
					// var du = model.select('**/deployUnits[]').array[0];
					// compare local kHash with the one in options.modulesPath
					spinner.text = 'generating hash for ' + chalk.cyan(pkg.name) + '@' + chalk.yellow(pkg.version) + ' in ' + options.modulesPath + '...';
					var modulePath = path.resolve(options.modulesPath, 'node_modules', pkg.name);
					fs.access(modulePath, fs.constants.R_OK | fs.constants.W_OK, function (err) {
						if (err) {
							// unable to find module in $HOME/.kevoree/node_modules => not installed yet
							doInstall(namespace, name, version, pkg.version);
						} else {
							try {
                var localHash = kHash(process.cwd());
								var installedHash = kHash(modulePath);
								spinner.text = 'comparing hashes...';
								if (localHash === installedHash) {
									spinner.stop();
									clog(grunt)(chalk.green('✔') + ' ' + chalk.cyan(pkg.name) + '@' + chalk.yellow(pkg.version) + ' already installed ' + chalk.gray('('+(Date.now() - start)+'ms)'));
									done();
								} else {
									// there are differences in hash => re-install
									clog(grunt)(chalk.yellow('!') + ' ' + chalk.cyan(localHash) + ' (local hash) !== ' + chalk.yellow(installedHash) + ' (hash from '+path.join('.kevoree', 'node_modules', pkg.name)+')');
									doInstall(namespace, name, version, pkg.version);
								}
							} catch (error) {
								clog(grunt)(chalk.red('✘') + ' unable to generate hash from ' + chalk.yellow(modulePath));
								done(error);
							}
						}
					});
				}
			}
		});
  }
};
