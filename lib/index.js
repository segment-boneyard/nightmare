var phantom = require('phantom');
var debug = require('debug')('nightmare');
var defaults = require('defaults');
var clone = require('clone');
var actions = require('./actions');

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
  this.options = defaults(clone(options) || {}, DEFAULTS);
  this.queue = [];
  this.setup();
  return this;
}

/**
 * Run all the queued methods.
 *
 * @param {Function} callback
 */

Nightmare.prototype.run = function(callback) {
  debug('.run()');
  var self = this;
  var recurse = function(err) {
    if (err || self.queue.length === 0) return callback(err, self);
    debug('.run() recursing with queue length ' + self.queue.length);
    var next = self.queue.shift();
    self.runNext(next, recurse);
  };
  recurse();
};

/**
 * Run next queued method.
 *
 * @param {Function} next
 * @param {Function} done
 */

Nightmare.prototype.runNext = function(next, done) {
  var method = next[0];
  var args = next[1] || [];
  var called = false;
  var cb = function(result) {
    // all the callbacks from phantom are missing err
    // sometimes we get duped callbacks so prevent that, blargh
    if (!called) {
      called = true;
      done(null, result);
    }
  };
  args.push(cb);
  method.apply(this, args);
};

/**
 * Set up a fresh phantomjs instance.
 *
 * @param {Function} done
 * @api private
 */

Nightmare.prototype.setupInstance = function(done) {
  var self = this;
  debug('.setup() creating phantom instance');
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
    phantom.create({port: self.options.port}, function(instance) {
      PHANTOMJS_INSTANCE = instance;
      done(instance);
    });
  }
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
  var self = this;
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
  var self = this;
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
