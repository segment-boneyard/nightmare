/**
 * DEBUG=nightmare*
 */

var log = require('debug')('nightmare:log');
var debug = require('debug')('nightmare');

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

/**
 * Export `Nightmare`
 */

module.exports = Nightmare;

/**
 * runner script
 */

var runner = join(__dirname, 'runner.js');

/**
 * Template
 */

var template = require('./javascript');

/**
 * Initialize `Nightmare`
 *
 * @param {Object} options
 */

function Nightmare(options) {
  if (!(this instanceof Nightmare)) return new Nightmare(options);
  options = options || {};
  var electronArgs = [];
  var self = this;


  if(options.paths) {
    args.push(JSON.stringify(options.paths));
  }

  this.proc = proc.spawn(electron_path, [runner].concat(electronArgs), {
    stdio: [null, null, null, 'ipc']
  });

  process.on('uncaughtException', function(err) {
    console.error(err.stack);
    self.proc.disconnect();
    self.proc.kill();
  });

  this.state = 'initial';
  this.running = false;
  this.ending = false;
  this.ended = false;
  this._queue = [];

  this.child = child(this.proc);
  this.child.once('ready', function() {
    self.child.once('browser-initialize', function() {
      self.state = 'ready';
    });
    self.child.emit('browser-initialize', options);
  });

  // propagate console.log(...) through
  this.child.on('log', function() {
    log.apply(log, arguments);
  });

  this.child.on('page-error', function(errorMessage, errorStack) {
    log('page-error', errorMessage, errorStack);
  });

  // proporate events through to debugging
  this.child.on('did-finish-load', function () { log('did-finish-load', JSON.stringify(Array.prototype.slice.call(arguments))); });
  this.child.on('did-fail-load', function () { log('did-fail-load', JSON.stringify(Array.prototype.slice.call(arguments))); });
  this.child.on('did-frame-finish-load', function () { log('did-frame-finish-load', JSON.stringify(Array.prototype.slice.call(arguments))); });
  this.child.on('did-start-loading', function () { log('did-start-loading', JSON.stringify(Array.prototype.slice.call(arguments))); });
  this.child.on('did-stop-loading', function () { log('did-stop-loading', JSON.stringify(Array.prototype.slice.call(arguments))); });
  this.child.on('did-get-response-details', function () { log('did-get-response-details', JSON.stringify(Array.prototype.slice.call(arguments))); });
  this.child.on('did-get-redirect-request', function () { log('did-get-redirect-request', JSON.stringify(Array.prototype.slice.call(arguments))); });
  this.child.on('dom-ready', function () { log('dom-ready', JSON.stringify(Array.prototype.slice.call(arguments))); });
  this.child.on('page-favicon-updated', function () { log('page-favicon-updated', JSON.stringify(Array.prototype.slice.call(arguments))); });
  this.child.on('new-window', function () { log('new-window', JSON.stringify(Array.prototype.slice.call(arguments))); });
  this.child.on('will-navigate', function () { log('will-navigate', JSON.stringify(Array.prototype.slice.call(arguments))); });
  this.child.on('crashed', function () { log('crashed', JSON.stringify(Array.prototype.slice.call(arguments))); });
  this.child.on('plugin-crashed', function () { log('plugin-crashed', JSON.stringify(Array.prototype.slice.call(arguments))); });
  this.child.on('destroyed', function () { log('destroyed', JSON.stringify(Array.prototype.slice.call(arguments))); });
}

/**
 * ready
 */

Nightmare.prototype.ready = function(fn) {
  if (this.state == 'ready') return fn();
  this.child.once('ready', fn);
  return this;
};


/**
 * Go to a `url`
 */

Nightmare.prototype.goto = function(url) {
  debug('queueing action "goto" for %s', url);
  var child = this.child;
  this.queue(function(fn) {
    child.once('goto', fn);
    child.emit('goto', url);
  });
  return this;
};

/**
 * run
 */

Nightmare.prototype.run = function(fn) {
  var ready = [this.ready.bind(this)];
  var steps = [ready].concat(this.queue());
  this.running = true;
  this._queue = [];
  var self = this;

  // kick us off
  next();

  // next function
  function next (err, res) {
    var item = steps.shift();
    if (!item) return done.apply(self, arguments);
    var args = item[1] || [];
    var method = item[0];
    args.push(once(after));
    method.apply(self, args);
  }

  function after (err, res) {
    var args = sliced(arguments);
    self.child.once('continue', function() {
      next.apply(self, args);
    });
    self.child.emit('continue');
  }

  function done () {
    self.running = false;
    if (self.ending) {
      self.proc.disconnect();
      self.proc.kill();
      self.ended = true;
    }
    return fn.apply(self, arguments);
  }

  return this;
};

/**
 * evaluate
 */

Nightmare.prototype._evaluate = function(js_fn, done) {
  var child = this.child;

  child.once('javascript', function(err, result) {
    if (err) return done(err);
    done(null, result);
  });

  var args = Array.prototype.slice.call(arguments).slice(2);
  var argsList = JSON.stringify(args).slice(1,-1);

  child.emit('javascript', template.execute({ src: String(js_fn), args: argsList }));
  return this;
};

/**
 * inject javascript
 */

Nightmare.prototype._inject = function(js, done) {
  var child = this.child;

  child.once('javascript', function(err, result) {
    if (err) return done(err);
    done(null, result);
  });

  child.emit('javascript', template.inject({ src: js }));
  return this;
};

/**
 * end
 */

Nightmare.prototype.end = function(done) {
  this.ending = true;

  if (done && !this.running && !this.ended) {
    this.run(done);
  }

  return this;
};

/**
 * on
 */

Nightmare.prototype.on = function(event, handler) {
  this.child.on(event, handler);
  return this;
};

/**
 * Queue
 */

Nightmare.prototype.queue = function(done) {
  if (!arguments.length) return this._queue;
  var args = sliced(arguments);
  var fn = args.pop();
  this._queue.push([fn, args]);
};


/**
 * then
 */

Nightmare.prototype.then = function(fulfill, reject) {
  var self = this;
  var proc = this.proc;

  this.run(function(err, result) {
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
  Nightmare.prototype[name] = function() {
    debug('queueing action "' + name + '"');
    var args = [].slice.call(arguments);
    this._queue.push([fn, args]);
    return this;
  };
});
