'use strict';

/**
 * Module dependencies
 */

var Emitter = require('events').EventEmitter;
var sliced = require('sliced');
var debug = require('debug')('nightmare:ipc');

// If this process has a parent, redirect debug logs to it
if (process.send) {
  debug = function() {
    process.send(['nightmare:ipc:debug'].concat(sliced(arguments)));
  };
}

/**
 * Export `IPC`
 */

module.exports = IPC;

/**
 * Initialize `IPC`
 */

var instance = Symbol();
function IPC(process) {
  if (process[instance]) {
    return process[instance];
  }

  var emitter = process[instance] = new Emitter();
  var emit = emitter.emit;
  var callId = 0;
  var responders = {};

  // no parent
  if (!process.send) {
    return emitter;
  }

  process.on('message', function(data) {
    // handle debug logging specially
    if (data[0] === 'nightmare:ipc:debug') {
      debug.apply(null, sliced(data, 1));
    }
    emit.apply(emitter, sliced(data));
  });

  emitter.emit = function() {
    if(process.connected){
      process.send(sliced(arguments));
    }
  };

  /**
   * Call a responder function in the associated process. (In the process,
   * responders can be registered with `ipc.respondTo()`.) The last argument
   * should be a callback function, which will called with the results of the
   * responder.
   * This returns an event emitter. You can listen for the results of the
   * responder using the `end` event (this is the same as passing a callback).
   * Additionally, you can listen for `data` events, which the responder may
   * send to indicate some sort of progress.
   * @param  {String} name Name of the responder function to call
   * @param  {...Objects} [arguments] Any number of arguments to send
   * @param  {Function} [callback] A callback function that handles the results
   * @return {Emitter}
   */
  emitter.call = function(name) {
    var args = sliced(arguments, 1);
    var callback = args.pop();
    if (typeof callback !== 'function') {
      args.push(callback);
      callback = undefined;
    }

    var id = callId++;
    var progress = new Emitter();

    emitter.on(`CALL_DATA_${id}`, function() {
      progress.emit.apply(progress, ['data'].concat(sliced(arguments)));
    });

    emitter.once(`CALL_RESULT_${id}`, function() {
      progress.emit.apply(progress, ['end'].concat(sliced(arguments)));
      emitter.removeAllListeners(`CALL_DATA_${id}`);
      progress.removeAllListeners();
      progress = undefined;
      if (callback) {
        callback.apply(null, arguments);
      }
    });

    emitter.emit.apply(emitter, ['CALL', id, name].concat(args));
    return progress;
  };

  /**
   * Register a responder to be called from other processes with `ipc.call()`.
   * The responder should be a function that accepts any number of arguments,
   * where the last argument is a callback function. When the responder has
   * finished its work, it MUST call the callback. The first argument should be
   * an error, if any, and the second should be the results.
   * Only one responder can be registered for a given name.
   * @param {String} name The name to register the responder under.
   * @param {Function} responder
   */
  emitter.respondTo = function(name, responder) {
    if (responders[name]) {
      debug(`Replacing responder named "${name}"`);
    }
    responders[name] = responder;
  };

  emitter.on('CALL', function(id, name) {
    var args = sliced(arguments, 2);
    var responder = responders[name];
    var done = function() {
      emitter.emit.apply(
        emitter, [`CALL_RESULT_${id}`].concat(sliced(arguments)));
    };
    done.progress = function() {
      emitter.emit.apply(
        emitter, [`CALL_DATA_${id}`].concat(sliced(arguments)));
    };
    if (!responder) {
      return done(`Nothing responds to "${name}"`);
    }
    try {
      responder.apply(null, sliced(arguments, 2).concat([done]));
    }
    catch (error) {
      done(error);
    }
  });

  return emitter;
}
