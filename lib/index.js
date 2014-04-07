var series = require('async-series');
var phantom = require('node-phantom');
var debug = require('debug')('nightmare');
var defaults = require('defaults');
var clone = require('clone');

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
 * Initialize a new `Nightmare`.
 *
 * @param {Object} options
 */

function Nightmare (options) {
  this.options = defaults(clone(options) || {}, {
    timeout: 5000,
    interval: 50
  });
  this._queue = [];
  this._executing = false;
  this.setup();
  return this;
}

/**
 * Generate a public API method that just queues and nudges the queue.
 *
 * @param {String} name
 */

function createMethod(name) {
  Nightmare.prototype[name] = function () {
    var args = [];
    for (var i = 0; i < arguments.length; i++) {
      args.push(arguments[i]);
    }
    this._queue.push([
      this['_'+name],
      args
    ]);
    this.execute();
    return this;
  };
}

createMethod('goto');
createMethod('click');
createMethod('type');
createMethod('upload');
createMethod('wait');
createMethod('done');
createMethod('setup');
createMethod('screen');
createMethod('run');
createMethod('viewport');

/**
 * Set the error handler.
 *
 * @param {Function} handler
 *
 * @returns {Nightmare}
 */

Nightmare.prototype.error = function(handler) {
  this._onError = handler;
  return this;
};

/**
 * Execute the queue.
 *
 * @returns {Nightmare}
 */

Nightmare.prototype.execute = function() {
  if (!this._executing && this._queue.length > 0) {
    this._executing = true;
    var self = this;
    var funcs = this._queue.map(function (item) {
      var method = item[0];
      var args = item[1];
      return function (done) {
        args.push(done);
        method.apply(self, args);
      };
    });
    this._queue = [];
    series(funcs, function (err) {
      if (err) return self._error(err);
      self._executing = false;
      if (self._queue.length > 0) self.execute();
    });
  }
};

/**
 * Go to a new url.
 *
 * @param {String} url
 * @api private
 */

Nightmare.prototype._goto = function(url, cb) {
  var page = this.page;
  debug('.goto() url: ' + url);
  page.open(url, function (err, status) {
    if (err) return cb(err);
    debug('.goto() page loaded: ' + status);
    setTimeout(cb, 500);
  });
};

/**
 * Click an element.
 *
 * @param {String} selector
 * @api private
 */

Nightmare.prototype._click = function(selector, cb) {
  debug('.click() on ' + selector);
  this.page.evaluate(function(selector) {
    var element = document.querySelector(selector);
    var event = document.createEvent('MouseEvent');
    event.initEvent('click', true, false);
    element.dispatchEvent(event);
  }, cb, selector);
};

/**
 * Type into an element.
 *
 * @param {String} selector
 * @param {String} text
 * @api private
 */

Nightmare.prototype._type = function(selector, text, cb) {
  debug('.type() into ' + selector);
  this.page.evaluate(function(selector, text) {
    var element = document.querySelector(selector);
    element.value = text;
  }, cb, selector, text);
};

/**
 * Upload a path into a file input.
 *
 * @param {String} selector
 * @param {String} path
 * @api private
 */

Nightmare.prototype._upload = function(selector, path, cb) {
  debug('.upload() to ' + selector + ' with ' + path);
  var page = this.page;
  page.uploadFile(selector, path, cb);
};

/**
 * Wait for various states.
 *
 * @param {Number|String|Object} options Optional
 * @api private
 */

Nightmare.prototype._wait = function(options, cb) {
  if (!cb) {
    cb = options;
    options = null;
  }
  var page = this.page;
  if (typeof options === 'number') {
    var ms = options;
    debug('.wait() for ' + ms + 'ms');
    setTimeout(cb, ms);
  }
  else if (typeof options === 'string') {
    var selector = options;
    debug('.wait() for the element ' + selector);
    var elementPresent = function (selector) {
      var element = document.querySelector(selector);
      return (element ? true : false);
    };
    this.untilOnPage(elementPresent, cb, selector);
  }
  else {
    debug('.wait() for the next page load');
    this.afterNextPageLoad(cb);
  }
};

