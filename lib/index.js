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
 * PhantomJS singleton state is really annoying.
 */

var PHANTOMJS_INITING = false;
var PHANTOMJS_INSTANCE = null;

/**
 * Default options.
 */

var DEFAULTS = {
  timeout: 5000,
  interval: 50,
  port: 12301
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
    function next() {
      var item = self.queue.shift();
      if (!item) {
        self.teardownInstance();
        return (callback || noop)(null, self);
      }
      var method = item[0];
      var args = item[1];
      args.push(once(next));
      method.apply(self, args);
    };
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
 * Set up a fresh phantomjs instance.
 *
 * @param {Function} done
 * @api private
 */

Nightmare.prototype.setupInstance = function(done) {
  var port = this.options.port;
  debug('.setup() creating phantom instance on port %s', port);
  if (PHANTOMJS_INITING) {
    var check = setInterval(function() {
      if (PHANTOMJS_INSTANCE) {
        clearInterval(check);
        done(PHANTOMJS_INSTANCE);
      }
    }, 50);
  }
  else {
    PHANTOMJS_INITING = true;
    phantom.create({ port: port }, function(instance) {
      PHANTOMJS_INSTANCE = instance;
      done(instance);
    });
  }
};

/**
 * Tear down a phantomjs instance.
 *
 * @api private
 */

Nightmare.prototype.teardownInstance = function() {
  PHANTOMJS_INITING = false;
  PHANTOMJS_INSTANCE.exit(0);
  // no callback available, leaving two options to avoid EADDRINUSE
  // errors from a fast-follower .run() call:
  //   1. Set a timeout here for a callback
  //   2. Increment the default port so that we don't conflict
  // We go with (2) here because the timeout seems hit or miss in testing.
  this.options.port++;
  DEFAULTS.port++;
  debug('.teardownInstance() tearing down and bumping port to %s', this.options.port);
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
