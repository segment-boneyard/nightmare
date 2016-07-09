/**
 * Module Dependencies
 */

var minstache = require('minstache');

/**
 * Run the `src` function on the client-side, capture
 * the response and logs, and send back via
 * ipc to electron's main process
 */

var execute = `
  (function javascript () {
    var ipc = __nightmare.ipc;
    return (Promise
      .resolve()
      .then(function execute() { return ({{!src}})({{!args}}); })
      .then(function send(result) { ipc.send('response', result); })
      .catch(function catcherr(error) { ipc.send('error', error.message); })
    )
  })()
`

/**
 * Inject the `src` on the client-side, capture
 * the response and logs, and send back via
 * ipc to electron's main process
 */

var inject = `
  (function javascript () {
    var ipc = __nightmare.ipc;
    try {
      var response = (function () { {{!src}} \n})()
      ipc.send('response', response);
    } catch (e) {
      ipc.send('error', e.message);
    }
  })()
`

/**
 * Export the templates
 */

exports.execute = minstache.compile(execute);
exports.inject = minstache.compile(inject);
