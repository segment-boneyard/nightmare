/**
 * Module Dependencies
 */

var m = require('multiline').stripIndent;
var minstache = require('minstache');

/**
 * Export the template
 */

module.exports = minstache.compile(m(function() {/*
  (function() {
    var log = console.log;
    var ipc = require('ipc');
    var sliced = require('sliced')

    console.log = function() {
      ipc.send('log', sliced(arguments));
    }

    try {
      var ret = (function() {
        {{src}}
      })()
      ipc.send('result', ret);
    } catch (e) {
      ipc.send('error', e.message);
    }

    console.log = log;
  })()
*/}));

// module.exports = minstache.compile(m(function() {/*
//   require('ipc').send('result', 'hi')
// */}));
