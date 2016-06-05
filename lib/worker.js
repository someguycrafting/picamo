module.exports = (function () {

  'use strict';

  var autoimage = require('./autoimage'),
      archiver = require('./cryptopacker'),
      camoOptions;

  function _addCamouflage(callback) {
    archiver.pack(camoOptions, (result) => {
      callback(result);
    });
  }

  function _removeCamouflage(callback) {
    archiver.unpack(camoOptions, (result) => {
      callback(result);
    });
  }

  /******************************* PUBLIC *******************************/
  var parseAutoImage = function (parameters) {
    return autoimage.parseParameters(parameters);
  }

  var start = function start(options, callback) {
      var result = { error: false, message: null };

      camoOptions = options;

      if (camoOptions.action == 0) {
        _removeCamouflage((result) => {
          callback(result);
        });
      }
      else {
          //check if autoimage requested
          if (camoOptions.autoimage != null) {
            autoimage.download(camoOptions.autoimage, function(downloadResult) {
              if (downloadResult.success) {
                camoOptions.image = downloadResult.image;
                camoOptions.imageSize = downloadResult.size;
                _addCamouflage((result) => {
                  callback(result);
                });
              }
              else {
                result.message = downloadResult.message;
                callback(result);
              }
            });
          }
          else {
            var stats = fs.statSync(options.image);
            camoOptions.imageSize = stats["size"];
            _addCamouflage((result) => {
              callback(result);
            });
          }
      }
  };

  return {
      parseAutoImage: parseAutoImage,
      start:          start
  };

}());
