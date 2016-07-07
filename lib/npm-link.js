var execNpm = require('exec-npm'),
  mkdirp = require('mkdirp');

module.exports = function (moduleName, src, dest, done) {
  execNpm(['link'], {
    cwd: src,
    stdio: ['ignore', 'ignore', process.stderr]
  }, function (err) {
    if (err) {
      done(err);
    } else {
      mkdirp(dest, function (err) {
        if (err) {
          done(err);
        } else {
          execNpm(['link', moduleName], {
            cwd: dest
          }, done);
        }
      });
    }
  });
};
