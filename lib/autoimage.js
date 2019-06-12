module.exports = (function () {

  'use strict';

  const imageURI = "http://loremflickr.com/%d/%d/%s/all",
        fileName = 'autoimage.jpg';

  var http = require('follow-redirects').http,
      fs = require('fs'),
      util = require('util');

  var maxImageWidthHeight = 4000,
      expireTimeout = 30000,
      downloadResult = { success: false, message: null, image: null, size: 0 };

  function _getSize(n) {
    var size = parseInt(n);
    var validNumber = !isNaN(size) && isFinite(size);
    return validNumber && size > 0 & size <= maxImageWidthHeight ? size : -1;
  }

  function parseParameters(parameters) {
    var result = { error: null, tags: null, size: null };

    // check for empty parameters
    if (typeof parameters !== 'string' || parameters.length == 0) {
      result.error = 'Missing or invalid parameters for --autoimage';
    }
    else {
      // we have parameters, let's check if it's all Ok
      var options = parameters.split(',');
      // size should be the last parameter
      var size = options[options.length-1].split('x');
      if (size.length != 2) {
        result.error = 'Invalid options for --autoimage';
      }
      else {
        // we've checked everything, final check is sizes
        result.size = { width: _getSize(size[0]), height: _getSize(size[1]) };
        if (result.size.width == -1 || result.size.height == -1)
          result.error = 'Invalid size option for --autoimage';
        else
          result.tags = options.slice(0,options.length-1).join(',');
      }
    }
    return result;
  }

  /******************************* PUBLIC *******************************/

  var download = function(imageParameters, callback) {
    var request;
    var len =0, downloaded =0;

    var downloadURL = util.format(
      imageURI,
      imageParameters.size.width,
      imageParameters.size.height,
      imageParameters.tags
    );

    var timeoutHandler = function() {
      downloadResult.message = 'Autoimage transfer timeout!';
      request.abort();
    };

    var destinationFile = fs.createWriteStream(fileName);
    var timeoutId = setTimeout(timeoutHandler, expireTimeout);

    request = http.get(downloadURL, (response) => {
      console.log('Autoimage download started');
      response.pipe(destinationFile);
      response.on('data', (chunk) => {
          downloaded += chunk.length;
      }).on('end', () => {
        clearTimeout(timeoutId);
        destinationFile.end();
        console.log(util.format('Autoimage downloaded (%d bytes)',downloaded));
        downloadResult.size = downloaded;
        downloadResult.image = fileName;
        downloadResult.success = true;
        callback(downloadResult);
      }).on('error',  (err) =>  {
        clearTimeout(timeoutId);
        downloadResult.message = err.message;
        callback(downloadResult);
      });
    });
  };

  return {
      parseParameters:  parseParameters,
      download:         download
  };

}());
