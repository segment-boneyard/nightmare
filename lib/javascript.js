"use strict";
/**
 * Module Dependencies
 */

const minstache = require('minstache');

/**
 * Run the `src` function on the client-side, capture
 * the response and logs, and send back via
 * ipc to electron's main process
 */

const execute = `
    (function javascript () {
      'use strict';
      var log = console.log;
      var ipc = __nightmare.ipc;
      var result = {
        response: null,
        error: null
      };
      console.log = function() {
        ipc.send('log', Array.from(arguments).map(String));
      }
      try {
        result.response = ({{!src}})({{!args}});
      } catch (e) {
        result.error = e.message;
      } finally {
        console.log = log;
      }
      return result;
    })();
`;

/**
 * Inject the `src` on the client-side, capture
 * the response and logs, and send back via
 * ipc to electron's main process
 */

const inject = `
    (function javascript () {
      var log = console.log;
      var ipc = __nightmare.ipc;
      var result = {
        response: null,
        error: null
      };
      console.log = function() {
        'use strict';
        ipc.send('log', Array.from(arguments));
      }
      try {
        result.response = (function () { {{!src}} })();
      } catch (e) {
        result.error = e.message;
      }
      finally {
        console.log = log;
      }
      return result;
    })();
`;

/**
 * Export the templates
 */

exports.execute = minstache.compile(execute);
exports.inject = minstache.compile(inject);
