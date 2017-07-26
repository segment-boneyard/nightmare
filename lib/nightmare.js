'use strict';

const path = require('path');
const debug = require('debug')('nightmare');
const sliced = require('sliced');
const once = require('once');

const Chrome = require('./chrome');
const actions = require('./actions');
const {execute} = require('./javascript');

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

class Nightmare {
  constructor(options = {}) {
    this.url = null;
    this._queue = [];
    this._headers = {};
    this.options = options;
    this.running = false;
    this.ending = false;
    this.ended = false;

    const chrome = new Chrome({show: options.show});
    this.chrome = chrome;

    Nightmare.namespaces = [];
    Nightmare.childActions = {};
    Nightmare.version = version;

    options.Promise = options.Promise || Nightmare.Promise || Promise;

    options.waitTimeout = options.waitTimeout || DEFAULT_WAIT_TIMEOUT;
    options.gotoTimeout = options.gotoTimeout || DEFAULT_GOTO_TIMEOUT;
    options.pollInterval = options.pollInterval || DEFAULT_POLL_INTERVAL;
    options.typeInterval = options.typeInterval || DEFAULT_TYPE_INTERVAL;
    options.executionTimeout = options.executionTimeout || DEFAULT_EXECUTION_TIMEOUT;

    Object.keys(actions).forEach(name => {
      const fn = actions[name];
      this.action(name, fn);
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

      chrome.init().then(() => done());
    });
  }

  queued(name, fn) {
    const self = this;

    return function () {
      debug('queueing action "' + name + '"');

      const args = [].slice.call(arguments);

      self._queue.push([fn, args]);
      return self;
    };
  }

  queue() {
    if (!arguments.length) {
      return this._queue;
    }

    const args = sliced(arguments);
    const fn = args.pop();
    this._queue.push([fn, args]);
  }

  run(fn) {
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
  }

  header(header, value) {
    if (header && typeof value !== 'undefined') {
      this._headers[header] = value;
    } else {
      this._headers = header || {};
    }

    return this;
  }

  evaluate_now(js_fn, done) {
    debug('evaluate_now');

    const args = Array.prototype.slice.call(arguments).slice(2).map(a => {
      return {argument: JSON.stringify(a)};
    });

    const source = execute({
      src: String(js_fn),
      args
    });

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
          done(new Error(description));
        } else {
          done(null, response.result.value);
        }
      });

    return this;
  }

  action() {
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
        this[name] = this.queued(name, parentfn);
      } else {
        if (!~Nightmare.namespaces.indexOf(name)) {
          Nightmare.namespaces.push(name);
        }

        this[name] = () => {
          return Object.keys(parentfn).reduce((obj, key) => {
            obj[key] = this.queued(name, parentfn[key]).bind(this);
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
  }

  goto(url, headers = {}) {
    debug('queueing action "goto" for %s', url);

    for (const key in this._headers) {
      headers[key] = headers[key] || this._headers[key];
    }

    this.queue(done => {
      this.chrome.Page.domContentEventFired(() => {
        this.chrome.debug('domContentEventFired');
      });

      this.chrome.Page.loadEventFired(() => {
        this.chrome.debug('loadEventFired');
        done();
      });

      this.chrome.Network.setExtraHTTPHeaders({headers});
      this.chrome.Page.navigate({url});
    });

    return this;
  }

  then(fulfill, reject) {
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
  }

  catch(reject) {
    this._rejectActivePromise = reject;
    return this.then(undefined, reject);
  }

  end(done) {
    this.ending = true;

    if (done && !this.running && !this.ended) {
      return this.then(done);
    }

    return this;
  }
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

function endInstance(instance, cb) {
  instance.ended = true;

  if (instance.proc && instance.proc.connected) {
    instance.proc.on('close', code => {
      handleExit(code, instance, cb);
    });

    instance.chrome.client.close();
    instance.proc.kill('SIGINT');
  } else {
    debug('chrome child process not started yet, skipping kill.');
    cb();
  }
}

module.exports = Nightmare;
