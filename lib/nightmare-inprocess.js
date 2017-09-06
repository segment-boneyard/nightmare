'use strict';
var Emitter = require('events').EventEmitter;
var Readable = require('stream').Readable;
var ipc = require('./ipc');
var util = require('util');
var pid = 1;
var sliced = require('sliced');
var RunnerInstance = require('./runner-instance');

module.exports = NightmareInProcess;
/**
 * Acts a ChildProcess replacement and co-ordinate runner instance execution for in-process running
 */
function NightmareInProcess(inProcessOptions)
{
  if (!(this instanceof NightmareInProcess)) return new NightmareInProcess(inProcessOptions);
  if (inProcessOptions === true)
    inProcessOptions = {exitOnQuit: false};

  Emitter.call(this);
  this.connected = true;
  this.pid = 'IP' + pid++; // Fake process id for tests
  this.stdout = new SimpleReadable();
  this.stderr = new SimpleReadable();
  this.ipc = ipc(this);
  this.ipc.on('close',() => {
    this.emit('close');
  })
  setTimeout(() => {
    this.runnerInstance = new RunnerInstance(this.ipc,inProcessOptions);

  },1)
}

util.inherits(NightmareInProcess,Emitter);

NightmareInProcess.prototype.kill = function(signal)
{
  if (this.runnerInstance && this.runnerInstance.kill)
    this.runnerInstance.kill(signal);
};

NightmareInProcess.prototype.send = function()
{
  this.emit.apply(this,['message'].concat(sliced(arguments)));
};
function SimpleReadable(options)
{
  if (!(this instanceof SimpleReadable)) return new SimpleReadable(options);
  Readable.call(this,options);
}

SimpleReadable.prototype._read = function(size)
{

};

util.inherits(SimpleReadable,Readable);





