var npm = require('npm');

module.exports = function (moduleName, src, dest, done) {
    npm.load({ loglevel: 'silent' }, function (err) {
        if (err) {
            done(err);
        } else {
            var savedPrefix = npm.prefix;
            npm.prefix = src;
            npm.commands.link([], function (err) {
                if (err) {
                    npm.prefix = savedPrefix;
                    done(err);
                } else {
                    npm.prefix = dest;
                    npm.commands.link([moduleName], function (err) {
                        npm.prefix = savedPrefix;
                        done(err);
                    });
                }
            });
        }
    });
};
