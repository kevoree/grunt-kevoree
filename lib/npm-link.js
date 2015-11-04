var execNpm = require('exec-npm');

module.exports = function (moduleName, src, dest, done) {
    execNpm(['link', '--prefix=' + src], function (err) {
        if (err) {
            done(err);
        } else {
            execNpm(['link', moduleName, '--prefix=' + dest], done);
        }
    });
};
