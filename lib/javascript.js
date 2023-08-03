/**
 * Module Dependencies
 */

var minstache = require('minstache')

/**
 * Run the `src` function on the client-side, resolve
 * with result, or reject with error
 */

var execute = `
(function javascript () {
  return new Promise((resolve, reject) => {
    try {
      var fn = ({{!src}});
      var args = [];

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
 * Inject the `src` on the client-side, resolve
 * with result, or reject with error
 */
var inject = `
(function javascript () {
  return new Promise((resolve, reject) => {
    try {
      resolve((function () { {{!src}} \n})());
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
