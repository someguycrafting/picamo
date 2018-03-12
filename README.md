# Picamo
![Picamo logo](https://github.com/someguycrafting/picamo/blob/master/logo/logo.png)

```text
.
  ____   _        _                                                
 |  _ \ (_)  ___ | |_  _   _  _ __  ___                            
 | |_) || | / __|| __|| | | || '__|/ _ \                           
 |  __/ | || (__ | |_ | |_| || |  |  __/                           
 |_|    |_| \___| \__| \__,_||_|   \___|                           
   ____                                  __  _                     
  / ___| __ _  _ __ ___    ___   _   _  / _|| |  __ _   __ _   ___
 | |    / _` || '_ ` _ \  / _ \ | | | || |_ | | / _` | / _` | / _ \
 | |___| (_| || | | | | || (_) || |_| ||  _|| || (_| || (_| ||  __/
  \____|\__,_||_| |_| |_| \___/  \__,_||_|  |_| \__,_| \__, | \___|
                                                       |___/       
                                                                    .
```                        

## Overview
---

What if you could hide your data in plain sight? E-mail or share a picture on Facebook, Twitter, Instagram, or any other platform of your choice, that had encrypted files hidden inside, that only you or someone you wanted could have access to?  "More than meets the eye" gets a whole new meaning.

Picamo is a [steganography](https://en.wikipedia.org/wiki/Steganography") tool written in Node JS, that enables the concealment of any type of file inside a JPEG image.

Data concealed in the image is encrypted using [AES](en.wikipedia.org/wiki/Advanced_Encryption_Standard) [CTR](https://en.wikipedia.org/wiki/Block_cipher_mode_of_operation), and it's also possible to use an [initialization vector](https://en.wikipedia.org/wiki/Initialization_vector") for increased security.

## Getting started
Download or clone the repository into a folder and then fetch Picamo dependencies
```sh
$ npm install
```
## Usage (CLI)

```text
node picamo -c <command> [-f source file] [-i image] [-p password] [--options]
```
#### `command`
Action to perform.<br/>
Use `hide` to hide a file inside an image or `show` to reveal it.

#### `source file`
Path to the file you want to hide inside the image.<br/>
Only used with command `hide`.

#### `image`
Path to the image you want to process.

`command`   | Description
------------|------------
hide        | Target image where the source file will be hidden.<br/>Ignored if you specify the `autoimage` option.
show        | Source image from where to extract the hidden file.

#### `password`
The password for encryption/decryption of the hidden content. <br/>Ignored if you specify the `paranoia` option.

#### `options`
Option        | Description
--------------|------------
`paranoia`    | File content is encrypted with an auto generated 32 byte key and a 16 byte initialization vector.<br/>**In this case, a file containing both will also be created while using command `hide`. Don't loose it, or it won't be possible to recover hidden content!**
`hat`         | Path to the key file generated while using `paranoia`.<br/>Mandatory if using option paranoia with command `show`.
`marker`      | This option allows for a definition of a custom Picamo signature marker (hex zero padded format, minimun 4 characters), instead of the default one.<br/>Useful, for instance, to avoid signature detection algorithms.<br/>**Use the same marker to hide and show content, or it will fail!**
`nocomp`      | Disable Picamo compression of the hidden content.<br/>By default, Picamo compresses the hidden file using [gzip](https://en.wikipedia.org/wiki/Gzip). While this should give good results for most data, you may want to disable it by using this option, specially if adding highly compressed data (ex: rar, 7z, pdf files).
`autoimage`   | If you don't want to supply your own image, Picamo can fetch one automatically through [LoremFlickr](http://loremflickr.com), using the tags and size you provide. This parameter should be in the comma delimited format, image tags first and size (width x height) last.
`help`   | Show the help screen (more or less what you have here).

## Usage examples
----------
>#### Hiding
While performing hide operations, if everything goes well, you should see an output like this:
```text
/source_image_path/img.jpg.enc.jpg successfully written.
Image size: xxxxx bytes, camo image size: xxxxx bytes -> x% increase
```
A new file named 'img.jpg.enc.jpg' will be placed on the same folder as 'img.jpg'.
The message output will inform you not obly abou this, but also about the original image size, the camo image (image with hidden content) size, and the percentage increase in image file size. Regarding camo image size, two things should be accounted for:
* 1 The use of `nocomp` option. Read about it in the options section above.
* 2 Avoid placing a large file inside a small image, since this may raise suspicions, should anyone look at the file vs image size. If you have a big file to hide, use a big image.

###### Hide 'doc.pdf' inside 'img.jpg' using password 'mypassword'
```text
node picamo -c hide -p mypassword -i /source_image_path/img.jpg -f /file_to_hide_path/doc.pdf
```
###### Same as before, but instead of supplying our own image, use an auto fetched one with the tags "cute" and "cats", and a size of 640x480. Also, don't use internal compression.
```text
node picamo -c hide -p mypassword -f /file_to_hide_path/doc.pdf --autoimage cats,cute,640x480 --nocomp
```
###### Hide 'secret_docs.zip' inside 'img.jpg' using paranoia, no internal compression and a custom marker 'MyMarker' (hex encoded, see `marker` option).
```text
node picamo -c hide -i /source_image_path/img.jpg -f /file_to_hide_path/secret_docs.zip --nocomp --paranoia --marker 4d794d61726b6572
```

>#### Showing
While performing show operations, if everything goes well, you should see an output like this:
```text
Hidden file 'filename' successfully extracted.
```

###### Extract hidden file from 'img.jpg.enc.jpg' using password 'mypassword'
```text
node picamo -c show -p mypassword -i /source_image_path/img.jpg.enc.jpg
```

###### Extract hidden file from 'img.jpg.enc.jpg' using password 'mypassword', and the custom marker 'MyMarker' (hex encoded, see `marker` option)
```text
node picamo -c show -p mypassword -i /source_image_path/img.jpg.enc.jpg --marker 4d794d61726b6572
```

###### Extract hidden file from 'img.jpg.enc.jpg' using a hat file. In this example, the image and was processed using `paranoia` option and key file was also generated. This is the file we should supply through the `hat` option.

```text
node picamo -c show -i /source_image_path/img.jpg.enc.jpg --paranoia --hat /image_key_path/img.jpg.enc.key
```

## FAQ
* **So, how exactly does this work?**

  Picamo works by exploiting the way most software processes JPEG images. Basically, a JPEG image has a series of markers that get read until the software assumes the image data has ended or, for the geeks:
  > Read 0xFF. Read marker. Read the length specifier L and skip forward by L - 2 bytes. After an SOS (0xFFDA) segment (followed by compressed data) skip forward to the first 0xFF not followed by 0x00 or 0xD0-0xD8. Repeat from start until you encounter 0xFFD9.

  Data written after this is completely disregarded, and that's Picamo's playground.

* **Where can I place a picture with hidden content encoded with Picamo?**

  Facebook, Instagram, Twitter, Gmail, just to name a few, but it should work pretty much everywhere.

* **Can a picture with hidden content survive image manipulation software like Photoshop or Gimp?**

  I don't think so. Although you'll be able to read an image with hidden content on them, as soon as you save it, that extra part of information that wasn't supposed to be there will get removed. Remember, these are programs specialized in image processing, they know their business.

## Logo attribution
Picamo logo icon made by [Freepik](http://www.flaticon.com/authors/freepik) from [www.flaticon.com](www.flaticon.com)

## License
Picamo is published under a GPLv3 license.
