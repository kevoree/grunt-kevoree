var path          = require('path'),
    fs            = require('fs'),
    latestVersion = require('latest-version');

function isLatest(moduleName, pkg, callback) {
    latestVersion(moduleName).then(function (version) {
        callback(null, pkg.version === version);
    }, function (err) {
        callback(null, true);
    });
}

/**
 *
 * @param moduleName
 * @param prefix
 * @param callback
 */
function exists(moduleName, prefix, callback) {
    if (moduleName.indexOf(path.sep) === -1) {
        fs.readFile(path.resolve(prefix, 'node_modules', moduleName.split('@')[0], 'package.json'), 'utf8', function (err, data) {
            if (err) {
                if (err.code === 'ENOENT') {
                    callback(null, false);
                } else {
                    callback(err);
                }
            } else {
                var pkg = JSON.parse(data);

                var m = moduleName.split('@');
                if (m.length === 2) {
                    if (m[1] === 'latest') {
                        isLatest(moduleName, pkg, callback);
                    } else {
                        if (pkg.version === m[1]) {
                            callback(null, true);
                        } else {
                            callback(null, false);
                        }
                    }
                } else {
                    isLatest(moduleName, pkg, callback);
                }
            }
        });
    } else {
        // module name is a path => local install
        fs.readFile(path.resolve(moduleName, 'package.json'), 'utf8', function (err, data) {
            if (err) {
                if (err.code === 'ENOENT') {
                    callback(null, false);
                } else {
                    callback(err);
                }
            } else {
                var localPkg = JSON.parse(data);
                fs.readFile(path.resolve(prefix, 'node_modules', localPkg.name, 'package.json'), 'utf8', function (err, data) {
                    if (err) {
                        if (err.code === 'ENOENT') {
                            callback(null, false);
                        } else {
                            callback(err);
                        }
                    } else {
                        var installedPkg = JSON.parse(data);
                        callback(null, localPkg.version === installedPkg.version);
                    }
                });
            }
        });
    }
}

module.exports = exists;
