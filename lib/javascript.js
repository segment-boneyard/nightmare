/**
 * Module Dependencies
 */

var minstache = require('minstache');

/**
 * Export the template
 */

module.exports = minstache.compile(wrap(javascript));

/**
 * Wrap in a self-invoking function
 *
 * @param {Function} fn
 * @return {String}
 */

function wrap(fn) {
  return '(' + fn.toString() + ')()';
}

/**
 * Run the `src` on the client-side, capture
 * the response and logs, and send back via
 * ipc to electron's main process
 */

function javascript () {
  var log = console.log;
  var ipc = require('ipc');
  var sliced = require('sliced')

  console.log = function() {
    ipc.send('log', sliced(arguments));
  }

  try {
    var response = (function() {
      {{src}}
    })()
    ipc.send('response', response);
  } catch (e) {
    ipc.send('error', e.message);
  }

  console.log = log;
}
