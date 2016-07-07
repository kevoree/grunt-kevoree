/*
 * grunt-kevoree
 * https://github.com/kevoree/kevoree-js
 *
 * Copyright (c) 2014 Maxime Tricoire
 * Licensed under the LGPL-3.0 license.
 */

'use strict';

var kevoree = require('kevoree-library').org.kevoree,
  KevoreeLogger = require('kevoree-commons').KevoreeLogger,
  NPMResolver = require('kevoree-resolvers').NPMResolver,
  KevScript = require('kevoree-kevscript'),
  async = require('async'),
  path = require('path'),
  fs = require('fs'),
  execNpm = require('exec-npm'),
  serveStatic = require('../lib/serve-static'),
  npmLink = require('../lib/npm-link'),
  exists = require('../lib/exists');

module.exports = function (grunt) {

  var logger = new KevoreeLogger('RuntimeGruntTask');

  grunt.registerTask('kevoree', 'Automatically runs kevoree runtime (works like mvn kev:run plugin)', function () {
    var done = this.async();

    // Merge task-specific and/or target-specific options with these defaults.
    var options = this.options({
      runtime: 'latest',
      node: 'node0',
      kevscript: path.resolve('kevs/main.kevs'),
      modulesPath: path.resolve('.deploy_units'),
      mergeLocalLibraries: [],
      logLevel: 'debug',
      browserDevModeOptions: {
        port: 59000,
        path: path.resolve('browser')
      },
      browserDevMode: false,
      ctxVars: {}
    });

    switch (options.logLevel) {
      case 'all':
        logger.setLevel(KevoreeLogger.ALL);
        break;

      case 'debug':
        logger.setLevel(KevoreeLogger.DEBUG);
        break;

      default:
      case 'info':
        logger.setLevel(KevoreeLogger.INFO);
        break;

      case 'warn':
        logger.setLevel(KevoreeLogger.WARN);
        break;

      case 'error':
        logger.setLevel(KevoreeLogger.ERROR);
        break;

      case 'quiet':
        logger.setLevel(KevoreeLogger.QUIET);
        break;
    }

    var nodeName = grunt.option('node');
    if (nodeName) {
      options.node = nodeName;
    }
    grunt.log.ok('Platform node name: ' + options.node['blue']);

    var runtimeVers = grunt.option('runtime');
    if (runtimeVers) {
      options.runtime = runtimeVers;
    }

    var kevscript = grunt.option('kevscript');
    if (kevscript) {
      options.kevscript = path.resolve('kevs', kevscript);
    }

    options.modulesPath = path.resolve(options.modulesPath, options.node);

    var bootstrapScriptPath = path.relative(process.cwd(), options.kevscript);
    if (bootstrapScriptPath.startsWith(path.join('..', '..', '..'))) {
      bootstrapScriptPath = path.resolve(options.kevscript);
    }
    grunt.log.ok('Bootstrap script: ' + bootstrapScriptPath['blue']);
    var factory = new kevoree.factory.DefaultKevoreeFactory();
    var loader = factory.createJSONLoader();
    var compare = factory.createModelCompare();

    var npmResolver = new NPMResolver(options.modulesPath, logger),
      kevsEngine = new KevScript();

    var kevscriptContent = grunt.file.read(options.kevscript);

    try {
      // getting current project kevlib.json model
      var model = grunt.file.read('kevlib.json');
      var contextModel = loader.loadModelFromString(model).get(0);

      try {
        var modulesPath = path.resolve(options.modulesPath, 'node_modules');
        var dirs = fs.readdirSync(modulesPath);
        dirs.forEach(function (dir) {
          try {
            var kevlibStr = fs.readFileSync(path.resolve(modulesPath, dir, 'kevlib.json'), {
              encoding: 'utf8'
            });
            var kevlib = loader.loadModelFromString(kevlibStr).get(0);
            compare.merge(contextModel, kevlib).applyOn(contextModel);
          } catch (err) { /* ignore */ }
        });
      } catch (err) { /* ignore */ }

      var mergeTasks = [];
      options.mergeLocalLibraries.forEach(function (localLibPath) {
        mergeTasks.push(function (cb) {
          var localLibModel = grunt.file.read(path.resolve(localLibPath, 'kevlib.json'));
          var model = loader.loadModelFromString(localLibModel).get(0);
          compare.merge(contextModel, model).applyOn(contextModel);

          var localLibPkg = JSON.parse(grunt.file.read(path.resolve(localLibPath, 'package.json')));
          npmLink(localLibPkg.name, localLibPath, path.resolve(options.modulesPath), function (err) {
            if (err) {
              cb(new Error('"grunt-kevoree" unable to merge local library ' + localLibPkg.name + ' in ' + options.modulesPath));
            } else {
              grunt.log.ok('Merged local library: ' + localLibPkg.name['blue']);
              cb();
            }
          });
        });
      });

      async.series(mergeTasks, function (err) {
        if (err) {
          grunt.fail.fatal(err.message);
          done();
        } else {
          kevsEngine.parse(kevscriptContent, contextModel, options.ctxVars, function (err, model) {
            if (err) {
              grunt.fail.fatal('"grunt-kevoree" unable to parse KevScript\n' + err.message);
              done();
            } else {
              var linkModule = function () {
                var pkg = grunt.file.readJSON('package.json'),
                  modulePath = path.resolve(options.modulesPath, 'node_modules', pkg.name);
                if (!grunt.file.exists(modulePath)) {
                  grunt.log.ok('Linking ' + pkg.name + ' in ' + path.relative(process.cwd(), options.modulesPath) + ' ...');
                  npmLink(pkg.name, process.cwd(), path.resolve(options.modulesPath, 'node_modules'), function (err) {
                    if (err) {
                      grunt.fail.fatal('"grunt-kevoree" unable to link ' + pkg.name + ' in ' + options.modulesPath);
                      done();
                    } else {
                      startRuntime();
                    }
                  });
                } else {
                  startRuntime();
                }
              };

              var startRuntime = function () {
                if (options.browserDevMode) {
                  // serve static file './browser/*' for the browser runtime
                  try {
                    var serveStaticOptions = {
                      port: options.browserDevModeOptions.port,
                      paths: [options.browserDevModeOptions.path]
                        .concat(options.mergeLocalLibraries.map(function (libToMergePath) {
                          return path.resolve(libToMergePath, 'browser');
                        }))
                    };
                    var servedPaths = serveStatic(serveStaticOptions);
                    grunt.log.ok('Browser dev-mode server started at ' + '0.0.0.0:' ['blue'] + (serveStaticOptions.port + '')['blue'] + ' and serving:');
                    servedPaths.forEach(function (servedPath) {
                      grunt.log.writeln('    - ' + servedPath);
                    });
                  } catch (err) {
                    grunt.fail.fatal('"grunt-kevoree" unable to start Browser DevMode local registry\n' + err.stack);
                  }
                }

                process.env.KEVOREE_RUNTIME = 'dev';
                var Kevoree = require('kevoree-nodejs-runtime'),
                  runtime = new Kevoree(options.modulesPath, logger, npmResolver);

                var errorHandler = function () {
                  grunt.log.writeln();
                  grunt.fail.fatal('"grunt-kevoree" unable to bootstrap platform. Shutting down.');
                  runtime.stop();
                };

                runtime.on('started', function ()  {
                  runtime.deploy(model, function () {
                    grunt.log.ok('Bootstrap model deployed successfully');
                  });
                });

                runtime.on('stopped', function () {
                  done();
                });

                var runtimePath = path.resolve(runtimeInstallPath, 'node_modules', 'kevoree-nodejs-runtime', 'package.json');
                grunt.log.ok('Starting runtime: ' + 'v' ['blue'] + require(runtimePath).version['blue']);
                runtime.start(options.node);
              };

              var runtimeInstallPath = path.resolve(__dirname, '..');
              exists('kevoree-nodejs-runtime@' + options.runtime, runtimeInstallPath, function (err, exists) {
                if (err) {

                } else {
                  if (!exists) {
                    // install specified kevoree-nodejs-runtime version
                    var cmd = ['install', 'kevoree-nodejs-runtime@' + options.runtime, '--prefix=' + runtimeInstallPath];
                    grunt.log.ok('Installing ' + 'kevoree-nodejs-runtime@' + options.runtime + ' ...');
                    execNpm(cmd, {
                      stdio: ['ignore', 'ignore', process.stderr]
                    }, function (err) {
                      if (err) {
                        grunt.fail.fatal('"grunt-kevoree" unable to resolve kevoree-nodejs-runtime@' + options.runtime + '\n' + err.message);
                        done();
                        process.exit(1);
                      } else {
                        linkModule();
                      }
                    });
                  } else {
                    linkModule();
                  }
                }
              });
            }
          });
        }
      });

    } catch (err) {
      grunt.fail.fatal('"grunt-kevoree" unable to load Kevoree model kevlib.json\n' + err.message);
      done();
    }
  });
};
