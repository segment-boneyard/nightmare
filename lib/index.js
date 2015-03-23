var phantom = require('phantom');
var debug = require('debug')('nightmare');
var defaults = require('defaults');
var clone = require('clone');
var once = require('once');
var actions = require('./actions');
var noop = function () {};

/**
 * Expose `Nightmare`.
 */

module.exports = Nightmare;

/**
 * Global PORT to avoid EADDRINUSE
 */

var PORT = 13200;

/**
 * Default options.
 *
 * http://phantomjs.org/api/command-line.html
 */

var DEFAULTS = {
  timeout: 5000,
  interval: 50,
  weak: true,
  loadImages: true,
  ignoreSslErrors: true,
  sslProtocol: 'any',
  proxy: null,
  proxyType: null,
  proxyAuth: null,
  cookiesFile: null,
  webSecurity: true
};

/**
 * Initialize a new `Nightmare`.
 *
 * @param {Object} options
 */

function Nightmare (options) {
  if (!(this instanceof Nightmare)) return new Nightmare(options);
  this.options = defaults(clone(options) || {}, DEFAULTS);
  this.queue = [];
}

/**
 * Run all the queued methods.
 *
 * @param {Function} callback
 */

Nightmare.prototype.run = function(callback) {
  var self = this;
  debug('run');
  this.setup(function () {
    setTimeout(next, 0);
    function next(err) {
      var item = self.queue.shift();
      if (!item) {
        self.teardownInstance();
        return (callback || noop)(err, self);
      }
      var method = item[0];
      var args = item[1];
      args.push(once(next));
      method.apply(self, args);
    }
  });
};

/**
 * Set up a fresh phantomjs page.
 *
 * @param {Function} done
 * @api private
 */

Nightmare.prototype.setup = function(done) {
  var self = this;
  this.setupInstance(function(instance) {
    debug('.setup() phantom instance created');
    instance.createPage(function(page) {
      self.page = page;
      debug('.setup() phantom page created');
      done();
    });
  });
};

/**
 * Safely set up a fresh phantomjs instance.
 *
 * @param {Function} done
 * @api private
 */

Nightmare.prototype.setupInstance = function(done) {
  debug('.setup() creating phantom instance with options %s', JSON.stringify(this.options));
  if (this.initializingPhantomJS) {
    var self = this;
    var check = setInterval(function() {
      if (self.phantomJS) {
        clearInterval(check);
        done(self.phantomJS);
      }
    }, 50);
  }
  else {
    this.initializingPhantomJS = true;
    this.createInstance(done);
  }
};

/**
 * Create a phantomjs instance.
 *
 * @param {Function} done
 * @api private
 */

Nightmare.prototype.createInstance = function(done) {
  var flags = [];
  flags.push('--load-images='+this.options.loadImages);
  flags.push('--ignore-ssl-errors='+this.options.ignoreSslErrors);
  flags.push('--ssl-protocol='+this.options.sslProtocol);
  flags.push('--web-security='+this.options.webSecurity);
  if (this.options.proxy !== null) {
    flags.push('--proxy='+this.options.proxy);
  }
  if (this.options.proxyType !== null) {
    flags.push('--proxy-type='+this.options.proxyType);
  }
  if (this.options.proxyAuth !== null) {
    flags.push('--proxy-auth='+this.options.proxyAuth);
  }
  if (this.options.cookiesFile !== null) {
    flags.push('--cookies-file='+this.options.cookiesFile);
  }

  // dnode options for compilation on windows
  var dnodeOpts = {};
  if (this.options.weak === false) {
     dnodeOpts = { weak : false };
  }

  // combine flags, options and callback into args
  var args = flags;
  args.push({
    port: this.options.port || getPort(),
    dnodeOpts: dnodeOpts,
    path: this.options.phantomPath,
    onExit: this.handleCrash.bind(this)
  });
  var self = this;
  args.push(function(instance) {
    self.phantomJS = instance;
    done(instance);
  });
  phantom.create.apply(phantom, args);

  // clear the timeout handler
  this.onTimeout = noop;
};

