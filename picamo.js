
var package = require('./package.json'),
    worker = require('./lib/worker')
    util = require('util'),
    fs = require('fs'),
    options = {
      action: null,
      file: null,
      image: null,
      imageSize : 0,
      password: null,
      autoimage : null,
      paranoia : false,
      hat : null,
      compress : true,
      marker: null
    };

var argErrors = checkArguments();

if (argErrors !=null) {
  if(argErrors.length==0) {
    worker.start(options, (result) => {
      console.log(util.format('\n\r%s\n\r',result.message));
    });
  }
  else
    logArgumentErrors();
}

function checkArguments() {
  var argv = require('minimist')(process.argv.slice(2));
  var errors = [];

  //check help requested
  if (argv.help !== undefined) {
    printUsage();
    return null;
  }

  if (argv.c == 'hide') {
    //hide operation
    options.action = 1;
    //require a file to add
    if (argv.f === undefined) {
      errors.push('No file specified');
    }
    else {
      if (fileExists(argv.f))
        options.file = argv.f;
      else
        errors.push('Invalid file specified. Verify path and access.');
    }
    //check autoimage option
    if (argv.autoimage !== undefined) {
        var result = worker.parseAutoImage(argv.autoimage);
        if (result.error != null)
          errors.push(result.error);
        else
          options.autoimage = result;
    }
    else {
      // if no autoimage was specified, we need one specified
      if (argv.i === undefined)
        errors.push('Error: No image specified');
      else
        if (fileExists(argv.i))
          options.image = argv.i;
        else
          errors.push('Invalid source image specified. Verify path and access.');
    }
  }

  if (argv.c == 'show') {
    //show operation
    options.action = 0;
    if (argv.i === undefined)
      errors.push('No source image specified');
    else
    if (fileExists(argv.i))
      options.image = argv.i;
    else
      errors.push('Invalid input image specified. Verify path and access.');
  }

  //check if a valid operation was specified
  if (options.action == null)
      errors.push('Invalid operation specified');

  //check for paranoia
  if (argv.paranoia !== undefined) {
    /*
      in this case hat option is also mandatory if we're performing
      a show operation
    */
    if (options.action == 0) {
      if (argv.hat === undefined)
        errors.push('No hat file specified');
      else {
        if (fileExists(argv.hat))
          options.hat = argv.hat;
        else
          errors.push('Invalid hat file specified. Verify path and access.');
      }
    }
    options.paranoia = true;
  }
  else {
    //if paranoia is not used, require a password
    if (argv.p === undefined)
      errors.push('No password specified');
    else
      options.password = argv.p.toString();
  }

  //check for compression
  options.compress = (argv.nocomp === undefined);

  //check for custom marker
  if (argv.marker !== undefined) {
    if (argv.marker.toString().length < 4)
      errors.push('Custom marker should have at least 3 characters');
    else {
      if (!isHex(argv.marker))
        errors.push('Error: Custom marker should be in hex format');
      else
        options.marker = argv.marker;
    }
  }

  return errors;

}

function logArgumentErrors() {
  var errorList = '';
  argErrors.forEach((error) => {
    errorList += util.format('\n\r- %s', error);
  });
  console.log (
    util.format('\n\rPlease revise the following problems before proceeding:\
    %s\n\r\n\rUse --help for usage options.\n\r'),
    errorList
  );
}

function isHex(hex) {
  var conv;
  try {
    conv = Buffer.from(hex, "hex")
    return true;
  }
  catch(exception) {
    // TypeError, not a valid hex string
    return false;
  }
}

function fileExists(path) {
  try {
      fs.accessSync(path,fs.R_OK);
      return true;
  }
  catch (err) {
    return false;
  }
}

function printUsage() {
  console.log(util.format('\
      \n\r\n\r\%s v%s \r\n\
      \n\rUsage: %s <command> <image>\
      \rpicamo -c <command> [-f source file] [-i image] [-p password] [<options>]\
      \n\r\n\ravailable commands: \
      \n\r\t--hide\tHide <source files> in <image>\
      \n\r\t--show\tExtract files from <image> to <destination folder>\
      \n\r\n\ravailable options: \
      \n\r\t--paranoia\n\r\t\tTin foil hat security type!\
      \n\r\t\tInstead of using the supplied password, generates one with\
      \n\r\t\t32 bytes and an initialization vector with 16 bytes that\
      \n\r\t\twill be stored in a new file. For succesfull\
      \n\r\t\tdecryption this file needs to be provided!\
      \n\r\n\r\t--hat\n\r\t\tPath to the paranoia file. Required when --show\
      \n\r\t\tis used with --paranoia option.\
      \n\r\n\r\t--marker\n\r\t\tCustom marker for signaling hidden file chunk.\
      \n\r\t\tShould be in hex zero padded format, minimun\
      \n\r\t\t4 characters required.\
      \n\r\n\r\t\tExample: --marker 637573746f6d\n\r\
      \n\r\n\r\t--nocomp\n\r\t\tBy default the source file will be compressed in order\
      \n\r\t\tto reduce the final image size. Setting this option will \
      \n\r\t\tdisable compression. Recommended only when the source file\
      \n\r\t\tis already in a compressed format (ex: zip, pdf)\
      \n\r\n\r\t--autoimage\n\r\t\tComma delimited image tags, size (width x height)\
      \n\r\t\tWhen --hide is specified, instead of using a local\
      \n\r\t\t<image>, attempts to fetch one from LoremFlickr with the tags\
      \n\r\t\tand size specified. Size should be the last value and\
      \n\r\t\tin the form width x height\
      \n\r\t\tRemember to check for image usage rights before posting\
      \n\r\t\tto social networks.\
      \n\r\n\r\t\tExample: --autoimage cats,funny,640x480\n\r\
      \n\r\t--help\tShow this help screen\n\r\
  ', package.name, package.version, package.name));
}
