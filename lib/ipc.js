"use strict";
/**
 * Module dependencies
 */

const Emitter = require('events').EventEmitter;
//Emitter.defaultMaxListeners = 0;

let debug = require('debug')('nightmare:ipc');

// If this process has a parent, redirect debug logs to it
if (process.send) {
  debug = function () {
    process.send(['nightmare:ipc:debug'].concat(Array.from(arguments)));
  };
}

/**
 * Export `IPC`
 */

module.exports = IPC;

/**
 * Initialize `IPC`
 */
const instance = Symbol();

function IPC(process) {
  if (process[instance]) {
    return process[instance];
  }

  var emitter = process[instance] = new Emitter();
  let emit = emitter.emit;
  let callId = 0;
  let responders = {};

  // no parent
  if (!process.send) {
    return emitter;
  }

  process.on('message', function (data) {
    // handle debug logging specially
    if (data[0] === 'nightmare:ipc:debug') {
      debug.apply(null, Array.from(data).slice(1));
    }
    emit.apply(emitter, Array.from(data));
  });

  emitter.emit = function () {
    if (process.connected) {
      process.send(Array.from(arguments));
    }
  };

  /**
   * Call a responder function in the associated process. (In the process,
   * responders can be registered with `ipc.respondTo()`.) 
   * This returns a Promise that has a progress property that exposes a event emitter.
   * You can listen for the results of the responder using the `end` event (this is the same as passing a callback).
   * Additionally, you can listen for `data` events, which the responder may
   * send to indicate some sort of progress.
   * @param  {String} name Name of the responder function to call
   * @param  {...Objects} [arguments] Any number of arguments to send
   * @return {Promise}
   */
  emitter.call = function (name) {
    let args = Array.from(arguments).slice(1);
    let id = callId++;

    let finalResolve, finalReject;
    let promise = new Promise(function (resolve, reject) {
      finalResolve = resolve;
      finalReject = reject;
    });

    promise.progress = new Emitter();

    emitter.on(`CALL_DATA_${id}`, function (args) {
       let argsArray = Object.keys(args).map(key => args[key]);
      promise.progress.emit.apply(promise.progress, ['data'].concat(argsArray));
    });

    let finalize = function (args) {
      promise.progress.emit.apply(promise.progress, ['end'].concat(args));
      emitter.removeAllListeners(`CALL_DATA_${id}`);
      emitter.removeAllListeners(`CALL_ERROR_${id}`);
      emitter.removeAllListeners(`CALL_RESULT_${id}`);
      promise.progress.removeAllListeners();
      promise.progress = undefined;
    };

    emitter.once(`CALL_ERROR_${id}`, function (args) {
      let argsArray = Object.keys(args).map(key => args[key]);
      finalize(argsArray);
      finalReject.apply(null, argsArray);
    });

    emitter.once(`CALL_RESULT_${id}`, function (args) {
      let argsArray = Object.keys(args).map(key => args[key]);
      finalize(argsArray);
      finalResolve.apply(null, argsArray);
    });

    emitter.emit.apply(emitter, ['CALL', id, name].concat(args));
    return promise;
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
  emitter.respondTo = function (name, responder) {
    if (responders[name]) {
      debug(`Replacing responder named "${name}"`);
    }
    responders[name] = responder;
  };

  emitter.on('CALL', function (id, name) {
    var args = Array.from(arguments).slice(2);
    var responder = responders[name];
    var done = {
      resolve: function () {
        emitter.emit(`CALL_RESULT_${id}`, arguments);
      },
      reject: function () {
        emitter.emit(`CALL_ERROR_${id}`, arguments);
      },
      progress: function () {
        emitter.emit(`CALL_DATA_${id}`, arguments);
      }
    };

    if (!responder) {
      return done.reject(`Nothing responds to "${name}"`);
    }

    try {
      responder.apply(null, Array.from(arguments).slice(2).concat([done]));
    }
    catch (error) {
      done.reject(error);
    }
  });

  return emitter;
}
