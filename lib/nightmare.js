'use strict';

const path = require('path');
const util = require('util');
const EventEmitter = require('events');
const debug = require('debug')('nightmare');
const sliced = require('sliced');
const once = require('once');

const Chrome = require('./chrome');
const actions = require('./actions');
const {execute, inject} = require('./javascript');

const {version} = require(path.resolve(__dirname, '..', 'package.json'));
const noop = () => {};

// Standard timeout for loading URLs
const DEFAULT_GOTO_TIMEOUT = 30 * 1000;

// Standard timeout for wait(ms)
const DEFAULT_WAIT_TIMEOUT = 30 * 1000;

// Timeout between keystrokes for `.type()`
const DEFAULT_TYPE_INTERVAL = 100;

// timeout between `wait` polls
const DEFAULT_POLL_INTERVAL = 250;

// max execution time for `.evaluate()`
const DEFAULT_EXECUTION_TIMEOUT = 30 * 1000;

const DEFAULT_HALT_MESSAGE = 'Nightmare Halted';

function Nightmare(options) {
  util.inherits(Nightmare, EventEmitter);

  if (!(this instanceof Nightmare)) {
    return new Nightmare(options);
  }

  options = options || {};
  this.url = null;
  this._queue = [];
  this._headers = {};
  this.options = options;
  this.running = false;
  this.ending = false;
  this.ended = false;
  attachToProcess(this);

  const chrome = new Chrome({show: options.show});
  this.chrome = chrome;

  options.Promise = options.Promise || Nightmare.Promise || Promise;

  options.waitTimeout = options.waitTimeout || DEFAULT_WAIT_TIMEOUT;
  options.gotoTimeout = options.gotoTimeout || DEFAULT_GOTO_TIMEOUT;
  options.polilInterval = options.pollInterval || DEFAULT_POLL_INTERVAL;
  options.typeInterval = options.typeInterval || DEFAULT_TYPE_INTERVAL;
  options.executionTimeout = options.executionTimeout || DEFAULT_EXECUTION_TIMEOUT;

  Object.keys(actions).forEach(name => {
    const fn = actions[name];
    Nightmare.action(name, fn);
  });

  debug('queuing process start');

  this.queue(done => {
    this.proc = chrome.proc;

    this.proc.on('close', code => {
      debug('chrome closed');

      if (!this.ended) {
        handleExit(code, this, noop);
      }
    });

    chrome.init()
      .then(() => {
        const {major, minor} = this.chrome.client.protocol.version;
        this.engineVersions = {protocol: `${major}.${minor}`};

        chrome.Runtime.consoleAPICalled(data => {
          this.emit('console',
            data.type,
            data.args.map(e => e.value).join(' ')
          );
        });

        done();
      })
      .catch(err => {
        this.chrome.debug(err);
        endInstance(this, noop);
      });
  });

  // initialize namespaces
  Nightmare.namespaces.forEach(function (name) {
    if (typeof this[name] === 'function') {
      this[name] = this[name]();
    }
  }, this);

  // prepend adding child actions to the queue
  Object.keys(Nightmare.childActions).forEach(function (key) {
    debug('queueing child action addition for "%s"', key);
    this.queue(function (done) {
      this.child.call('action', key, String(Nightmare.childActions[key]), done);
    });
  }, this);
}

Nightmare.namespaces = [];
Nightmare.childActions = {};
Nightmare.version = version;
Nightmare.Promise = Promise;

function queued(name, fn) {
  return function () {
    debug('queueing action "' + name + '"');
    const args = [].slice.call(arguments);
    this._queue.push([fn, args]);
    return this;
  };
}

Nightmare.prototype.use = function (fn) {
  fn(this);
  return this;
};

Nightmare.prototype.queue = function () {
  if (!arguments.length) {
    return this._queue;
  }

  const args = sliced(arguments);
  const fn = args.pop();
  this._queue.push([fn, args]);
};

Nightmare.prototype.run = function (fn) {
  debug('running');

  const steps = this.queue();
  this.running = true;
  this._queue = [];

  const self = this;

  next();

  // next function
  function next(err) {
    const item = steps.shift();

    // Immediately halt execution if an error has been thrown,
    // or we have no more queued up steps.
    if (err || !item) {
      return done.apply(self, arguments);
    }

    const args = item[1] || [];
    const method = item[0];
    args.push(once(after));
    method.apply(self, args);
  }

  function after() {
    const args = sliced(arguments);
    next.apply(self, args);
  }

  function done() {
    debug('done');

    const doneargs = arguments;
    self.running = false;

    if (self.ending) {
      return endInstance(self, () => fn.apply(self, doneargs));
    }

    return fn.apply(self, doneargs);
  }

  return this;
};

