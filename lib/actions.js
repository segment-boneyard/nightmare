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
    document.activeElement.blur();
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

exports.type = function() {
  var selector = arguments[0], text, done;
  if(arguments.length == 2) {
    done = arguments[1];
  } else {
    text = arguments[1];
    done = arguments[2];
  }

  debug('.type() %s into %s', text, selector);
  var child = this.child;

  if((text || '') == ''){
    this.evaluate_now(function(selector){
      document.querySelector(selector).value = '';
    }, done, selector);
  } else {
    this.evaluate_now(function (selector) {
      document.querySelector(selector).focus();
    }, function() {
      child.once('type', done);
      child.emit('type', text);
    }, selector);
  }
};

/**
 * Insert text
 *
 * @param {String} selector
 * @param {String} text
 * @param {Function} done
 */

exports.insert = function (selector, text, done) {
  if (arguments.length === 2) {
    done = text
    text = null
  }

  debug('.insert() %s into %s', text, selector)

  var child = this.child;

  if((text || '') == ''){
    this.evaluate_now(function(selector){
      document.querySelector(selector).value = '';
    }, done, selector);
  } else {
    this.evaluate_now(function (selector) {
      document.querySelector(selector).focus();
    }, function() {
      child.once('insert', done);
      child.emit('insert', text);
    }, selector);
  }
}

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

/*
 * Uncheck a checkbox, fire change event
 *
 * @param {String} selector
 * @param {Function} done
 */

exports.uncheck = function(selector, done){
  debug('.uncheck() ' + selector);
  this.evaluate_now(function(selector) {
      var element = document.querySelector(selector);
      var event = document.createEvent('HTMLEvents');
      element.checked = null;
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
    if(arg < this.optionWaitTimeout){
      waitms(arg, done);
    } else {
      waitms(this.optionWaitTimeout, function(){
        done(new Error('.wait() timed out after '+this.optionWaitTimeout+'msec'));
      }.bind(this));
    }
  }
  else if (typeof arg === 'string') {
    debug('.wait() for ' + arg + ' element');
    waitelem(this, arg, done);
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

/**
 * Wait until evaluated function returns true.
 *
 * @param {Nightmare} self
 * @param {Function} fn
 * @param {...} args
 * @param {Function} done
 */

var _timeoutMs = 250;
function waitfn() {
  var waitMsPassed = 0;
  return tick.apply(this, arguments)

  function tick (self, fn/**, arg1, arg2..., done**/) {
    var args = sliced(arguments);
    var done = args[args.length-1];
    var waitDone = function (err, result) {
      if (result) {
        return done();
      }
      else if (self.optionWaitTimeout && waitMsPassed > self.optionWaitTimeout) {
        return done(new Error('.wait() timed out after '+self.optionWaitTimeout+'msec'));
      }
      else {
        waitMsPassed += _timeoutMs;
        setTimeout(function () {
          tick.apply(self, args);
        }, _timeoutMs);
      }
    };
    var newArgs = [fn, waitDone].concat(args.slice(2,-1));
    self.evaluate_now.apply(self, newArgs);
  }
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
    this._inject(js, done);
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
 * Save the current file as html to disk.
 *
 * @param {String} path the full path to the file to save to
 * @param {String} saveType
 * @param {Function} done
 */

exports.html = function (path, saveType, done) {
  debug('.html()');
  if (typeof path === 'function' && !saveType && !done) {
    done = path;
    saveType = undefined;
    path = undefined;
  } else if (typeof path === 'object' && typeof saveType === 'function' && !done) {
    done = saveType;
    saveType = path;
    path = undefined;
  } else if (typeof saveType === 'function' && !done) {
    done = saveType;
    saveType = undefined;
  }
  this.child.once('html', function (err) {
    if (err) debug(err);
    done(err);
  });
  this.child.emit('html', path, saveType);
}

/**
 * Take a pdf.
 *
 * @param {String} path
 * @param {Function} done
 */

exports.pdf = function (path, options, done) {
  debug('.pdf()');
  if (typeof path === 'function' && !options && !done) {
    done = path;
    options = undefined;
    path = undefined;
  } else if (typeof path === 'object' && typeof options === 'function' && !done){
    done = options;
    options = path;
    path = undefined;
  } else if (typeof options === 'function' && !done) {
    done = options;
    options = undefined;
  }
  this.child.once('pdf', function (err, pdf) {
    if (err) debug(err);
    var buf = new Buffer(pdf.data);
    debug('.pdf() captured with length %s', buf.length);
    path ? fs.writeFile(path, buf, done) : done(null, buf);
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

/**
 * Clear a cookie
 */

exports.cookies.clear = function (name, done) {
  debug('cookies.clear()')
  var cookies = []

  switch (arguments.length) {
    case 2:
      cookies = [].concat(name);
      break;
    case 1:
      done = name;
      break;
  }

  this.child.once('cookie.clear', done);
  this.child.emit('cookie.clear', cookies);
};

/**
 * Authentication
 */

 exports.authentication = function (login, password, done) {
   debug('.authentication()');
   this.child.once('authentication', done);
   this.child.emit('authentication', login, password);
 };
