const { Ci, Cc } = require("chrome");
const fs = require("fs");
const path = require("path");

exports.rm = function (p, callback) {
  fs.stat(p, function (err, stat) {
    if (err) 
      return callback(err);
    if (!stat)
      return callback(p+" doesn't exists");
    if (!stat.isDirectory())
      return fs.unlink(p, callback);
    fs.readdir(p, function (err, files) {
      if (err) 
        return callback(err);
      function rmOneByOne() {
        let file = files.pop();
        if (!file) 
          return fs.rmdir(p, callback);
        exports.rm(path.join(p, file), function (err) {
          if (err) 
            return callback(err);
          rmOneByOne();
        });
      }
      rmOneByOne();
    });
  });
}
