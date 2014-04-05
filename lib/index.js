var series = require('async-series');
var phantom = require('node-phantom');
var debug = require('debug')('nightmare');
var defaults = require('defaults');

/**
 * Expose `Nightmare`.
 */

module.exports = Nightmare;

/**
 * Initialize a new `Nightmare`.
 *
 * @param {Object} options
 */

function Nightmare (options) {
  this.options = defaults(clone(options) || {}, {
    timeout: 10000,
    interval: 100
  });
  this._queue = [];
  this._executing = false;
  this.setup();
}

/**
 * Generate a public API method that just queues and nudges the queue.
 *
 * @param {String} name
 */

function createMethod(name) {
  Nightmare.prototype[name] = function () {
    this._queue.push([
      this['_'+name],
      arguments
    ]);
    this.execute();
  };
}

createMethod('goto');
createMethod('click');
createMethod('type');
createMethod('upload');
createMethod('wait');
createMethod('setup');

/**
 * Set the error handler.
 *
 * @param {Function} handler
 *
 * @returns {Nightmare}
 */

Nightmare.prototype.error = function(handler) {
  this._onError = handler;
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
        self[method].apply(self, args);
      };
    });
    series(funcs, function (err) {
      if (err) return self._error(err);
      self._executing = false;
    });
  }
};

/**
 * Go to a new url.
 *
 * @param {String} url
 * @api private
 */

var JQUERY_URL = 'http://ajax.googleapis.com/ajax/libs/jquery/1.7.2/jquery.min.js';

Nightmare.prototype._goto = function(url, cb) {
  var page = this.page;
  debug('Going to url: ' + url);
  page.open(url, function (err, status) {
    debug(err, status);
    if (err) return cb(err);
    page.includeJs(JQUERY_URL, cb);
  });
};

/**
 * Click an element.
 *
 * @param {String} selector
 * @api private
 */

Nightmare.prototype._click = function(selector, cb) {
  var page = this.page;
  page.evaluate(function() {
    $(selector).click();
  }, function (err, res) {
    debug(err, res);
    cb(err);
  });
};

/**
 * Type into an element.
 *
 * @param {String} selector
 * @param {String} text
 * @api private
 */

Nightmare.prototype._type = function(selector, text, cb) {
  var page = this.page;
  page.evaluate(function() {
    $(selector).click();
  }, function (err, res) {
    debug(err, res);
    cb(err);
  });
};

/**
 * Upload a path into a file input.
 *
 * @param {String} selector
 * @param {String} path
 * @api private
 */

Nightmare.prototype._upload = function(selector, path, cb) {

};

/**
 * Wait for various states.
 *
 * @param {Number|String|Object} options Optional
 * @api private
 */

Nightmare.prototype._wait = function(options, cb) {
  var page = this.page;
  if (typeof options === 'number') {
    setTimeout(options, cb);
  }
  else if (typeof options === 'string') {
    var selector = options;
    var elementPresent = function () {
      var elements = $(selector);
      if (elements.length > 0) return true;
      else return false;
    };
    untilOnPage(elementPresent, this.options.timeout, this.options.interval, cb);
  }
  else {
    var isLoaded = function () {
      $.ready(function () {
        window.NIGHTMARE_LOADED_YET = true;
      });
      if (window.NIGHTMARE_LOADED_YET) return true;
      else return false;
    };
    untilOnPage(isLoaded, this.options.timeout, this.options.interval, cb);
  }
};

/**
 * Set a done callback.
 *
 * @param {Function} callback
 * @api private
 */

Nightmare.prototype._done = function(callback) {
  callback(null, this);
  cb();
};

/**
 * Set up a fresh phantomjs page.
 *
 * @param {Function} callback
 * @api private
 */

Nightmare.prototype._setup = function(cb) {
  var self = this;
  phantom.create(function(err, ph) {
    if (err) return cb(err);
    ph.createPage(function(err, page) {
      if (err) return cb(err);
      self.page = page;
      cb(err);
    });
  });
};

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
 * @param {Number} timeout
 * @param {Number} interval
 * @param {Function} then
 */

function untilOnPage(check, timeout, interval, then) {
  var condition = false;
  var hasCondition = function () {
    page.evaluate(check, function (err, res) {
      debug(err, res);
      condition = res;
    });
    return condition;
  };
  until(hasCondition, timeout, interval, then);
}

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
    if (check() || diff > timeout) then();
  }, interval);
}
