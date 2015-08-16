/**
 * Module Dependencies
 */

var debug = require('debug')('nightmare:actions');
var sliced = require('sliced');
var fs = require('fs');

/**
 * Get the title of the page.
 *
 * @param {Function} done
 */

exports.title = function(done) {
  debug('.title() getting it');
  this._evaluate(function() {
    return document.title;
  }, done);
};

/**
 * Evaluate
 */

exports.evaluate = function (js_fn, callback/**, arg1, arg2...*/) {
  // The last argument is the internal completion callback, but
  // "callback" is the external callback provided by the user.
  // We need to wrap them.
  var args = sliced(arguments);
  var external = callback;
  var internal = args[args.length-1];

  if (args.length == 2) {
    external = function(){};
  }

  var wrapped = function(err) {
    if (err) return internal(err);
    external.apply(null, sliced(arguments, 1));
    internal.apply(null, arguments);
  };
  args[1] = wrapped;
  debug('.evaluate() fn on the page');
  this._evaluate.apply(this, args);
};

/**
 * Get the url of the page.
 *
 * @param {Function} done
 */

exports.url = function(done) {
  debug('.url() getting it');
  this._evaluate(function() {
    return document.location.href;
  }, done);
};

/**
 * Determine if a selector is visible on a page.
 *
 * @param {String} selector
 * @param {Function} done
 */

exports.visible = function(selector, done) {
  debug('.visible() for ' + selector);
  this._evaluate(function(selector) {
    var elem = document.querySelector(selector);
    if (elem) return (elem.offsetWidth > 0 && elem.offsetHeight > 0);
    else return false;
  }, done, selector);
};

/**
 * Determine if a selector exists on a page.
 *
 * @param {String} selector
 * @param {Function} done
 */

exports.exists = function(selector, done) {
  debug('.exists() for ' + selector);
  this._evaluate(function(selector) {
    return (document.querySelector(selector)!==null);
  }, done, selector);
};

/**
 * Click an element.
 *
 * @param {String} selector
 * @param {Function} done
 */

exports.click = function(selector, done) {
  debug('.click() on ' + selector);
  this._evaluate(function (selector) {
    var element = document.querySelector(selector);
    var event = document.createEvent('MouseEvent');
    event.initEvent('click', true, true);
    element.dispatchEvent(event);
  }, done, selector);
};

/**
 * Hover over an element.
 *
 * @param {String} selector
 * @param {Function} done
 */

exports.mouseover = function(selector, done) {
  debug('.mouseover() on ' + selector);
  this._evaluate(function (selector) {
    var element = document.querySelector(selector);
    var event = document.createEvent('MouseEvent');
    event.initMouseEvent('mouseover', true, true);
    element.dispatchEvent(event);
  }, done, selector);
};

/**
 * Type into an element.
 *
 * @param {String} selector
 * @param {String} text
 * @param {Function} done
 */

exports.type = function(selector, text, done) {
  debug('.type() %s into %s', text, selector);
  var self = this;
  this._evaluate(function(selector, text){
    document.querySelector(selector).focus();
  }, function() {
    self.page.sendEvent('keypress', text, null, null, 0);
    done();
  }, selector, text);
};

/**
 * Check a checkbox, fire change event
 *
 * @param {String} selector
 * @param {Function} done
 */

exports.check = function(selector, done) {
  debug('.check() ' + selector);
  this._evaluate(function(selector) {
    var element = document.querySelector(selector);
    var event = document.createEvent('HTMLEvents');
    element.checked = true;
    event.initEvent('change', true, true);
    element.dispatchEvent(event);

  }, done, selector);
};

/**
 * Choose an option from a select dropdown
 *
 *
 *
 * @param {String} selector
 * @param {String} option value
 * @param {Function} done
 */

exports.select = function(selector, option, done) {
  debug('.select() ' + selector);
  this._evaluate(function(selector, option) {
    var element = document.querySelector(selector);
    var event = document.createEvent('HTMLEvents');
    element.value = option;
    event.initEvent('change', true, true);
    element.dispatchEvent(event);
  }, done, selector, option);
};

/**
 * Go back to previous url.
 *
 * @param {Function} done
 */

exports.back = function(done) {
  debug('.back()');
  this._evaluate(function() {
    window.history.back();
  }, done);
};

/**
 * Go forward to previous url.
 *
 * @param {Function} done
 */

exports.forward = function(done) {
  debug('.forward()');
  this._evaluate(function() {
    window.history.forward();
  }, done);
};

/**
 * Refresh the current page.
 *
 * @param {Function} done
 */

exports.refresh = function(done) {
  debug('.refresh()');
  this._evaluate(function() {
    window.location.reload();
  }, done);
};

/**
 * Wait for a specififed amount of time.
 *
 * @param {Number} ms
 */

exports.wait = function (ms, done) {
  setTimeout(done, ms);
};

/**
 * Execute a function on the page.
 *
 * @param {Function} fn
 * @param {...} args
 * @param {Function} done
 */

exports.evaluate = function (fn/**, arg1, arg2..., done**/) {
  // The last argument is the internal done callback, but
  // "callback" is the external callback provided by the user.
  // We need to wrap them.
  var args = [].slice.call(arguments);
  var done = args[args.length-1];
  var newArgs = [fn, done].concat(args.slice(1,-1));
  debug('.evaluate() fn on the page');
  this._evaluate.apply(this, newArgs);
};

/**
 * Inject a JavaScript or CSS file onto the page
 *
 * @param {String} type
 * @param {String} file
 * @param {Function} done
 */

exports.inject = function(type, file, done) {
  debug('.inject()-ing a file');
  if (type === 'js') {
    var js = fs.readFileSync(file, { encoding: 'utf-8' });
    // TODO: fix double-injection hack that magically makes
    // jQuery injection succeed :(
    var self = this;
    self._inject(js, function () {
      self._inject(js, done);
    });
  }
  else if (type === 'css') {
    var css = fs.readFileSync(file, { encoding: 'utf-8' });
    this.child.emit('css', css);
    done();
  }
  else {
    debug('unsupported file type in .inject()');
    done();
  }
};