/**
 * Tear down a phantomjs instance.
 *
 * @api private
 */

Nightmare.prototype.teardownInstance = function() {
  this.initializingPhantomJS = false;
  this.phantomJS.exit(0);
  debug('.teardownInstance() tearing down');

};

/**
 * Check function on page until it becomes true.
 *
 * @param {Function} check
 * @param {Object} value
 * @param {Function} then
 * @api private
 */

Nightmare.prototype.untilOnPage = function(check, value, then) {
  var page = this.page;
  var condition = false;
  var args = [].slice.call(arguments).slice(3);
  var hasCondition = function() {
    args.unshift(function(res) {
      condition = res;
    });
    args.unshift(check);
    page.evaluate.apply(page, args);
    return condition === value;
  };
  until(hasCondition, this.options.timeout, this.options.interval, then);
};

/**
 * Check function on page until it becomes true.
 *
 * @param {Function} check
 * @param {Object} value
 * @param {Number} delay
 * @param {Function} then
 * @api private
 */

Nightmare.prototype.refreshUntilOnPage = function(check, value, delay, then) {
  var page = this.page;
  debug('.wait() checking for condition after refreshing every ' + delay);
  var interval = setInterval(function() {
    page.evaluate(check, function(result) {
      if (result === value) {
        debug('.wait() saw value match after refresh');
        clearInterval(interval);
        then();
      }
      else {
        debug('.wait() refreshing the page (no match on value=' + result + ')');
        page.evaluate(function() {
          document.location.reload(true);
        });
      }
    });
  }, delay);
};

/**
 * Trigger the callback after the next page load.
 *
 * @param {Function} callback
 * @api private
 */

Nightmare.prototype.afterNextPageLoad = function(callback) {
  var isUnloaded = function() {
    return (document.readyState !== "complete");
  };
  var isLoaded = function() {
    return (document.readyState === "complete");
  };
  var self = this;
  self.untilOnPage(isUnloaded, true, function() {
    debug('.wait() detected page unload');
    self.untilOnPage(isLoaded, true, function(res) {
      debug('.wait() detected page load');
      callback();
    });
  });
};

/**
 * Handles the phantom process ending/crashing unexpectedly.
 *
 * If an `onExit` handler has been bound (via `Nightmare#on('exit', ...)`)
 * then that will be called. Otherwise, the error will be re-thrown.
 *
 * @param {Number} code
 * @param {String} [signal]
 */

Nightmare.prototype.handleCrash = function (code, signal) {
  // if a handler is defined, call it
  if (this.onExit) {
    this.onExit(code, signal);

  // otherwise, if we have a non-zero code we'll throw a better error message
  // than the `phantom` lib would.
  } else if (code !== 0) {
    var err = new Error('the phantomjs process ended unexpectedly');
    err.code = code;
    err.signal = signal;
    throw err;
  }
};

/**
 * Check function until it becomes true.
 *
 * @param {Function} check
 * @param {Number} timeout
 * @param {Number} interval
 * @param {Function} then
 */

function until(check, timeout, interval, then) {
  var start = Date.now();
  var checker = setInterval(function() {
    var diff = Date.now() - start;
    var res = check();
    if (res || diff > timeout) {
      clearInterval(checker);
      then(res);
    }
  }, interval);
}

/**
 * Attach all the actions.
 */

Object.keys(actions).forEach(function (name) {
  var fn = actions[name];
  Nightmare.prototype[name] = function() {
    debug('queueing action "' + name + '"');
    var args = [].slice.call(arguments);
    this.queue.push([fn, args]);
    return this;
  };
});

/**
 * Generate new port globally to avoid EADDRINUSE.
 */

function getPort() {
  PORT++;
  return PORT;
}
