/*
 * grunt-kevoree
 * https://github.com/kevoree/grunt-kevoree
 *
 * Copyright (c) 2016 Maxime Tricoire
 * Licensed under the LGPL-3.0 license.
 */

'use strict';

var path = require('path'),
  kConst = require('kevoree-const'),
  config = require('tiny-conf'),
  Logger = require('kevoree-commons').Logger,
  kevoree = require('kevoree-library'),
  Resolvers = require('kevoree-resolvers'),
  KevScript = require('kevoree-kevscript');

require('tiny-conf-plugin-file')(config, kConst.CONFIG_PATH);
require('tiny-conf-plugin-argv')(config);

var installRuntime = require('../lib/install-runtime');
var installModule = require('../lib/install-module');

module.exports = function (grunt) {

  grunt.registerMultiTask('kevoree', 'Automatically runs Kevoree runtime (works like the Maven plugin "mvn kev:run")', function () {
    var done = this.async();

    var options = this.options({
      nodeName: 'node0',
      runtime: 'latest',
      modulesPath: path.join(kConst.CONFIG_PATH, '..'),
      localModel: 'kevlib.json',
      kevscript: path.join('kevs', 'main.kevs'),
      ctxVars: {},
      skipIntegrityCheck: false
    });

    Object.keys(options).forEach(function (key) {
      options[key] = grunt.option(key) || options[key];
    });

    // install the Kevoree NodeJS runtime
    installRuntime(grunt, options, function (err) {
      if (err) {
        done(err);
      } else {
        installModule(grunt, options, function (err) {
          if (err) {
            done(err);
          } else {
            grunt.log.writeln();

            // init Kevoree tools
            var factory = new kevoree.factory.DefaultKevoreeFactory();
            var loader = factory.createJSONLoader();

            var localModelStr = grunt.file.read(options.localModel);
            var localModel;
            try {
              localModel = loader.loadModelFromString(localModelStr).get(0);
            } catch (err) {
              err.message = 'Unable to load ' + options.localModel;
              done(err);
              return;
            }

            // init more Kevoree tools
            var logger = new Logger('Runtime');
            var logLevel = config.get('log.level');
            if (logLevel) {
              // use command-line --log.level value if any
              logger.setLevel(logLevel);
            } else {
              // default logLevel to DEBUG
              logger.setLevel('DEBUG');
            }
            var kevs = new KevScript(logger);
            var kevscript = grunt.file.read(options.kevscript);
            kevs.parse(kevscript, localModel, options.ctxVars, function (err, model) {
              if (err) {
                done(err);
              } else {
                // init more and more Kevoree tools
                var resolver = new Resolvers.NPMResolver(options.modulesPath, logger, options.skipIntegrityCheck);
                var Runtime = require('kevoree-nodejs-runtime');

                var runtime = new Runtime(options.modulesPath, logger, resolver, kevs);
                runtime.start(options.nodeName);
                runtime.deploy(model, function (err) {
                  if (err) {
                    grunt.fail.fatal(err);
                  }
                });
              }
            });
          }
        });
      }
    });
  });
};
