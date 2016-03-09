var fs = require('fs'),
  mkdirp = require('mkdirp'),
  path = require('path');

module.exports = function(moduleName, src, dest, done) {
  mkdirp(dest, function(err) {
    if (err) {
      done(err);
    } else {
      var startCwd = process.cwd();
      try {
        process.chdir(dest);
        fs.symlink(src, moduleName, function(err) {
          try {
            process.chdir(startCwd);
            if (err) {
              done(err);
            } else {
              done();
            }
          } catch (err) {
            done(err);
          }
        });
      } catch (err) {
        done(err);
      }
    }
  });
};
