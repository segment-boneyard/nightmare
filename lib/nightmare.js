/**
 * DEBUG=nightmare*
 */

var log = require('debug')('nightmare:log');
var debug = require('debug')('nightmare');
var electronLog = {
  stdout: require('debug')('electron:stdout'),
  stderr: require('debug')('electron:stderr')
};

/**
 * Module dependencies
 */

var default_electron_path = require('electron-prebuilt');
var source = require('function-source');
var proc = require('child_process');
var actions = require('./actions');
var path = require('path');
var sliced = require('sliced');
var child = require('./ipc');
var once = require('once');
var split2 = require('split2');
var noop = function() {};
var keys = Object.keys;

// Standard timeout for loading URLs
const DEFAULT_GOTO_TIMEOUT = 30 * 1000;
// Standard timeout for wait(ms)
const DEFAULT_WAIT_TIMEOUT = 30 * 1000;

/**
 * Export `Nightmare`
 */

module.exports = Nightmare;

/**
 * runner script
 */

var runner = path.join(__dirname, 'runner.js');

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
  var electronArgs = {};
  var self = this;
  self.optionWaitTimeout = options.waitTimeout || DEFAULT_WAIT_TIMEOUT;
  self.optionGotoTimeout = options.gotoTimeout || DEFAULT_GOTO_TIMEOUT;

  var electron_path = options.electronPath || default_electron_path

  if (options.paths) {
    electronArgs.paths = options.paths;
  }

  if (options.switches) {
    electronArgs.switches = options.switches;
  }

  electronArgs.loadTimeout = options.loadTimeout;
  if(options.loadTimeout && options.gotoTimeout && options.loadTimeout < self.optionGotoTimeout){
    debug(`WARNING:  load timeout of ${options.loadTimeout} is shorter than goto timeout of ${self.optionGotoTimeout}`);
  }

  electronArgs.dock = options.dock || false;

  attachToProcess(this);

  // initial state
  this.state = 'initial';
  this.running = false;
  this.ending = false;
  this.ended = false;
  this._queue = [];
  this._headers = {};
  this.options = options;

  debug('queuing process start');
  this.queue((done) => {

    this.proc = proc.spawn(electron_path, [runner].concat(JSON.stringify(electronArgs)), {
      stdio: [null, null, null, 'ipc']
    });

    this.proc.stdout.pipe(split2()).on('data', (data) => {
      electronLog.stdout(data);
    });

    this.proc.stderr.pipe(split2()).on('data', (data) => {
      electronLog.stderr(data);
    });

    this.proc.on('close', (code) => {
      if(!self.ended){
        handleExit(code, self, noop);
      }
    });

    this.child = child(this.proc);
    // propagate console.log(...) through
    this.child.on('log', function() {
      log.apply(log, arguments);
    });

    this.child.on('uncaughtException', function(stack) {
      console.error('Nightmare runner error:\n\n%s\n', '\t' + stack.replace(/\n/g, '\n\t'));
      endInstance(self, noop);
      process.exit(1);
    });

    this.child.on('page', function(type) {
      log.apply(null, ['page-' + type].concat(sliced(arguments, 1)));
    });

    // propogate events through to debugging
    this.child.on('did-finish-load', function () { log('did-finish-load', JSON.stringify(Array.prototype.slice.call(arguments))); });
    this.child.on('did-fail-load', function () { log('did-fail-load', JSON.stringify(Array.prototype.slice.call(arguments))); });
    this.child.on('did-fail-provisional-load', function () { log('did-fail-provisional-load', JSON.stringify(Array.prototype.slice.call(arguments))); });
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

    this.child.once('ready', (versions) => {
      this.engineVersions = versions;
      this.child.call('browser-initialize', options, function() {
        self.state = 'ready';
        done();
      });
    });
  });

  // initialize namespaces
  Nightmare.namespaces.forEach(function (name) {
    if ('function' === typeof this[name]) {
      this[name] = this[name]()
    }
  }, this)

  //prepend adding child actions to the queue
  Object.keys(Nightmare.childActions).forEach(function(key){
    debug('queueing child action addition for "%s"', key);
    this.queue(function(done){
      this.child.call('action', key, String(Nightmare.childActions[key]), done);
    });
  }, this);
}

function handleExit(code, instance, cb){
  var help = {
    127: 'command not found - you may not have electron installed correctly',
    126: 'permission problem or command is not an executable - you may not have all the necessary dependencies for electron',
    1: 'general error - you may need xvfb',
    0: 'success!'
  };

  debug('electron child process exited with code ' + code + ': ' + help[code]);
  instance.proc.removeAllListeners();
  cb();
};

function endInstance(instance, cb) {
  instance.ended = true;
  detachFromProcess(instance);
  if (instance.proc && instance.proc.connected) {
    instance.proc.on('close', (code) => {
      handleExit(code, instance, cb);
    });
    instance.child.removeAllListeners();
    instance.proc.kill();
  } else {
    debug('electron child process not started yet, skipping kill.');
    cb();
  }
}

/**
 * Attach any instance-specific process-level events.
 */
function attachToProcess(instance) {
  instance._endNow = endInstance.bind(null, instance, noop);
  process.setMaxListeners(Infinity);
  process.on('exit', instance._endNow);
  process.on('SIGINT', instance._endNow);
  process.on('SIGTERM', instance._endNow);
  process.on('SIGQUIT', instance._endNow);
  process.on('SIGHUP', instance._endNow);
  process.on('SIGBREAK', instance._endNow);
}

