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
  var page = this.page;
  page.uploadFile(selector, path, cb);
};

/**
 * Wait for various states.
 *
 * @param {Number|String|Object} options Optional
 */

Nightmare.prototype.wait = function(options, cb) {
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
    internal();
    external.apply(null, arguments);
  };
  args[1] = wrapped;
  debug('.run() fn on the page');
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
    var args = item[1];
    return function (done) {
      args.push(function (result) {
        // all the callbacks from phantom are missing err
        done(null, result);
      });
      console.log(method, args);
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
 * @param {Function} then
 * @api private
 */

Nightmare.prototype.untilOnPage = function(check, then) {
  var page = this.page;
  var self = this;
  var condition = false;
  var hasCondition = function () {
    page.evaluate(check, function (res) {
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
 * @api private
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
