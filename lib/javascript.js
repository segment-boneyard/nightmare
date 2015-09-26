/**
 * Module Dependencies
 */

var minstache = require('minstache');

/**
 * Run the `src` function on the client-side, capture
 * the response and logs, and send back via
 * ipc to electron's main process
 */

var execute = [
  "(function javascript () {",
  "  var log = console.log;",
  "  var ipc = __nightmare.ipc;",
  "  var sliced = __nightmare.sliced;",
  "  console.log = function() {",
  "    ipc.send('log', sliced(arguments).map(String));",
  "  }",
  "  try {",
  "    var response = ({{!src}})({{!args}})",
  "    ipc.send('response', response);",
  "  } catch (e) {",
  "    ipc.send('error', e.message);",
  "  }",
  "  console.log = log;",
  "})()"
].join("\n");

/**
 * Inject the `src` on the client-side, capture
 * the response and logs, and send back via
 * ipc to electron's main process
 */

var inject = [
  "(function javascript () {",
  "  var log = console.log;",
  "  var ipc = __nightmare.ipc;",
  "  var sliced = __nightmare.sliced;",
  "  console.log = function() {",
  "    ipc.send('log', sliced(arguments));",
  "  }",
  "  try {",
  "    var response = (function () { {{!src}} })()",
  "    ipc.send('response', response);",
  "  } catch (e) {",
  "    ipc.send('error', e.message);",
  "  }",
  "  console.log = log;",
  "})()"
].join("\n");

/**
 * Export the templates
 */

exports.execute = minstache.compile(execute);
exports.inject = minstache.compile(inject);
