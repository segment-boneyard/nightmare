"use strict";
/**
 * Module dependencies
 */

var Emitter = require('events').EventEmitter;
//Emitter.defaultMaxListeners = 0;

/**
 * Export `IPC`
 */

module.exports = IPC;

/**
 * Initialize `IPC`
 */

function IPC(process) {
  var emitter = new Emitter();
  var emit = emitter.emit;

  // no parent
  if (!process.send) {
    return emitter;
  }

  process.on('message', function(data) {
    emit.apply(emitter, Array.from(data));
  });

  emitter.emit = function() {
    if(process.connected){
        process.send(Array.from(arguments));
    }
  }

  return emitter;
}
