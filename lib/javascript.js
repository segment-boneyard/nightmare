/**
 * Module Dependencies
 */

const minstache = require('minstache');

/**
 * Run the `src` function on the client-side, capture
 * the response
 */

const execute = `
;(function javascript () {
  var fn = ({{!src}});
  var response;
  var args = [];

  {{#args}}args.push({{!argument}});{{/args}}

  if ((fn.length - 1) === args.length) {
    return new Promise((resolve, reject) => {
      args.push(((err, v) => {
        if (err) {
          reject(err);
        } else {
          resolve(v);
        }
      }));

      fn.apply(null, args);
    });
  } else {
    return fn.apply(null, args);
  }
})();
`;

/**
 * Inject the `src` on the client-side, capture
 * the response
 */

const inject = `
(function javascript () {
  var response = (function () { {{!src}} \n})();
  return response;
})()
`;

/**
 * Export the templates
 */

exports.execute = minstache.compile(execute);
exports.inject = minstache.compile(inject);
