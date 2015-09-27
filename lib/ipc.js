/**
 * Module dependencies
 */

var Emitter = require('events').EventEmitter;
var sliced = require('sliced');

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
    emit.apply(emitter, sliced(data));
  });

  emitter.emit = function() {
    if(process.connected){
      process.send(sliced(arguments));
    }
  }

  return emitter;
}
