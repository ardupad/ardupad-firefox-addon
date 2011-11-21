//
// https://github.com/ochameau/jetpack-runner/
//
const { Ci, Cc } = require("chrome");

// Try to stick with API from:
// https://github.com/bruce/node-temp

const tmpDir = Cc["@mozilla.org/file/directory_service;1"].
	           getService(Ci.nsIProperties).
	           get("TmpD", Ci.nsIFile);

exports.dir = tmpDir.path;

exports.mkdirSync = function (affix) {
  let dir = tmpDir.clone();
  dir.append(affix);
	dir.createUnique(Ci.nsIFile.DIRECTORY_TYPE, 0700);

  require("unload").when(function () {
    require("rm-rec").rm(dir.path);
  });

  return dir.path;
}

exports.path = function (input) {
  let prefix = "temp-file";
  let suffix = null;
  if (typeof input=="string")
    prefix = input;
  if (input.prefix)
    prefix = input.prefix;
  if (input.suffix)
    suffix = input.suffix;

  let file = tmpDir.clone();

  file.append(prefix + (suffix ? "." + suffix : ""));
  if (file.exists()) {
    file = file.parent;
    for(let i=1; i<10000; i++) {
      file.append(prefix + "-" + i + (suffix ? "." + suffix : ""));
      if (!file.exists())
        break;
      else
        file = file.parent;
    }
  }

  require("unload").when(function () {
    require("rm-rec").rm(file.path);
  });

  file.createUnique(Ci.nsIFile.NORMAL_FILE_TYPE, 0700);

	return file.path;
}
