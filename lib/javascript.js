/**
 * Module Dependencies
 */

var minstache = require('minstache')

/**
 * Run the `src` function on the client-side, capture
 * the response and logs, and send back via
 * ipc to electron's main process
 */

var execute = `
(function javascript () {
  return new Promise((resolve, reject) => {
    try {
      var fn = ({{!src}}),
        response,
        args = [];

      {{#args}}args.push({{!argument}});{{/args}}

      if(fn.length - 1 == args.length) {
        args.push(((err, v) => {
            if(err) reject(err);
            resolve(v);
          }));
        fn.apply(null, args);
      } else {
        resolve(fn.apply(null, args));
      }
    } catch(err) {
      reject(err);
    }
  });
})()
`

/**
 * Inject the `src` on the client-side, capture
 * the response and logs, and send back via
 * ipc to electron's main process
 */
var inject = `
(function javascript () {
  return new Promise((resolve, reject) => {
    try {
      resolve( (function () { {{!src}} \n})() );
    } catch(err) {
      reject(err);
    }
  });
})()
`

/**
 * Export the templates
 */

exports.execute = minstache.compile(execute)
exports.inject = minstache.compile(inject)
