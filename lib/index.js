var series = require('async-series');
var phantom = require('phantom');
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
 * Use a `plugin` function.
 *
 * @param {Function} plugin
 * @return {Nightmare}
 */

Nightmare.prototype.use = function(plugin){
  debug('.use()-ing a plugin');
  plugin(this);
  return this;
};

/**
 * Go to a new url.
 *
 * @param {String} url
 */

Nightmare.prototype.goto = function(url, cb) {
  var page = this.page;
  debug('.goto() url: ' + url);
  page.open(url, function (status) {
    debug('.goto() page loaded: ' + status);
    setTimeout(cb, 500);
  });
};

/**
 * Refresh the page.
 */

Nightmare.prototype.refresh = function(cb) {
  debug('.refresh()-ing the page');
  this.page.evaluate(function(selector) {
    document.location.reload(true);
  }, cb);
};

/**
 * Get the url of the page.
 *
 * @param {Function} callback
 * @param {Function} cb
 */

Nightmare.prototype.url = function(callback, cb) {
  debug('.url() getting it');
  this.page.evaluate(function() {
    return document.location.href;
  }, function (url) {
    callback(url);
    cb();
  });
};

/**
 * Click an element.
 *
 * @param {String} selector
 */

Nightmare.prototype.click = function(selector, cb) {
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
 */

Nightmare.prototype.type = function(selector, text, cb) {
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
 */

Nightmare.prototype.upload = function(selector, path, cb) {
  debug('.upload() to ' + selector + ' with ' + path);
  this.page.uploadFile(selector, path, impatient(cb, this.options.timeout));
};

/**
 * Wait for various states.
 *
 * @param {Null|Number|String|Function} condition
 */

Nightmare.prototype.wait = function(/* args */) {
  var page = this.page;
  var args = arguments;
  var cb = args[args.length-1];

  // null
  if (args.length === 1) {
    debug('.wait() for the next page load');
    this.afterNextPageLoad(cb);
  }
  else if (args.length === 2) {
    var condition = args[0];
    if (typeof condition === 'number') {
      var ms = condition;
      debug('.wait() for ' + ms + 'ms');
      setTimeout(cb, ms);
    }
    else if (typeof condition === 'string') {
      var selector = condition;
      debug('.wait() for the element ' + selector);
      var elementPresent = function (selector) {
        var element = document.querySelector(selector);
        return (element ? true : false);
      };
      this.untilOnPage(elementPresent, true, cb, selector);
    }
  }
  // wait for on-page fn==value
  else if (args.length > 2) {
    var fn = args[0];
    var value = args[1];
    if (args.length === 3) {
      debug('.wait() for fn==' + value);
      this.untilOnPage(fn, value, cb);
    }
    else if (args.length === 4) {
      var delay = args[2];
      debug('.wait() for fn==' + value + ' with refreshes every ' + delay);
      this.refreshUntilOnPage(fn, value, delay, cb);
    }
  }
};

/**
 * Take a screenshot.
 *
 * @param {String} path
 */

Nightmare.prototype.screen = function(path, cb) {
  debug('.screen() saved to ' + path);
  this.page.render(path, cb);
};

/**
 * Run the function on the page.
 *
 * @param {Function} func
 * @param {Function} callback
 * @param {...} args
 */

Nightmare.prototype.evaluate = function(func, callback/**, arg1, arg2...*/) {
  // The last argument is the internal completion callback, but
  // "callback" is the external callback provided by the user.
  // We need to wrap them.
  var args = copy(arguments);
  var external = callback;
  var internal = args[args.length-1];
  var wrapped = function () {
    external.apply(null, arguments);
    internal();
  };
  args[1] = wrapped;
  debug('.evaluate() fn on the page');
  this.page.evaluate.apply(this.page, args);
};

/**
 * Set the viewport.
 *
 * @param {Number} width
 * @param {Number} height
 */

Nightmare.prototype.viewport = function(width, height, cb) {
  debug('.viewport() to ' + width + ' x ' + height);
  var viewport = { width: width, height: height };
  this.page.set('viewportSize', viewport, cb);
};

/**
 * Set the user agent.
 *
 * @param {String} agent
 */

Nightmare.prototype.agent = function(agent, cb) {
  debug('.agent() to ' + agent);
  this.page.set('settings.userAgent', agent, cb);
};


/**
 * Run all the queued methods.
 *
 * @param {Function} callback
 */

Nightmare.prototype.run = function(callback) {
  if (this._queue.length === 0) return;
  var self = this;
  var funcs = this._queue.map(function (item) {
    var method = item[0];
    var args = item[1] || [];
    return function (done) {
      var cb = function (result) {
        // all the callbacks from phantom are missing err
        done(null, result);
      };
      args.push(cb);
      method.apply(self, args);
    };
  });
  this._queue = [];
  series(funcs, function (err) {
    callback(err, self);
  });
};

/**
 * Set up a fresh phantomjs page.
 *
 * @param {Function} cb
 */

Nightmare.prototype.setup = function (cb) {
  var self = this;
  this.setupInstance(function (instance) {
    debug('.setup() phantom instance created');
    instance.createPage(function(page) {
      self.page = page;
      debug('.setup() phantom page created');
      cb();
    });
  });
};

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
        cb(PHANTOMJS_INSTANCE);
      }
    }, 50);
  }
  else {
    PHANTOMJS_INITING = true;
    phantom.create(function(instance) {
      PHANTOMJS_INSTANCE = instance;
      cb(instance);
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
  var args = copy(arguments).slice(3);
  var hasCondition = function () {
    args.unshift(function (res) {
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
    page.evaluate(check, function (result) {
      if (result === value) {
        debug('.wait() saw value match after refresh');
        clearInterval(interval);
        then();
      }
      else {
        debug('.wait() refreshing the page (no match on value=' + result + ')');
        page.evaluate(function () {
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

Nightmare.prototype.afterNextPageLoad = function (cb) {
  var isUnloaded = function () {
    return (document.readyState !== "complete");
  };
  var isLoaded = function () {
    return (document.readyState === "complete");
  };
  var self = this;
  self.untilOnPage(isUnloaded, true, function () {
    debug('.wait() detected page unload');
    self.untilOnPage(isLoaded, true, function (res) {
      debug('.wait() detected page load');
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

/**
 * Copy arguments into a real array.
 *
 * @param {Array} arguments
 * @returns {Array} args
 */

function copy(args) {
  var copy = [];
  for (var i = 0; i < args.length; i++) {
    copy.push(args[i]);
  }
  return copy;
}

/**
 * Impatiently call the function after a timeout, if it hasn't been called yet.
 *
 * @param {Function} fn
 * @param {Number} timeout
 */

function impatient(fn, timeout) {
  var called = false;
  var wrapper = function () {
    if (!called) fn.apply(null, arguments);
    called = true;
  };
  setTimeout(wrapper, timeout);
  return wrapper;
}

/**
 * Generate a public API method that just queues and nudges the queue.
 *
 * @param {String} name
 */

function createMethod(name) {
  var fn = Nightmare.prototype[name];
  Nightmare.prototype[name] = function () {
    this._queue.push([fn, copy(arguments)]);
    return this;
  };
}

createMethod('url');
createMethod('refresh');
createMethod('goto');
createMethod('click');
createMethod('type');
createMethod('upload');
createMethod('wait');
createMethod('setup');
createMethod('screen');
createMethod('evaluate');
createMethod('viewport');
createMethod('agent');