/**
 * Set a done callback.
 *
 * @param {Function} callback
 * @api private
 */

Nightmare.prototype._done = function(callback, cb) {
  callback(this);
  cb();
};

/**
 * Take a screenshot.
 *
 * @param {String} path
 * @api private
 */

Nightmare.prototype._screen = function(path, cb) {
  debug('.screen() saved to ' + path);
  this.page.render(path, cb);
};

/**
 * Run the function on the page.
 *
 * @param {Function} fn
 * @param {Function} cb
 * @api private
 */

Nightmare.prototype._run = function(fn, cb/**, arg1, arg2...*/) {
  debug('.run() fn on the page');
  this.page.evaluate.apply(this.page, arguments);
};

/**
 * Set up a fresh phantomjs page.
 *
 * @param {Function} cb
 * @api private
 */

Nightmare.prototype._setup = function (cb) {
  var self = this;
  this.setupInstance(function (err, instance) {
    if (err) return cb(err);
    debug('.setup() phantom instance created');
    instance.createPage(function(err, page) {
      if (err) return cb(err);
      self.page = page;
      debug('.setup() phantom page created');
      cb();
    });
  });
};

/**
 * Change the viewport size of the page.
 *
 * @param {String} width
 * @param {String} height
 * @param {Function} cb
 * @api private
 */

Nightmare.prototype._viewport = function (width, height, cb) {
  var size = { width: width, height: height };

  this.page.setViewport(size, function (err) {
    if (err) return cb(err);
    debug('.viewport() set to %sx%s', width, height);
    cb();
  });
}

/**
 * Set up a fresh phantomjs instance.
 *
 * @param {Function} callback
 * @api private
 */

Nightmare.prototype.setupInstance = function(cb) {
  var self = this;
  debug('.setup() creating phantom instance');
  if (PHANTOMJS_INITING) {
    var check = setInterval(function () {
      if (PHANTOMJS_INSTANCE) {
        clearInterval(check);
        cb(null, PHANTOMJS_INSTANCE);
      }
    }, 50);
  }
  else {
    PHANTOMJS_INITING = true;
    phantom.create(function(err, instance) {
      if (err) return cb(err);
      PHANTOMJS_INSTANCE = instance;
      cb(null, instance);
    });
  }
};

/**
 *
 */

/**
 * The internal error handler
 *
 * @param {String} err
 * @api private
 */

Nightmare.prototype._error = function(err) {
  debug(err);
  if (this._onError) this._onError(err);
};

/**
 * Check function on page until it becomes true.
 *
 * @param {Function} check
 * @param {Function} then
 */

Nightmare.prototype.untilOnPage = function(check, then) {
  var page = this.page;
  var self = this;
  var condition = false;
  var hasCondition = function () {
    page.evaluate(check, function (err, res) {
      if (err) return self._error(err);
      condition = res;
    });
    return condition;
  };
  until(hasCondition, this.options.timeout, this.options.interval, then);
};

/**
 * Trigger the callback after the next page load.
 *
 * @param {Function} callback
 */

Nightmare.prototype.afterNextPageLoad = function (cb) {
  var isUnloaded = function () {
    return (document.readyState !== "complete");
  };
  var isLoaded = function () {
    return (document.readyState === "complete" ? window.location.href : false);
  };
  var self = this;
  self.untilOnPage(isUnloaded, function () {
    debug('.wait() detected page unload');
    self.untilOnPage(isLoaded, function (res) {
      debug('.wait() detected page load: ' + res);
      cb();
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
  var checker = setInterval(function () {
    var diff = Date.now() - start;
    var res = check();
    if (res || diff > timeout) {
      clearInterval(checker);
      then(res);
    }
  }, interval);
}
