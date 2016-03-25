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
      var log = console.log;
      var ipc = __nightmare.ipc;
      var result = {
        response: null,
        error: null
      };
      console.log = function() {
        'use strict';
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
        ipc.send('log', Array.from(arguments).map(String));
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

const evalAsync = String(function (fn, args) {
    var log = console.log;
    var ipc = __nightmare.ipc;
    console.log = function () {
        'use strict';
        return ipc.send('log', (Array.from(arguments)).map(String));
    };
    var done = function (err, response) {
        ipc.send('javascript', {
            error: err,
            response: response
        });
    };
    var isAsync = function (fn) {
        return fn.length === args.length + 1;
    };
    var isGenerator = function (fn) {
        return typeof fn === 'function' && /^function[\s]*\*/.test(fn);
    };
    var isPromise = function (v) {
        return typeof v.then === 'function';
    };
    var evalAsync = function () {
        args.push(function (err, res) {
            if (err) {
                return done(err);
            }
            return done(null, res);
        });
        return fn.apply(null, args);
    };
    var evalGenerator = function () {
        var gen, last, next, prev;
        gen = fn.apply(null, args);
        last = null;
        prev = null;
        next = function (value) {
            var err, error, promise, res;
            try {
                res = gen.next(value);
            } catch (error) {
                err = error;
                return done(err);
            }
            prev = last;
            last = res.value;
            if (isPromise(promise = res.value)) {
                return promise.then(function (value) {
                    return next(value);
                })["catch"](function (err) {
                    return done(err);
                });
            } else if (!res.done) {
                return next(res.value);
            } else {
                return done(null, last != null ? last : prev);
            }
        };
        return next();
    };
    var evalSync = function () {
        return fn.apply(null, args);
    };

    var response;
    if (isAsync(fn)) {
        return evalAsync();
    }
    if (isGenerator(fn)) {
        return evalGenerator();
    }

    try {
        response = evalSync();
    } catch (error) {
        return done(error);
    }

    if (isPromise(response)) {
        response.then(function (value) {
            return done(null, value);
        })["catch"](function (err) {
            return done(err);
        });
        return;
    }
    return done(null, response);
});

/**
 * Export the templates
 */

exports.execute = minstache.compile(execute);
exports.inject = minstache.compile(inject);
exports.evaluateAsync = evalAsync;