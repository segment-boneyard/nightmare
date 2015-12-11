/**
 * Module Dependencies
 */

var debug = require('debug')('nightmare:actions');
var sliced = require('sliced');
var jsesc = require('jsesc');
var isArray = Array.isArray;
var once = require('once');
var fs = require('fs');
var keys = Object.keys;

/**
 * Get the title of the page.
 *
 * @param {Function} done
 */

exports.title = function(done) {
  debug('.title() getting it');
  this.evaluate_now(function() {
    return document.title;
  }, done);
};

/**
 * Get the url of the page.
 *
 * @param {Function} done
 */

exports.url = function(done) {
  debug('.url() getting it');
  this.evaluate_now(function() {
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
  this.evaluate_now(function(selector) {
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
  this.evaluate_now(function(selector) {
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
  this.evaluate_now(function (selector) {
    var element = document.querySelector(selector);
    var event = document.createEvent('MouseEvent');
    event.initEvent('click', true, true);
    element.dispatchEvent(event);
  }, done, selector);
};

/**
 * Mousedown on an element.
 *
 * @param {String} selector
 * @param {Function} done
 */

exports.mousedown = function(selector, done) {
  debug('.mousedown() on ' + selector);
  this.evaluate_now(function (selector) {
    var element = document.querySelector(selector);
    var event = document.createEvent('MouseEvent');
    event.initEvent('mousedown', true, true);
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
  this.evaluate_now(function (selector) {
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
  this.evaluate_now(function (selector, text) {
    var elem = document.querySelector(selector);
    elem.focus();
    elem.value = text;
    elem.blur();
  }, done, selector, text);
};

/**
 * Check a checkbox, fire change event
 *
 * @param {String} selector
 * @param {Function} done
 */

exports.check = function(selector, done) {
  debug('.check() ' + selector);
  this.evaluate_now(function(selector) {
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
  this.evaluate_now(function(selector, option) {
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
  this.evaluate_now(function() {
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
  this.evaluate_now(function() {
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
  this.evaluate_now(function() {
    window.location.reload();
  }, done);
};

/**
 * Wait
 *
 * @param {...} args
 */

exports.wait = function () {
  var args = sliced(arguments);
  var done = args[args.length-1];
  if (args.length < 2) {
    debug('Not enough arguments for .wait()');
    return done();
  }

  var arg = args[0];
  if (typeof arg === 'number') {
    debug('.wait() for ' + arg + 'ms');
    waitms(arg, done);
  }
  else if (typeof arg === 'string') {
    if(arg == 'downloads-complete'){
      debug('.wait() for downloads');
      waitDownloads(this, done);
    } else {
      debug('.wait() for ' + arg + ' element');
      waitelem(this, arg, done);
    }
  }
  else if (typeof arg === 'function') {
    debug('.wait() for fn');
    args.unshift(this);
    waitfn.apply(this, args);
  }
  else {
    done();
  }
};

/**
 * Wait for a specififed amount of time.
 *
 * @param {Number} ms
 * @param {Function} done
 */

function waitms (ms, done) {
  setTimeout(done, ms);
}

/**
 * Wait for a specififed amount of time.
 *
 * @param {Nightmare} self
 * @param {String} selector
 * @param {Function} done
 */

function waitelem (self, selector, done) {
  eval("var elementPresent = function() {"+
      "  var element = document.querySelector('"+jsesc(selector)+"');"+
      "  return (element ? true : false);" +
      "};");
  waitfn(self, elementPresent, done);
}

var _waitMsPassed = 0;
var _timeoutMs = 250;

/**
 * Wait until downloads are complete.
 *
 * @param {Nightmare} self
 * @param {Function} done
 */

function waitDownloads (self, done) {
  var dldone = function(){
    return Object.keys(self._downloads).map(key => self._downloads[key]).filter(function(item){
      return item.state != 'completed' && item.state != 'interrupted' && item.state != 'cancelled';
    }) == 0;
  };

  if(dldone()){
    return done();
    _waitMsPassed = 0;
  }
  else if(self.optionDownloadTimeout && _waitMsPassed > self.optionDownloadTimeout){
    _waitMsPassed = 0;
    return done(new Error('.wait() for download timed out after ' + self.optionDownloadTimeout + 'msec'));
  }
  else{
    _waitMsPassed += _timeoutMs;
    setTimeout(function(){
      waitDownloads(self, done);
    }, _timeoutMs);
  }
}

/**
 * Wait until evaluated function returns true.
 *
 * @param {Nightmare} self
 * @param {Function} fn
 * @param {...} args
 * @param {Function} done
 */

function waitfn (self, fn/**, arg1, arg2..., done**/) {
  var args = sliced(arguments);
  var done = args[args.length-1];
  var waitDone = function (err, result) {
    if (result) {
      _waitMsPassed = 0;
      return done();
    }
    else if (self.optionWaitTimeout && _waitMsPassed > self.optionWaitTimeout) {
      _waitMsPassed = 0;
      return done(new Error('.wait() timed out after '+self.optionWaitTimeout+'msec'));
    }
    else {
      _waitMsPassed += _timeoutMs;
      setTimeout(function () {
        waitfn.apply(self, args);
      }, _timeoutMs);
    }
  };
  var newArgs = [fn, waitDone].concat(args.slice(2,-1));
  self.evaluate_now.apply(self, newArgs);
}

/**
 * Execute a function on the page.
 *
 * @param {Function} fn
 * @param {...} args
 * @param {Function} done
 */

exports.evaluate = function (fn/**, arg1, arg2..., done**/) {
  var args = sliced(arguments);
  var done = args[args.length-1];
  var newArgs = [fn, done].concat(args.slice(1,-1));
  debug('.evaluate() fn on the page');
  this.evaluate_now.apply(this, newArgs);
};

/**
 * Inject a JavaScript or CSS file onto the page
 *
 * @param {String} type
 * @param {String} file
 * @param {Function} done
 */

exports.inject = function (type, file, done) {
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

/**
 * Set the viewport.
 *
 * @param {Number} width
 * @param {Number} height
 * @param {Function} done
 */

exports.viewport = function (width, height, done) {
  debug('.viewport()');
  this.child.emit('size', width, height);
  done();
};

/**
 * Set the useragent.
 *
 * @param {String} useragent
 * @param {Function} done
 */

exports.useragent = function(useragent, done) {
  debug('.useragent() to ' + useragent);
  this.child.once('useragent', function () {
    done();
  });
  this.child.emit('useragent', useragent);
};

/**
 * Set the scroll position.
 *
 * @param {Number} x
 * @param {Number} y
 * @param {Function} done
 */

exports.scrollTo = function (y, x, done) {
  debug('.scrollTo()');
  this.evaluate_now(function (y, x) {
    window.scrollTo(x, y);
  }, done, y, x);
};

/**
 * Take a screenshot.
 *
 * @param {String} path
 * @param {Object} clip
 * @param {Function} done
 */

exports.screenshot = function (path, clip, done) {
  debug('.screenshot()');
  if (typeof path === 'function') {
    done = path;
    clip = undefined;
    path = undefined;
  } else if (typeof clip === 'function') {
    done = clip;
    clip = (typeof path === 'string') ? undefined : path;
    path = (typeof path === 'string') ? path : undefined;
  }
  this.child.once('screenshot', function (img) {
    var buf = new Buffer(img.data);
    debug('.screenshot() captured with length %s', buf.length);
    path ? fs.writeFile(path, buf, done) : done(null, buf);
  });
  this.child.emit('screenshot', path, clip);
};

/**
 * Take a pdf.
 *
 * @param {String} path
 * @param {Function} done
 */

exports.pdf = function (path, options, done) {
  debug('.pdf()');
  if (typeof options === 'function' && !done) {
    done = options;
    options = undefined;
  }
  this.child.once('pdf', function (err) {
    if (err) debug(err);
    done();
  });
  this.child.emit('pdf', path, options);
};

/**
 * Get and set cookies
 *
 * @param {String} name
 * @param {Mixed} value (optional)
 * @param {Function} done
 */

exports.cookies = {};

/**
 * Get a cookie
 */

exports.cookies.get = function (name, done) {
  debug('cookies.get()')
  var query = {}

  switch (arguments.length) {
    case 2:
      query = typeof name === 'string'
        ? { name: name }
        : name
      break;
    case 1:
      done = name
      break;
  }

  this.child.once('cookie.get', done)
  this.child.emit('cookie.get', query);
};

/**
 * Set a cookie
 */

exports.cookies.set = function (name, value, done) {
  debug('cookies.set()')
  var cookies = []

  switch (arguments.length) {
    case 3:
      cookies.push({
        name: name,
        value: value
      })
      break;
    case 2:
      cookies = [].concat(name)
      done = value
      break;
    case 1:
      done = name
      break;
  }

  this.child.once('cookie.set', done);
  this.child.emit('cookie.set', cookies);
};
