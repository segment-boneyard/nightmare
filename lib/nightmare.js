'use strict';

const path = require('path');
const util = require('util');
const urlParser = require('url').parse;
const EventEmitter = require('events').EventEmitter;
const debug = require('debug')('nightmare');
const sliced = require('sliced');
const once = require('once');

const Chrome = require('./chrome');
const actions = require('./actions');
const execute = require('./javascript').execute;
const inject = require('./javascript').inject;

const version = require(path.resolve(__dirname, '..', 'package.json')).version;
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

const KNOWN_PROTOCOLS = [
  'http:',
  'https:',
  'file:',
  'about:',
  'javascript:',
  'chrome:'
];

function Nightmare(options) {
  if (!(this instanceof Nightmare)) {
    return new Nightmare(options);
  }

  EventEmitter.call(this);

  options = options || {};
  this._queue = [];
  this._headers = {};
  this.running = false;
  this.ending = false;
  this.ended = false;
  this.closingInterface = false;

  const chrome = new Chrome({
    host: options.host,
    port: options.port,
    secure: options.secure,
    target: options.target,
    protocol: options.protocol,
    remote: options.remote
  });

  this.chrome = chrome;

  options.Promise = options.Promise || Nightmare.Promise || Promise;

  options.waitTimeout = options.waitTimeout || DEFAULT_WAIT_TIMEOUT;
  options.gotoTimeout = options.gotoTimeout || DEFAULT_GOTO_TIMEOUT;
  options.polilInterval = options.pollInterval || DEFAULT_POLL_INTERVAL;
  options.typeInterval = options.typeInterval || DEFAULT_TYPE_INTERVAL;
  options.executionTimeout = options.executionTimeout || DEFAULT_EXECUTION_TIMEOUT;

  this.options = options;

  Object.keys(actions).forEach(name => {
    const fn = actions[name];
    Nightmare.action(name, fn);
  });

  debug('queuing process start');

  this.queue(done => {
    chrome.init()
      .then(() => {
        this.closingInterface = false;
        const major = this.chrome.client.protocol.version.major;
        const minor = this.chrome.client.protocol.version.minor;
        this.engineVersions = {protocol: `${major}.${minor}`};

        if (options.width && options.height) {
          this.chrome.Emulation.setVisibleSize({
            width: options.width,
            height: options.height
          });
        }

        chrome.Runtime.consoleAPICalled(data => {
          this.chrome.debug('console', data);

          this.emit('console',
            data.type,
            data.args.map(e => e.value).join(' ')
          );
        });

        chrome.Runtime.exceptionThrown(data => {
          this.emit('page', 'error',
            data.exceptionDetails.exception.description);
        });

        chrome.Network.requestIntercepted(request => {
          debug('Network.requestIntercepted', request);
        });

        done();
      })
      .catch(err => {
        debug(err);
        endInstance(this, noop);
      });
  });

  // initialize namespaces
  Nightmare.namespaces.forEach(function (name) {
    if (typeof this[name] === 'function') {
      this[name] = this[name]();
    }
  }, this);
}

util.inherits(Nightmare, EventEmitter);

Nightmare.namespaces = [];
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

    fn.apply(self, doneargs);
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

Nightmare.prototype.evaluateJs = function (response, done) {
  if (
    response.result &&
    response.result.subtype === 'error' &&
    response.exceptionDetails
  ) {
    done(response.exceptionDetails.exception.description);
  } else {
    if (response.result.subtype === 'promise') {
      return this.chrome.Runtime.awaitPromise({
        promiseObjectId: response.result.objectId
      })
      .then(res => {
        debug('promise result:', res.result);

        if (
          res.result &&
          res.result.subtype === 'error' &&
          res.exceptionDetails
        ) {
          return done(res.exceptionDetails.exception.description);
        }

        if (res.result.type === 'object') {
          return this.chrome.Runtime.getProperties({
            objectId: res.result.objectId,
            ownProperties: true
          })
          .then(objectDetails => {
            const output = {};

            for (const entry of objectDetails.result) {
              if (entry.name !== '__proto__') {
                output[entry.name] = entry.value.value;
              }
            }

            debug({output});
            done(null, output);
          })
          .catch(err => {
            debug({err});
            done(err);
          });
        }

        debug('value', res.result.value);
        done(null, res.result.value);
      });
    } else if (response.result.type === 'object') {
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

        debug({output});
        done(null, output);
      })
      .catch(err => {
        debug({err});
        done(err);
      });
    }

    debug('value', response.result.value);
    done(null, response.result.value);
  }
};

