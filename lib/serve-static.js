var http = require('http'),
    serveStatic = require('serve-static'),
    finalhandler = require('finalhandler');

module.exports = function (options) {
    var serve = serveStatic(options.path);

    var server = http.createServer(function (req, res) {
        res.setHeader('Access-Control-Allow-Origin', '*');
        serve(req, res, finalhandler(req, res));
    });
    server.listen(options.port);
};