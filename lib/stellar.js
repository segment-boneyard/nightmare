/**
 * DEBUG=stellar*
 */

var debug = require('debug')('stellar');

/**
 * Module dependencies
 */

var electron_path = require('electron-prebuilt');
var source = require('function-source');
var proc = require('child_process');
var enqueue = require('enqueue');
var yieldly = require('yieldly');
var join = require('path').join;
var sliced = require('sliced');
var child = require('./ipc');
var noop = function() {};
var vo = require('vo');

/**
 * Export `Stellar`
 */

module.exports = Stellar;

/**
 * runner script
 */

var runner = join(__dirname, 'runner.js');

/**
 * Template
 */

var template = require('./javascript');

/**
 * Initialize `Stellar`
 *
 * @param {Object} options
 */

function Stellar(options) {
  if (!(this instanceof Stellar)) return new Stellar(options);
  options = options || {};
  var self = this;

  this.proc = proc.spawn(electron_path, [runner], {
    stdio: [null, null, null, 'ipc']
  });

  this.state = 'initial';
  this._queue = [];

  this.child = child(this.proc);
  this.child.once('ready', function() {
    self.state = 'ready';
  });

  // queue up the run calls
  this.run = enqueue(this._run.bind(this));
}

/**
 * ready
 */

Stellar.prototype.ready = function(fn) {
  if (this.state == 'ready') return fn();
  this.child.once('ready', fn);
  return this;
};


/**
 * Go to a `url`
 */

Stellar.prototype.goto = function(url) {
  var child = this.child;
  this.queue(function(fn) {
    child.once('goto', fn);
    child.emit('goto', url);
  })
  return this;
};

/**
 * Click
 */

Stellar.prototype.click = function(selector) {

  return this;
};

/**
 * type
 */

Stellar.prototype.type = function() {
  return this;
};

/**
 * run
 */

Stellar.prototype._run = function(done) {
  var ready = this.ready.bind(this);
  var steps = [ready].concat(this.queue());
  this._queue = [];

  // run through the steps sequentially
  vo.apply(vo, steps).pipeline(false)(done);

  return this;
};

/**
 * evaluate
 */

Stellar.prototype.evaluate = function(js, cb) {
  var child = this.child;
  this.queue(function(fn) {
    child.once('javascript', function(err, result) {
      if (err) return fn(err);
      cb(result);
      fn(null, result);
    });
    child.emit('javascript', template({ src: source(js) }));
  });
  return this;
};

/**
 * end
 */

Stellar.prototype.end = function(done) {
  done = done || noop;

  var proc = this.proc;

  // cleanup
  this.queue(function(fn) {
    proc.disconnect();
    proc.kill();
    fn()
  })

  return this.run(done);
};

/**
 * Queue
 *
 * TODO: fix vo(...) to be middleware
 */

Stellar.prototype.queue = function(done) {
  if (!arguments.length) return this._queue;

  this._queue.push(function(a, b, c, d, e, f, g) {
    var fn = sliced(arguments).pop();
    done(fn);
  })
};


/**
 * then
 */

Stellar.prototype.then = function(fulfill, reject) {
  this.run(function(err, result) {
    if (err) reject(err);
    else fulfill(result);
  });

  return this;
};
