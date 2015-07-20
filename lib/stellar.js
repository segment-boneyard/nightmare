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
var actions = require('./actions');
var enqueue = require('enqueue');
var join = require('path').join;
var sliced = require('sliced');
var child = require('./ipc');
var once = require('once');
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

  process.on('uncaughtException', function(err) {
    console.error(err.stack);
    self.proc.disconnect();
    self.proc.kill();
  })

  this.state = 'initial';
  this.ending = false;
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
 * run
 */

Stellar.prototype._run = function(done) {
  var ready = [this.ready.bind(this)];
  var steps = [ready].concat(this.queue());
  this._queue = [];
  var self = this;

  // kick us off
  next()

  // next function
  function next (err, res) {
    var item = steps.shift();
    if (!item) return done.apply(self, arguments);
    var args = item[1] || [];
    var method = item[0];
    args.push(once(next));
    method.apply(self, args);
  }

  return this;
};

/**
 * evaluate
 */

Stellar.prototype._evaluate = function(js_fn, done) {
  var child = this.child;

  child.once('javascript', function(err, result) {
    if (err) return done(err);
    done(null, result);
  });
  child.emit('javascript', template({ src: source(js_fn) }));
  return this;
};

/**
 * end
 */

Stellar.prototype.end = function() {
  this.ending = true;
  return this;
};

/**
 * Queue
 */

Stellar.prototype.queue = function(done) {
  if (!arguments.length) return this._queue;
  var args = sliced(arguments);
  var fn = args.pop();
  this._queue.push([fn, args]);
};


/**
 * then
 */

Stellar.prototype.then = function(fulfill, reject) {
  var self = this;
  var proc = this.proc;

  this.run(function(err, result) {
    if (self.ending) {
      proc.disconnect();
      proc.kill();
    }

    if (err) reject(err);
    else fulfill(result);
  });

  return this;
};

/**
 * Attach all the actions.
 */

Object.keys(actions).forEach(function (name) {
  var fn = actions[name];
  Stellar.prototype[name] = function() {
    debug('queueing action "' + name + '"');
    var args = [].slice.call(arguments);
    this._queue.push([fn, args]);
    return this;
  };
});
