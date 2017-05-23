var fs = require('fs');
var path = require('path');
var mkdirp = require('mkdirp');

module.exports = function cacheModel(modelPath, model) {
	return new Promise(function (resolve, reject) {
		var rootDir = path.join(modelPath, '..');
		mkdirp(rootDir, function (err) {
			if (err) {
				reject(err);
			} else {
				fs.writeFile(modelPath, model, 'utf-8', function (err) {
					if (err) {
						reject(err);
					} else {
						resolve();
					}
				});
			}
		});
	});
};
