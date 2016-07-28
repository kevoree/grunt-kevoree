'use strict';

var ora = require('ora'),
  path = require('path'),
  chalk = require('chalk'),
  latestVersion = require('latest-version');

var clog = require('./clearline-log');

module.exports = function (grunt, options, done) {
  var start = new Date().getTime();
  var spinner = ora('installing ' + chalk.cyan('kevoree-nodejs-runtime') + '@' + chalk.yellow(options.runtime) + '...');
  spinner.start();
  var localPkg = {};
  var runtimePkgPath = path.resolve(__dirname, '..', 'node_modules', 'kevoree-nodejs-runtime', 'package.json');

  function goodToGo(already) {
    spinner.stop();
    var end = new Date().getTime();
    clog(grunt)(chalk.green('✔') + ' ' + chalk.cyan('kevoree-nodejs-runtime') + '@' + chalk.yellow(localPkg.version) + (already ? ' already':'') + ' installed ' + chalk.gray('('+(end - start)+'ms)'));
    done();
  }

  function doInstall() {
    var cmd = 'npm';
    var args = [ 'install', 'kevoree-nodejs-runtime@' + options.runtime ];
    if (/^win/.test(process.platform)) {
      cmd = process.env.comspec;
      args.unshift(cmd);
      args.unshift('/c');
    }
    grunt.util.spawn({
        cmd: 'npm',
        args: args,
        opts: {
          cwd: path.resolve(__dirname, '..'),
          stdio: ['ignore', 'pipe', 'pipe']
        }
      },
      function (err) {
        if (err) {
          clog(grunt)(chalk.red('✘') + ' unable to install ' + chalk.cyan('kevoree-nodejs-runtime') + '@' + chalk.yellow(options.runtime));
          done(err);
        } else {
          try {
            delete require.cache[require.resolve(runtimePkgPath)];
          } catch (ignore) {}
          localPkg = require(runtimePkgPath);
          goodToGo();
        }
      });
  }

  try {
    localPkg = require(runtimePkgPath);
  } catch (ignore) {}

  if (options.runtime === localPkg.version) {
    goodToGo(true);
  } else {
    if (localPkg.version) {
      if (localPkg._requested && localPkg._requested.spec === options.runtime) {
        goodToGo(true);
      } else {
        if (options.runtime === 'latest') {
          latestVersion('kevoree-nodejs-runtime')
            .then(function (version) {
              if (localPkg.version === version) {
                goodToGo(true);
              } else {
                doInstall();
              }
            })
            .catch(done);
        } else {
          doInstall();
        }
      }
    } else {
      doInstall();
    }
  }
};
