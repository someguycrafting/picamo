module.exports = (function () {

  'use strict';

  const algorithm = 'aes-256-ctr',
        jpegEOF = 'ffd9';

  var fs = require('fs'),
      path = require('path'),
      crypto = require('crypto'),
      util = require('util'),
      zlib = require('zlib'),
      crc = require('crc-32'),
      CombinedStream = require('combined-stream2'),
      marker = '697061636f6d75';

  function _getHiddenFileNameCRC(fileNameBuffer) {
    var crcBuffer = new Buffer(4);
    crcBuffer.writeInt32LE(crc.buf(fileNameBuffer));
    return crcBuffer;
  }

  function _getPicamoSection(file, callback) {
    var result = {
          found: false,
          start : 0,
          fileSize : 0,
          compressed: null
        },
        bufferPos = 0,
        detectBuffer = new Buffer(jpegEOF.concat(marker),'hex'),
        imageFile = fs.createReadStream(file);

    imageFile.on('end', () => {
      callback(result);
    });

    imageFile.on('readable', () => {
      var chunk;

      while (null !== (chunk = imageFile.read(1))) {
        result.fileSize += chunk.length;
        if (!result.found) {
          if (chunk[0] == detectBuffer[bufferPos]) {
              result.start = result.fileSize;
              bufferPos++;
          }
          else {
            bufferPos = 0;
          }
          result.found = (bufferPos == detectBuffer.length);
        }
        else
          if (result.compressed == null) {
            //if we found the marker, compression indicator is next
            result.compressed = chunk.readUInt8(0);
            result.start++;
          }
      }
    });
  }

  function _getKeyAndIV(key, callback) {
    crypto.pseudoRandomBytes(16, function (err, ivBuffer) {
      var keyBuffer  = (key instanceof Buffer) ? key : new Buffer(key) ;
      callback({
        iv: ivBuffer,
        key: keyBuffer
      });
    });
  }

  function _getEncryption(camoOptions, callback) {
    var encryption = { cipher: null, keyIV: { key:null, iv:null} };
    if (camoOptions.paranoia) {
      var keyIV = _getKeyAndIV(crypto.randomBytes(32), (keyIVresult) => {
          encryption.cipher = crypto.createCipheriv(
            algorithm, keyIVresult.key, keyIVresult.iv
          );
          encryption.keyIV.key = keyIVresult.key;
          encryption.keyIV.iv = keyIVresult.iv;
          callback(encryption);
      });
    }
    // no paranoia
    else {
      encryption.cipher = crypto.createCipher(algorithm, camoOptions.password);
      callback(encryption);
    }
  }

  function _getDecryption(camoOptions, callback) {
    var decryption = { success: false, error: null, cipher: null },
        decypher;

    if (camoOptions.paranoia) {
      //read password and iv from hat file
      var hatFile = fs.readFile(camoOptions.hat, (err, data) => {
        if (err)
          decryption.error = err.message;
        else {
          try {
            var keyIV = JSON.parse(data);
            decryption.cipher = crypto.createDecipheriv(
              algorithm,
              new Buffer(keyIV.key,'hex'),
              new Buffer(keyIV.iv, 'hex')
            );
            decryption.success = true;
          }
          catch (parseError){
            decryption.error = 'Something went wrong parsing the hat file';
          }
        }
        callback(decryption);
      });
    }
    // no paranoia
    else {
      decryption.cipher = crypto.createDecipher(algorithm, camoOptions.password);
      decryption.success = true;
      callback(decryption);
    }
  }

  function _buildHideStream(camoOptions, callback) {
      /*
        Picamo stream structure:
            +---------------------------------------------------------------+
            + Header Section (marker)                                       +
            + Variable size: Picamo default marker or custom user marker    +
            +---------------------------------------------------------------+
            + Compression Indicator                                         +
            + 1 byte: 0 - not compressed; 1 compressed                      +
            +---------------------------------------------------------------+
            + Encrypted Contents Section                                    +
            +---------------------------------------------------------------+
            +   ---------------------------------------------------------   +
            +   | Hidden file name size                                 |   +
            +   | 2 bytes: UInt16 (Low Endian)                          |   +
            +   ---------------------------------------------------------   +
            +   ---------------------------------------------------------   +
            +   | Hidden file name                                      |   +
            +   | Variable size                                         |   +
            +   ---------------------------------------------------------   +
            +   ---------------------------------------------------------   +
            +   | Hidden file name CRC32                                |   +
            +   | 4 bytes: Int32 (Low Endian)                           |   +
            +   ---------------------------------------------------------   +
            +   ---------------------------------------------------------   +
            +   | Hidden file content                                   |   +
            +   | Variable size                                         |   +
            +   ---------------------------------------------------------   +
            +---------------------------------------------------------------+
      */
      var combinedStream = CombinedStream.create(),
          sourceFileStream = CombinedStream.create(),
          zip = zlib.createGzip(),
          illusioSignature = new Buffer(marker, "hex"),
          hiddenFile = fs.createReadStream(camoOptions.file),
          fileNameSize = new Buffer(2),
          buildResult = { stream: null, hat: null };

      //start by adding our signature
      combinedStream.append(illusioSignature);
      //add compression Indicator
      combinedStream.append(Buffer.from(
        [camoOptions.compress ? 1 : 0]
      ));
      //now get the encryption since we need it for the remaining contents
      _getEncryption(camoOptions, (encryption) => {
        var fileName = Buffer.from(
          path.basename(camoOptions.file),
          'utf8'
        );

        //add the hidden file name size
        fileNameSize.writeInt16LE(fileName.length);
        sourceFileStream.append(fileNameSize);
        //add the hidden file name
        sourceFileStream.append(fileName);
        //and it's CRC32
        sourceFileStream.append(_getHiddenFileNameCRC(fileName));
        //finally, add the file itself
        sourceFileStream.append(hiddenFile);
        // check if compression is on
        if (camoOptions.compress)
          combinedStream.append(sourceFileStream.pipe(zip).pipe(encryption.cipher));
        else
          combinedStream.append(sourceFileStream.pipe(encryption.cipher));

        buildResult.hat = encryption.keyIV;
        buildResult.stream = combinedStream;
        callback(buildResult);
      });
  }

  function _buildShowStream(camoOptions, header, callback) {
    /*
      start reading image at marker offset, this should
      give us our camo data
    */
    var picamoHeader = new Buffer(jpegEOF.concat(marker),'hex'),
        headerLength = picamoHeader.picamoHeader,
        unzip = zlib.createGunzip(),
        camoFile = fs.createReadStream(
          camoOptions.image,
          { start: header.start, end: header.fileSize }
        ),
        hiddenFileName = [],
        hiddenFileStream = CombinedStream.create(),
        streamResult = { stream: null, fileName: null, error: null };

    //decrypt contents
    _getDecryption(camoOptions, (decryption) => {
      if (!decryption.success) {
        streamResult.error = decryption.error;
        callback(streamResult);
      }
      else {
        var unpackStream = CombinedStream.create();
        var foundFileName = false;

        //decrypt the stream
        if (camoOptions.compress) {
          //unzip if compressed
          unpackStream.append(
            camoFile
            .pipe(decryption.cipher)
            .pipe(unzip)
            .on('error', (unzipError) => {
              //if the password was wrong, the stream is just garbage
              streamResult.error = 'Cannot decompress. Possible causes:\n\r\
              \n\r-Wrong password\
              \n\r-Corrupted file';
              callback(streamResult);
            })
          );
        }
        else
          unpackStream.append(camoFile.pipe(decryption.cipher));

        //pause the stream, we don't want it in flowing mode right now
        unpackStream.pause();

        unpackStream.on('end', () => {
          if (streamResult.error == null) {
            streamResult.stream = hiddenFileStream;
            callback(streamResult);
          }
        });

        unpackStream.on('data', (hiddenFileContentChunk) => {
          //if the CRC passed, then the file should be ok, read it
          if (streamResult.error ==null)
              hiddenFileStream.append(hiddenFileContentChunk);
        });

        unpackStream.on('readable', () => {
          if (streamResult.fileName == null) {
            //get the hidden file name size
            var hiddenFileNameSize = unpackStream.read(2).readUInt16LE(0);
            //now we know the size, get the file name
            var hiddenFileName = unpackStream.read(hiddenFileNameSize);
            //get the stored and the computed file name CRC32
            var crc32Stored = unpackStream.read(4).readUInt32LE(0);
            //check if they match
            if (crc32Stored !== _getHiddenFileNameCRC(hiddenFileName).readUInt32LE(0)) {
              //something is wrong
              streamResult.error = 'File name CRC fail. Possible causes:\n\r\
              \n\r-Wrong password\
              \n\r-Corrupted file';
              callback(streamResult);
            }
            else {
              streamResult.fileName = hiddenFileName.toString('utf8');
              //back to flowing mode, data event will fetch hiden file content
              unpackStream.resume();
            }
          }
        });
      }
    });
  }

  var unpack = function (camoOptions, callback) {
      //check for custom marker
      if (camoOptions.marker != null)
        marker = camoOptions.marker;

      _getPicamoSection(camoOptions.image, (headerResult) => {
        var unpackResult = { success: false, message: null };

        if (!headerResult.found) {
          unpackResult.message = 'No header found in image. Possible causes:\n\r\
          \n\r-No camo present in image\
          \n\r-Wrong --marker specified';
          callback(unpackResult);
        }
        else {
          if (headerResult.compressed !=0 & headerResult.compressed !=1) {
            unpackResult.message = 'Wrong compression indicator. Possible causes:\n\r\
            \n\r-Wrong password\
            \n\r-Corrupted file';
            callback(unpackResult);
          }
          else {
            camoOptions.compress = headerResult.compressed == 0 ? false : true;
            _buildShowStream(camoOptions, headerResult, (streamResult) => {
              if (streamResult.error != null) {
                  unpackResult.message = streamResult.error;
                  callback(unpackResult);
              }
              else
              {
                var output = fs.createWriteStream(streamResult.fileName);

                output.on('finish', function () {
                  unpackResult.success = true;
                  unpackResult.message = util.format(
                    'Extracted hidden file \'%s\'.', streamResult.fileName
                  );
                  callback(unpackResult);
                });
                streamResult.stream.pipe(output);
              }
            });
          }
        }
      });
  }

  var pack = function(camoOptions, callback) {
      var packResult = { success: false, message: null, hat: null },
          combinedStream = CombinedStream.create(),
          camoImage = util.format('%s.enc.jpg', camoOptions.image),
          input = fs.createReadStream(camoOptions.image),
          output = fs.createWriteStream(camoImage),
          hatFile = util.format('%s.enc.key', camoOptions.image);

      output.on('finish', function () {

        //calculate image size increase
        var stats = fs.statSync(camoImage);
        var camoSize = stats["size"];

        packResult.success = true;
        packResult.message = util.format(
          '%s successfully written.\n\r%s%s',
          camoImage,
          util.format(
            'Image size: %d bytes, camo image size: %d bytes ' +
            '-> %d% increase',
            camoOptions.imageSize,
            camoSize,
            Math.round( (camoSize / camoOptions.imageSize) * 100) /100
          ),
          camoOptions.paranoia
          ? util.format ('\n\rDon\'t forget your %s key file.', hatFile)
          : ''
        );

        //if we used paranoia, generate the key file
        if (camoOptions.paranoia) {
          var hatStream = fs.createWriteStream(hatFile);
          hatStream.write(JSON.stringify({
            key : packResult.hat.key.toString('hex'),
            iv: packResult.hat.iv.toString('hex')
          }));
          hatStream.end();
        }

        callback(packResult);
      });

      //check for custom marker
      if (camoOptions.marker != null)
        marker = camoOptions.marker;

      //build stream
      _buildHideStream(camoOptions, (buildResult) => {
        packResult.hat = buildResult.hat;
        combinedStream.append(input);
        combinedStream.append(buildResult.stream);
        combinedStream.pipe(output);
      });
  }

  return {
      pack:   pack,
      unpack: unpack
  };

}());
