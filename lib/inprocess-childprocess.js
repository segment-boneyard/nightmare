'use strict';
var Emitter = require('events').EventEmitter;
var util = require('util');
var pid = 1;
/**
 * Simulates a Node.js ChildProcess instance returned from process.spawn when using Nightmare in-process support
 */
function InProcessChildProcess(runnerInstance)
{
  if (!(this instanceof InProcessChildProcess)) return new InProcessChildProcess(runnerInstance);

  Emitter.call(this);
  // Implement following
  this.pid = 'IP' + pid++; // Fake process id

  this.stderr = null; // ChildProcess.stderr
  this.stdout = null; // ChildProcess.stdout
  this.on = null; // Emitter .on
  this.removeAllListeners; // Emitter
  this.connected; // ChildProcess.connected
  this.kill; // ChildProcess.kill

}

util.inherits(InProcessChildProcess,Emitter);