Nightmare.prototype.header = function (header, value) {
  if (header && typeof value !== 'undefined') {
    this._headers[header] = value;
  } else {
    this._headers = header || {};
  }

  return this;
};

Nightmare.prototype._inject = function (js, done) {
  debug('inject js');

  const source = inject({src: js});

  this.chrome.debug({expression: source});

  this.chrome.Runtime.evaluate({expression: source})
    .then(response => {
      this.chrome.debug({evaluation_response: response});

      if (
        response.result &&
        response.result.subtype === 'error' &&
        response.exceptionDetails
      ) {
        const {
          exception: {description}
        } = response.exceptionDetails;
        done(description);
      } else {
        if (response.result.type === 'object') {
          return this.chrome.Runtime.getProperties({
            objectId: response.result.objectId,
            ownProperties: true
          })
          .then(objectDetails => {
            const output = {};

            for (const entry of objectDetails.result) {
              if (entry.name !== '__proto__') {
                output[entry.name] = entry.value.value;
              }
            }

            this.chrome.debug({output});
            done(null, output);
          })
          .catch(err => {
            this.chrome.debug({err});
            done(err);
          });
        }

        done(null, response.result.value);
      }
    })
    .catch(done);

  return this;
};

Nightmare.prototype._injectCSS = function (css, done) {
  this._inject(`
    var style = document.createElement('style');
    style.type = 'text/css';
    style.innerHTML = \`\n${css}\n\`;
    document.head.append(style);
  `, done);

  return this;
};

Nightmare.prototype.evaluate_now = function (js_fn, done) {
  debug('evaluate_now');

  const args = Array.prototype.slice.call(arguments).slice(2).map(a => {
    return {argument: JSON.stringify(a)};
  });

  const source = execute({
    src: String(js_fn),
    args
  });

  this.chrome.debug({expression: source});

  this.chrome.Runtime.evaluate({expression: source})
    .then(response => {
      this.chrome.debug({evaluation_response: response});

      if (
        response.result &&
        response.result.subtype === 'error' &&
        response.exceptionDetails
      ) {
        const {
          exception: {description}
        } = response.exceptionDetails;
        done(description);
      } else {
        if (response.result.type === 'object') {
          return this.chrome.Runtime.getProperties({
            objectId: response.result.objectId,
            ownProperties: true
          })
          .then(objectDetails => {
            const output = {};

            for (const entry of objectDetails.result) {
              if (entry.name !== '__proto__') {
                output[entry.name] = entry.value.value;
              }
            }

            this.chrome.debug({output});
            done(null, output);
          })
          .catch(err => {
            this.chrome.debug({err});
            done(err);
          });
        }

        done(null, response.result.value);
      }
    })
    .catch(done);

  return this;
};

Nightmare.action = function () {
  const name = arguments[0];
  let childfn;
  let parentfn;

  if (arguments.length === 2) {
    parentfn = arguments[1];
  } else {
    parentfn = arguments[2];
    childfn = arguments[1];
  }

  // support functions and objects
  // if it's an object, wrap it's
  // properties in the queue function

  if (parentfn) {
    if (typeof parentfn === 'function') {
      Nightmare.prototype[name] = queued(name, parentfn);
    } else {
      if (!~Nightmare.namespaces.indexOf(name)) {
        Nightmare.namespaces.push(name);
      }

      Nightmare.prototype[name] = function () {
        const self = this;
        return Object.keys(parentfn).reduce(function (obj, key) {
          obj[key] = queued(name, parentfn[key]).bind(self);
          return obj;
        }, {});
      };
    }
  }

  if (childfn) {
    if (typeof childfn === 'function') {
      Nightmare.childActions[name] = childfn;
    } else {
      for (const key in childfn) {
        Nightmare.childActions[name + '.' + key] = childfn;
      }
    }
  }
};

