var express = require('express'),
    serveStatic = require('serve-static');

/**
 *
 * @param {Object} options
 */
module.exports = function (options) {
    var server = express();

    server.use(function (req, res, next) {
        // CORS middleware
        res.setHeader('Access-Control-Allow-Origin', '*');
        next();
    });

    options.paths.forEach(function (path) {
        server.use(serveStatic(path));
    });

    server.listen(options.port);
};