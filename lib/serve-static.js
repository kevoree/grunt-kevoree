var express = require('express'),
    serveStatic = require('serve-static'),
    path = require('path');

/**
 *
 * @param {Object} options
 */
module.exports = function (options) {
    var servedPaths = [];
    var server = express();

    options.paths.forEach(function (pathToServe) {
        try {
            var router = express.Router();
            router.use(function (req, res, next) {
                // CORS middleware
                res.setHeader('Access-Control-Allow-Origin', '*');
                next();
            });
            var pkg = require(path.resolve(pathToServe, '..', 'package.json'));
            router.use(serveStatic(pathToServe));
            server.use('/'+pkg.name+'/'+pkg.version, router);
            servedPaths.push(path.join(pkg.name, pkg.version, 'browser'));
        } catch (err) {
            console.error('Unable to find "package.json" in %s', pathToServe);
        }
    });

    server.listen(options.port);
    return servedPaths;
};