Nightmare.prototype.goto = function (url, headers) {
  headers = headers || {};
  this.currentUrl = url;

  debug('queueing action "goto" for %s', url);

  for (const key in this._headers) {
    headers[key] = headers[key] || this._headers[key];
  }

  this.queue(done => {
    if (!url || typeof url !== 'string') {
      return done('goto: `url` must be a non-empty string');
    }

    let response = {};
    let output = {};
    let error;
    let domLoaded = false;

    setTimeout(() => {
      debug('goto timeout');

      delete this.chrome.client._events['Page.domContentEventFired'];
      delete this.chrome.client._events['Page.loadEventFired'];

      // If the DOM loaded before timing out, consider the load successful.
      if (domLoaded) {
        output.details = `Not all resources loaded after ${this.options.gotoTimeout} ms`;
        done(undefined, output);
      } else {
        done({
          message: 'navigation error',
          code: -7, // chromium's generic networking timeout code
          details: `Navigation timed out after ${this.options.gotoTimeout} ms`,
          url
        });
      }
    }, this.options.gotoTimeout);

    this.chrome.Page.domContentEventFired(() => {
      this.chrome.debug('Page.domContentEventFired');
      domLoaded = true;
    });

    this.chrome.Page.loadEventFired(() => {
      this.emit('did-finish-load');
      this.chrome.debug('Page.loadEventFired');

      if (error) {
        done(error);
      } else {
        output = {
          url: response.url,
          code: response.status,
          method: 'GET',
          referrer: '',
          headers: response.headers
        };

        done(undefined, output);
      }
    });

    this.chrome.Page.javascriptDialogOpening(data => {
      this.chrome.debug('Page.javascriptDialogOpening', data);
      this.emit('page', data.type, data.message);
    });

    this.chrome.Page.javascriptDialogClosed(data => {
      this.chrome.debug('Page.javascriptDialogClosed', data);
    });

    this.chrome.Network.loadingFailed(res => {
      const {canceled, type, errorText} = res;
      this.emit('did-fail-load');
      this.chrome.debug('Network.loadingFailed', res);

      if (canceled === false && type === 'Document') {
        error = {
          message: 'navigation error',
          details: errorText,
          url
        };
      }
    });

    this.chrome.Network.responseReceived(res => {
      this.chrome.debug('Network.responseReceived', res);
      response = res.response;
      delete this.chrome.client._events['Network.responseReceived'];
    });

    this.chrome.Network.setExtraHTTPHeaders({headers});
    this.chrome.Page.navigate({url}).catch(done);
  });

  return this;
};

Nightmare.prototype.then = function (fulfill, reject) {
  return new this.options.Promise((success, failure) => {
    this._rejectActivePromise = failure;

    this.run((err, result) => {
      if (err) {
        failure(err);
      } else {
        success(result);
      }
    });
  })
  .then(fulfill, reject);
};

Nightmare.prototype.catch = function (reject) {
  this._rejectActivePromise = reject;
  return this.then(undefined, reject);
};

Nightmare.prototype.end = function (done) {
  this.ending = true;

  if (done && !this.running && !this.ended) {
    return this.then(done);
  }

  return this;
};

Nightmare.prototype.halt = function (error, done) {
  debug('halt');

  this.ending = true;
  const queue = this.queue(); // empty the queue
  queue.splice(0);

  if (!this.ended) {
    let message = error;

    if (error instanceof Error) {
      message = error.message;
    }

    this.die = message || DEFAULT_HALT_MESSAGE;

    if (typeof this._rejectActivePromise === 'function') {
      this._rejectActivePromise(error || DEFAULT_HALT_MESSAGE);
    }

    let callback = done;

    if (!callback || typeof callback !== 'function') {
      callback = noop;
    }

    endInstance(this, callback, true);
  }

  return this;
};

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

function handleExit(code, instance, cb) {
  // change these messages
  const help = {
    127: 'command not found - you may not have electron installed correctly',
    126: 'permission problem or command is not an executable - you may not have all the necessary dependencies for electron',
    1: 'general error - you may need xvfb',
    0: 'success!'
  };

  debug('chrome child process exited with code ' + code + ': ' + help[code]);
  // instance.proc.removeAllListeners();
  cb();
}

function endInstance(instance, cb, forceKill) {
  instance.ended = true;
  detachFromProcess(instance);

  if (forceKill) {
    instance.proc.kill('SIGINT');
  }

  if (instance.proc && instance.proc.connected) {
    instance.proc.on('close', code => {
      handleExit(code, instance, cb);
    });

    instance.proc.kill('SIGINT');
  } else {
    debug('chrome child process not started yet, skipping kill.');
    cb();
  }
}

module.exports = Nightmare;
