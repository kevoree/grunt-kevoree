'use strict';

var ora = require('ora'),
  path = require('path'),
  chalk = require('chalk'),
	which = require('which');

var clog = require('./clearline-log');

module.exports = function (grunt, options, done) {
  var pkg, error;
  var start = new Date().getTime();

  try {
    pkg = require(path.join(process.cwd(), 'package.json'));
  } catch (err) {
    error = err;
  }

  if (error) {
    done(error);
  } else {
    var spinner = ora('installing ' + chalk.cyan(pkg.name) + '@' + chalk.yellow(pkg.version) + ' in ' + options.modulesPath + '...');
    spinner.start();

    var cmd = which.sync('npm');
    var args = [ 'install', process.cwd(), '--production' ];
    if (/^win/.test(process.platform)) {
      cmd = process.env.comspec;
      args.unshift(cmd);
      args.unshift('/c');
    }
    grunt.util.spawn({
        cmd: which.sync('npm'),
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
};
