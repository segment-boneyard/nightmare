/**
 * DEBUG=nightmare*
 */

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
var vo = require('vo');

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

Nightmare.prototype.ready = function(fn) {
  if (this.state == 'ready') return fn();
  this.child.once('ready', fn);
  return this;
};


/**
 * Go to a `url`
 */

Nightmare.prototype.goto = function(url) {
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

Nightmare.prototype._run = function(done) {
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

Nightmare.prototype.end = function() {
  this.ending = true;
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
  Nightmare.prototype[name] = function() {
    debug('queueing action "' + name + '"');
    var args = [].slice.call(arguments);
    this._queue.push([fn, args]);
    return this;
  };
});
