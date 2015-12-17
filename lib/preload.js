/**
 * Module Dependencies
 */

var minstache = require('minstache'),
    fs = require('fs'),
    path = require('path');

exports.preload = minstache.compile(fs.readFileSync(path.join(__dirname, 'preload-template.js')).toString());