Nightmare.prototype._inject = function (js, done) {
  debug('inject js');

  const source = inject({src: js});

  debug({expression: source});

  this.chrome.Runtime.evaluate({expression: source})
    .then(response => {
      debug({evaluation_response: response});
      this.evaluateJs(response, done);
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

  debug({expression: source});

  this.chrome.Runtime.evaluate({expression: source})
    .then(response => {
      debug({evaluation_response: response});
      this.evaluateJs(response, done);
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

    const protocol = urlParser(url).protocol;

    if (!protocol || KNOWN_PROTOCOLS.indexOf(protocol) < 0) {
      return done(new Error('Protocol not supported.'));
    }

    debug('going to %s, times out in %d', url, this.options.gotoTimeout);

    let response = {};
    let domLoaded = false;
    let loaded = false;

    this.gotoTimer = setTimeout(() => {
      debug('goto timeout');

      delete this.chrome.client._events['Page.domContentEventFired'];
      delete this.chrome.client._events['Page.loadEventFired'];

      // If the DOM loaded before timing out, consider the load successful.
      if (domLoaded) {
        done(undefined, {
          details: `Not all resources loaded after ${this.options.gotoTimeout} ms`
        });
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
      debug('Page.domContentEventFired', url);
      domLoaded = true;

      if (loaded) {
        done(undefined, {
          url: response.url,
          code: response.status,
          method: 'GET',
          referrer: '',
          headers: response.headers
        });
      }
    });

    this.chrome.Page.loadEventFired(() => {
      this.emit('did-finish-load');
      debug('Page.loadEventFired', url);
      loaded = true;

      if (domLoaded) {
        done(undefined, {
          url: response.url,
          code: response.status,
          method: 'GET',
          referrer: '',
          headers: response.headers
        });
      }
    });

    this.chrome.Page.javascriptDialogOpening(data => {
      debug('Page.javascriptDialogOpening', data);
      this.emit('page', data.type, data.message);
    });

    this.chrome.Page.javascriptDialogClosed(data => {
      debug('Page.javascriptDialogClosed', data);
    });

    this.chrome.Network.loadingFailed(res => {
      this.emit('did-fail-load');
      debug('Network.loadingFailed', res);

      if (res.type === 'Document') {
        if (this.gotoTimer) {
          clearTimeout(this.gotoTimer);
        }

        done({
          message: 'navigation error',
          details: res.errorText,
          url
        });
      }
    });

    this.chrome.Network.responseReceived(res => {
      response = res.response;
      this.chrome.debug('Network.responseReceived', res);
    });

    this.chrome.Network.setExtraHTTPHeaders({headers});

    this.chrome.Page.navigate({url})
      .then(() => this.chrome.debug('Page.navigate', url))
      .catch(done);
  });

  return this;
};

Nightmare.prototype.then = function (fulfill, reject) {
  return new this.options.Promise((success, failure) => {
    this._rejectActivePromise = failure;

    this.run((err, result) => {
      debug('closingInterface', this.closingInterface);

      if (err) {
        if (this.closingInterface) {
          failure(err);
        } else {
          debug('closing chrome interface');
          this.closingInterface = true;
          this.chrome.client.close().then(() => failure(err));
        }
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

function endInstance(instance, cb) {
  debug('endInstance');
  instance.ended = true;

  if (instance.chrome.client && !instance.closingInterface) {
    debug('endInstance: closing chrome interface');
    instance.closingInterface = true;

    if (instance.gotoTimer) {
      clearTimeout(instance.gotoTimer);
    }

    instance.chrome.client.close()
      .then(() => {
        debug('chrome client closed');
        cb();
      });
  } else {
    cb();
  }
}

module.exports = Nightmare;