function detachFromProcess(instance) {
  process.removeListener('exit', instance._endNow);
  process.removeListener('SIGINT', instance._endNow);
  process.removeListener('SIGTERM', instance._endNow);
  process.removeListener('SIGQUIT', instance._endNow);
  process.removeListener('SIGHUP', instance._endNow);
  process.removeListener('SIGBREAK', instance._endNow);
}

/**
 * Namespaces to initialize
 */

Nightmare.namespaces = [];

/**
 * Child actions to create
 */

Nightmare.childActions = {};

/**
 * Version
 */
Nightmare.version = require(path.resolve(__dirname, '..', 'package.json')).version;

/**
 * Override headers for all HTTP requests
 */

Nightmare.prototype.header = function(header, value) {
  if (header && typeof value !== 'undefined') {
    this._headers[header] = value;
  } else {
    this._headers = header || {};
  }

  return this;
};

/**
 * Go to a `url`
 */

Nightmare.prototype.goto = function(url, headers) {
  debug('queueing action "goto" for %s', url);
  var self = this;

  headers = headers || {};
  for (var key in this._headers) {
    headers[key] = headers[key] || this._headers[key];
  }

  this.queue(function(fn) {
    self.child.call('goto', url, headers, this.optionGotoTimeout, fn);
  });
  return this;
};

/**
 * run
 */

Nightmare.prototype.run = function(fn) {
  debug('running')
  var steps = this.queue();
  this.running = true;
  this._queue = [];
  var self = this;

  // kick us off
  next();

  // next function
  function next (err, res) {
    var item = steps.shift();
    // Immediately halt execution if an error has been thrown, or we have no more queued up steps.
    if (err || !item) return done.apply(self, arguments);
    var args = item[1] || [];
    var method = item[0];
    args.push(once(after));
    method.apply(self, args);
  }

  function after (err, res) {
    var args = sliced(arguments);
    if(self.child){
      self.child.call('continue', () => next.apply(self, args));
    } else {
      next.apply(self, args);
    }
  }

  function done () {
    var doneargs = arguments;
    self.running = false;
    if (self.ending) {
      return endInstance(self, () => fn.apply(self, doneargs));
    }
    return fn.apply(self, doneargs);
  }

  return this;
};

/**
 * run the code now (do not queue it)
 *
 * you should not use this, unless you know what you're doing
 * it should be used for plugins and custom actions, not for
 * normal API usage
 */

Nightmare.prototype.evaluate_now = function(js_fn, done) {
  var args = Array.prototype.slice.call(arguments).slice(2);
  var argsList = JSON.stringify(args).slice(1,-1);
  var source = template.execute({ src: String(js_fn), args: argsList });

  this.child.call('javascript', source, done);
  return this;
};

/**
 * inject javascript
 */

Nightmare.prototype._inject = function(js, done) {
  this.child.call('javascript', template.inject({ src: js }), done);
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
  this.queue(function(done){
    this.child.on(event, handler);
    done();
  });
  return this;
};

/**
 * once
 */

Nightmare.prototype.once = function(event, handler) {
  this.queue(function(done){
    this.child.once(event, handler);
    done();
  })
  return this;
};

/**
 * removeEventListener
 */

Nightmare.prototype.removeListener = function(event, handler) {
  this.child.removeListener(event, handler);
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

  return new Promise(function (success, failure) {
    self.run(function(err, result) {
      if (err) failure(err);
      else success(result);
    })
  })
  .then(fulfill, reject);
};

/**
 * catch
 */

Nightmare.prototype.catch = function(reject) {
  return this.then(undefined, reject);
};

/**
 * use
 */

Nightmare.prototype.use = function(fn) {
  fn(this)
  return this
};

// wrap all the functions in the queueing function
function queued (name, fn) {
  return function action () {
    debug('queueing action "' + name + '"');
    var args = [].slice.call(arguments);
    this._queue.push([fn, args]);
    return this;
  }
}

/**
 * Static: Support attaching custom actions
 *
 * @param {String} name - method name
 * @param {Function|Object} [childfn] - Electron implementation
 * @param {Function|Object} parentfn - Nightmare implementation
 * @return {Nightmare}
 */

Nightmare.action = function() {
  var name = arguments[0], childfn, parentfn;
  if(arguments.length === 2) {
    parentfn = arguments[1];
  } else {
    parentfn = arguments[2];
    childfn = arguments[1];
  }

  // support functions and objects
  // if it's an object, wrap it's
  // properties in the queue function

  if(parentfn) {
    if (typeof parentfn === 'function') {
      Nightmare.prototype[name] = queued(name, parentfn);
    } else {
      if (!~Nightmare.namespaces.indexOf(name)) {
        Nightmare.namespaces.push(name);
      }
      Nightmare.prototype[name] = function() {
        var self = this;
        return keys(parentfn).reduce(function (obj, key) {
          obj[key] = queued(name, parentfn[key]).bind(self)
        return obj;
        }, {});
      }
    }
  }

  if(childfn) {
    if (typeof childfn === 'function') {
     Nightmare.childActions[name] = childfn;
    } else {
      for(var key in childfn){
        Nightmare.childActions[name+'.'+key] = childfn;
      }
    }
  }
}

/**
 * Attach all the actions.
 */

Object.keys(actions).forEach(function (name) {
  var fn = actions[name];
  Nightmare.action(name, fn);
});
