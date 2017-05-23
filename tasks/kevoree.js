/*
 * grunt-kevoree
 * https://github.com/kevoree/grunt-kevoree
 *
 * Copyright (c) 2016 Maxime Tricoire
 * Licensed under the LGPL-3.0 license.
 */

'use strict';

var path = require('path');
var kConst = require('kevoree-const');
var config = require('tiny-conf');
var Logger = require('kevoree-commons').Logger;
var kevoree = require('kevoree-library');
var Resolvers = require('kevoree-resolvers');
var KevScript = require('kevoree-kevscript');

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

		var ctxVarOpt = grunt.option('ctxVar');
		if (ctxVarOpt) {
			// "ctxVar" as command-line argument
			[].concat(ctxVarOpt).forEach(function (arg) {
				var splitted = arg.split('=');
				var key = splitted[0];
				var value = splitted[1];
				options.ctxVars[key] = value;
			});
			console.log('ctxVar', options.ctxVars); // eslint-disable-line
		}

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
						var cache = config.get('cache');
						if (!cache) {
							cache = {};
							config.set('cache', cache);
						}
						if (!cache.root) {
							cache.root = path.join(options.modulesPath, 'tdefs');
						}
						if (!cache.ttl) {
							cache.ttl = 1000 * 60 * 60 * 24; // 24 hours
						}

						var registryResolver = KevScript.Resolvers.registryResolverFactory(logger);
						// var fsResolver = KevScript.Resolvers.fsResolverFactory(logger, registryResolver);
						var modelResolver = KevScript.Resolvers.modelResolverFactory(logger, registryResolver);
						var tagResolver = KevScript.Resolvers.tagResolverFactory(logger, modelResolver);
						var kevs = new KevScript(logger, { resolver: tagResolver });
						var kevscript = grunt.file.read(options.kevscript);
						kevs.parse(kevscript, localModel, options.ctxVars, function (err, model) {
							if (err) {
								done(err);
							} else {
								// init more and more Kevoree tools
								var resolver = new Resolvers.NPMResolver(options.modulesPath, logger, options.skipIntegrityCheck);
								var Runtime = require('kevoree-cli');

								var runtime = new Runtime(options.modulesPath, logger, resolver, kevs);

								runtime.on('stopped', function () {
									process.exit(0);
								});

								var nodeName = options.nodeName;
								if (nodeName.startsWith('%%') && nodeName.endsWith('%%')) {
									nodeName = options.ctxVars[nodeName.substring(2, nodeName.length - 2)];
								}
								if (nodeName.startsWith('%') && nodeName.endsWith('%')) {
									nodeName = options.ctxVars[nodeName.substring(1, nodeName.length - 1)];
								}
								runtime.start(nodeName);
								runtime.deploy(model);
							}
						});
					}
				});
			}
		});
	});
};
