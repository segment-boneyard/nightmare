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
  var nightmare = window.__nightmare || window[''].nightmare;
  try {
    var fn = ({{!src}}), 
      response, 
      args = [];

    {{#args}}args.push({{!argument}});{{/args}}

    if(fn.length - 1 == args.length) {
      args.push(((err, v) => {
          if(err) return nightmare.reject(err);
          nightmare.resolve(v);
        }));
      fn.apply(null, args);
    } 
    else {
      response = fn.apply(null, args);
      if(response && response.then) {
        response.then((v) => {
          nightmare.resolve(v);
        })
        .catch((err) => {
          nightmare.reject(err)
        });
      } else {
        nightmare.resolve(response);
      }
    }
  } catch (err) {
    nightmare.reject(err);
  }
})()
`

/**
 * Inject the `src` on the client-side, capture
 * the response and logs, and send back via
 * ipc to electron's main process
 */

var inject = `
(function javascript () {
  var nightmare = window.__nightmare || window[''].nightmare;
  try {
    var response = (function () { {{!src}} \n})()
    nightmare.resolve(response);
  } catch (e) {
    nightmare.reject(e);
  }
})()
`

/**
 * Export the templates
 */

exports.execute = minstache.compile(execute)
exports.inject = minstache.compile(inject)
