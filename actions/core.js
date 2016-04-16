"use strict";

const debug = require("debug")("nightmare:core");
const co = require("co");
const Nightmare = require("../lib/nightmare");
const _ = require("lodash");
const fs = require("fs");
const delay = require("delay");

/**
 * Contains the core set of actions
 */

/**
  * Go back to previous url.
  */
Nightmare.action('back',
    function (ns, options, parent, win, renderer) {
        parent.on('goBack', function () {
            if (!win.webContents.canGoBack()) {
                parent.emit('goBack', {
                    error: true
                });
            } else {
                win.webContents.once('did-finish-load', function () {
                    parent.emit('goBack', {
                        result: win.webContents.getURL()
                    });
                });
                win.webContents.goBack();
            }
        });
    },
    function () {
        debug('.back()');
        return this._invokeRunnerOperation("goBack");
    });

/**
  * Check a checkbox, fire change event
  *
  * @param {String} selector
  */
Nightmare.action('check',
    function (selector) {
        debug('.check() ' + selector);
        return this.evaluate_now(function (selector) {
            var element = document.querySelector(selector);
            var event = document.createEvent('HTMLEvents');
            element.checked = true;
            event.initEvent('change', true, true);
            element.dispatchEvent(event);
        }, selector);
    });

/**
  * Click an element using a JavaScript based event.
  *
  * @param {String} selector
  */
Nightmare.action('click',
    function (selector) {
        debug('.click() on ' + selector);
        return this.evaluate_now(function (selector) {
            document.activeElement.blur();
            var element = document.querySelector(selector);
            var event = document.createEvent('MouseEvent');
            event.initEvent('click', true, true);
            element.dispatchEvent(event);
        }, selector);
    });

/**
  * Click an element and wait until the next load operation completes.
  * Use this function when you expect a click to perform a navigation action, usually on anchor elements, but elsewhere too.
  *
  * @param {String} selector
  */
Nightmare.action('clickAndWaitUntilFinishLoad',
    function (selector) {
        debug('.clickAndWaitUntilFinishLoad() on ' + selector);

        let child = this.child;
        let waitUntilFinishLoadPromise = this._invokeRunnerOperation("waitUntilFinishLoad");

        let clickPromise = this.evaluate_now(function (selector) {
            document.activeElement.blur();
            var element = document.querySelector(selector);
            var event = document.createEvent('MouseEvent');
            event.initEvent('click', true, true);
            element.dispatchEvent(event);
        }, selector);

        return Promise.all([clickPromise, waitUntilFinishLoadPromise]);
    });

/**
 * Returns a promise which invokes the specified action which expects to perform a navigation action.
 */
Nightmare.action('expectNavigation',
    function (fn, timeout) {
        if (!timeout)
            timeout = this._options.waitTimeout;

        let waitPromise = Promise.all([this.waitUntilFinishLoad(), fn.apply(this)]);

        let timeoutPromise = new Promise(function (resolve, reject) {
            setTimeout(reject, timeout, ".expectNavigation() timed out after " + timeout);
        });
        return Promise.race([waitPromise, timeoutPromise]);
    });

/**
  * Evaluate a function on the page.
  *
  * @param {Function} fn
  * @param {...} args
  */
Nightmare.action('evaluate',
    function (fn/**, arg1, arg2...**/) {
        let args = Array.from(arguments);
        if (!_.isFunction(fn)) {
            return done(new Error('.evaluate() fn should be a function'));
        }
        debug('.evaluate() fn on the page');
        return this.evaluate_now.apply(this, args);
    });

/**
  * Evaluates an asynchronous function on the page.
  *
  * @param {Function} fn
  * @param {...} args
  */
Nightmare.action('evaluateAsync',
    function (fn/**, arg1, arg2...**/) {
        let args = Array.from(arguments);
        if (!_.isFunction(fn)) {
            return done(new Error('.evaluateAsync() fn should be a function'));
        }
        debug('.evaluateAsync() fn on the page');
        return this.evaluate_async.apply(this, args);
    });
/**
 * Determine if a selector exists on a page.
 *
 * @param {String} selector
 */
Nightmare.action('exists',
    function (selector) {
        debug('.exists() for ' + selector);
        return this.evaluate_now(function (selector) {
            return (!!document.querySelector(selector));
        }, selector);
    });

/**
 * Go forward to previous url.
 */
Nightmare.action('forward',
    function (ns, options, parent, win, renderer) {
        parent.on('goForward', function () {
            if (!win.webContents.canGoForward()) {
                parent.emit('goForward', true);
            } else {
                win.webContents.once('did-finish-load', function () {
                    parent.emit('goForward', {
                        result: win.webContents.getURL()
                    });
                });
                win.webContents.goForward();
            }
        });
    },
    function () {
        debug('.goForward()');

        return this._invokeRunnerOperation("goForward");
    });

/**
 * Instructs the browser to go to a specific url and wait until loading completes.
 * If the browser is currently at the specified URL, no action is taken.
 */
 
Nightmare.action('goto',
    function (ns, options, parent, win, renderer) {
        parent.on('goto', function (url, headers) {
            var extraHeaders = '';
            for (var key in headers) {
                extraHeaders += key + ': ' + headers[key] + '\n';
            }

            if (win.webContents.getURL() == url) {
                parent.emit('goto', {
                    result: url
                });
            } else {
                var resolveGoto = function (message) {
                    win.webContents.removeListener("did-fail-load", rejectGoto);
                    parent.emit('goto', {
                        result: win.webContents.getURL()
                    });
                };
                var rejectGoto = function (message) {
                    win.webContents.removeListener("did-finish-load", resolveGoto);
                    parent.emit('goto', {
                        error: message
                    });
                };

                win.webContents.once('did-fail-load', rejectGoto);
                win.webContents.once('did-finish-load', resolveGoto);

                win.webContents.loadURL(url, {
                    extraHeaders: extraHeaders
                });
            }
        });
    },
    function (url, headers) {
        debug('goto() starting navigation to %s', url);

        headers = headers || {};
        for (let key in this._headers) {
            headers[key] = headers[key] || this._headers[key];
        }

        return this._invokeRunnerOperation("goto", url, headers);
    });

/**
  * Get the client rects of the specified selector
  */
Nightmare.action('getClientRects', function (selector) {

    return this.evaluate_now(function (selector) {
        'use strict';
        var element = document.querySelector(selector);

        if (!element)
            throw "An element could not be located with the specified selector: " + selector;

        var clientRects = element.getClientRects();

        if (!clientRects)
            throw "Client rects could not be retrieved."

        var result = [];

        for (let rect of Array.from(clientRects)) {
            result.push({
                bottom: rect.bottom,
                height: rect.height,
                left: rect.left,
                right: rect.right,
                top: rect.top,
                width: rect.width
            });
        }

        return result;
    }, selector);
});

/*
 * Save the contents of the current page as html
 */
Nightmare.action('html',
    function (ns, options, parent, win, renderer) {
        parent.on('html', function (path, saveType) {
            // https://github.com/atom/electron/blob/master/docs/api/web-contents.md#webcontentssavepagefullpath-savetype-callback
            saveType = saveType || 'HTMLComplete'
            win.webContents.savePage(path, saveType, function (err) {
                parent.emit('html', {
                    err: err
                });
            });
        });
    },
    function (path, saveType) {
        debug('.html() starting');
        return this._invokeRunnerOperation("html", path, saveType);
    });

/**
  * Insert text
  *
  * @param {String} selector
  * @param {String} text
  */
Nightmare.action('insert',
    function (ns, options, parent, win, renderer) {
        parent.on('insert', function (value) {
            win.webContents.insertText(String(value))
            parent.emit('insert')
        })
    },
    function (selector, text) {
        debug('.insert() %s into %s', text, selector);

        let self = this;
        return co(function* () {
            if (!text) {
                return self.evaluate_now(function (selector) {
                    document.querySelector(selector).focus();
                    document.querySelector(selector).value = '';
                }, selector);
            } else {
                try {
                    yield self.evaluate_now(function (selector) {
                        document.querySelector(selector).focus();
                    }, selector);
                }
                catch (ex) {
                    throw ex;
                }

                return self._invokeRunnerOperation("insert", text);
            }
        });
    });

/**
  * Mousedown on an element.
  *
  * @param {String} selector
  */
Nightmare.action('mousedown',
    function (selector) {
        debug('.mousedown() on ' + selector);
        return this.evaluate_now(function (selector) {
            var element = document.querySelector(selector);
            var event = document.createEvent('MouseEvent');
            event.initEvent('mousedown', true, true);
            element.dispatchEvent(event);
        }, selector);
    });

/**
 * Hover over an element.
 *
 * @param {String} selector
 * @param {Function} done
 */
Nightmare.action('mouseover',
    function (selector) {
        debug('.mouseover() on ' + selector);
        return this.evaluate_now(function (selector) {
            var element = document.querySelector(selector);
            var event = document.createEvent('MouseEvent');
            event.initMouseEvent('mouseover', true, true);
            element.dispatchEvent(event);
        }, selector);
    });


/**
 * Take a pdf.
 *
 * @param {String} path
 * @param {Object} options
 */
Nightmare.action('pdf',
    function (ns, options, parent, win, renderer) {
        const _ = require("lodash");
        parent.on('pdf', function (path, options) {
            // https://github.com/fraserxu/electron-pdf/blob/master/index.js#L98
            options = _.defaults(options, {
                marginType: 0,
                printBackground: true,
                printSelectionOnly: false,
                landscape: false
            });

            win.webContents.printToPDF(options, function (err, data) {
                if (err) return parent.emit('pdf', arguments);
                parent.emit('pdf', {
                    result: data
                });
            });
        });
    },
    function (path, options) {
        debug('.pdf()');
        if (!options && _.isObject(path)) {
            options = path;
            path = undefined;
        }

        return this._invokeRunnerOperation("pdf", path, options)
            .then(function (pdf) {
                let buf = new Buffer(pdf.data);
                debug('.pdf() captured with length %s', buf.length);
                if (!path)
                    return buf;

                return fs.writeFileSync(path, buf);
            });
    });


/**
 * Refresh the current page.
 */
Nightmare.action('refresh',
    function (ns, options, parent, win, renderer) {
        debug('.refresh()');
        return this.evaluate_now(function () {
            window.location.reload();
        });
    });

/**
  * Instructs the browser to reload the page.
  */
Nightmare.action('reload',
    function () {
        parent.on('reload', function () {
            win.webContents.reload();
            parent.emit('reload');
        });
    },
    function () {
        debug('.reload()');
        return this._invokeRunnerOperation("reload");
    });

/**
  * Take a screenshot.
  *
  * @param {String} path
  * @param {Object} clip
  */
Nightmare.action('screenshot',
    function (ns, options, parent, win, renderer, frameManager) {
        parent.on('screenshot', function (clip) {
            // https://gist.github.com/twolfson/0d374d9d7f26eefe7d38
            var args = [function handleCapture(img) {
                parent.emit('screenshot', {
                    result: img.toPng()
                });
            }];
            if (clip) args.unshift(clip);
            frameManager.requestFrame(function () {
                win.capturePage.apply(win, args);
            });
        });
    },
    function (path, clip) {
        debug('.screenshot()');

        if (!clip && _.isObject(path)) {
            clip = path;
            path = undefined;
        }

        return this._invokeRunnerOperation("screenshot", clip)
            .then(function (img) {
                let buf = new Buffer(img.data);
                debug('.screenshot() captured with length %s', buf.length);
                if (!path)
                    return buf;

                return fs.writeFileSync(path, buf);
            });
    });

/**
  * Set the scroll position.
  *
  * @param {Number} x
  * @param {Number} y
  */
Nightmare.action('scrollTo',
    function (y, x) {
        debug('.scrollTo()');

        if (!x && _.isString(y)) {
            return this.evaluate_now(function (selector) {
                var element = document.querySelector(selector);
                if (element) {
                    var rect = element.getBoundingClientRect();
                    window.scrollTo(Math.round(rect.left), Math.round(rect.top));
                }
                else
                    throw 'invalid selector "' + selector + '"';
            }, y);
        }
        else if (_.isNumber(x) && _.isNumber(x)) {
            return this.evaluate_now(function (y, x) {
                window.scrollTo(x, y);
            }, y, x);
        }
    });

/**
  * Choose an option from a select dropdown
  *
  * @param {String} selector
  * @param {String} option value
  */
Nightmare.action('select',
    function (selector, option) {
        debug('.select() ' + selector);
        return this.evaluate_now(function (selector, option) {
            var element = document.querySelector(selector);
            var event = document.createEvent('HTMLEvents');
            element.value = option;
            event.initEvent('change', true, true);
            element.dispatchEvent(event);
        }, selector, option);
    });

/**
  * Set the state of audio in the browser process.
  *
  * @param {bool} value that indicates if audio should be muted.
  */
Nightmare.action('setAudioMuted',
    function (ns, options, parent, win, renderer) {
        parent.on('audio', function (audio) {
            win.webContents.setAudioMuted(audio);
            parent.emit('audio', {
                result: win.webContents.isAudioMuted()
            });
        });
    },
    function (isMuted) {
        debug('.setAudioMuted() to ' + isMuted);

        return this._invokeRunnerOperation("audio", isMuted);
    });
/**
  * If prompted for login, supplies the specified credentials.
  */
Nightmare.action('setAuthenticationCredentials',
    function (ns, options, parent, win, renderer) {
        parent.on('setAuthenticationCredentials', function (username, password) {
            win.webContents.on('login', function (webContents, request, authInfo, callback) {
                callback(username, password);
            });
            parent.emit('setAuthenticationCredentials');
        });
    },
    function (username, password) {
        debug(".authentication()");

        return this._invokeRunnerOperation("setAuthenticationCredentials", username, password);
    });
/**
  * instructs the browser to stop page loading.
  */
Nightmare.action('stop',
    function (ns, options, parent, win, renderer) {
        parent.on('stop', function () {
            win.webContents.stop();
            parent.emit('stop');
        });
    },
    function () {
        debug('.stop()');

        return this._invokeRunnerOperation("stop");
    });

/**
  * Get the title of the page.
  */
Nightmare.action('title',
    function (ns, options, parent, win, renderer) {
        parent.on('title', function () {
            parent.emit("title", {
                result: win.webContents.getTitle()
            });
        });
    },
    function () {
        debug('.title() getting it');

        return this._invokeRunnerOperation("title");
    });

/**
 * Type into an element.
 *
 * @param {String} selector
 * @param {String} text
 */
Nightmare.action('type',
    function (ns, options, parent, win, renderer) {
        parent.on('type', function (value) {
            var chars = String(value).split('')

            function type() {
                var ch = chars.shift()
                if (ch === undefined) {
                    parent.emit('type');
                    return;
                }

                // keydown
                win.webContents.sendInputEvent({
                    type: 'keyDown',
                    keyCode: ch
                });

                // keypress
                win.webContents.sendInputEvent({
                    type: 'char',
                    keyCode: ch
                });

                // keyup
                win.webContents.sendInputEvent({
                    type: 'keyUp',
                    keyCode: ch
                });

                // HACK to prevent async keyboard events from
                // being played out of order. The timeout is
                // somewhat arbitrary. I want to achieve a
                // nice balance between speed and correctness
                // if you find that this value it too low,
                // please open an issue.
                setTimeout(type, 100);
            }

            // start
            type();
        })
    },
    function () {
        let selector = arguments[0], text;
        if (arguments.length == 2) {
            text = arguments[1];
        }

        debug('.type() %s into %s', text, selector);
        let child = this.child;
        let self = this;
        return co(function* () {
            if (!text) {
                return self.evaluate_now(function (selector) {
                    document.querySelector(selector).focus();
                    document.querySelector(selector).value = '';
                }, selector);
            } else {
                try {
                    yield self.evaluate_now(function (selector) {
                        document.querySelector(selector).focus();
                    }, selector);
                }
                catch (ex) {
                    throw ex;
                }

                return self._invokeRunnerOperation("type", text);
            }
        });
    });


/*
 * Uncheck a checkbox, fire change event
 *
 * @param {String} selector
 */
Nightmare.action('uncheck',
    function (selector) {
        debug('.uncheck() ' + selector);
        return this.evaluate_now(function (selector) {
            var element = document.querySelector(selector);
            var event = document.createEvent('HTMLEvents');
            element.checked = null;
            event.initEvent('change', true, true);
            element.dispatchEvent(event);
        }, selector);
    });


/**
 * Get the url of the page.
 */
Nightmare.action('url',
    function (ns, options, parent, win, renderer) {
        parent.on('url', function () {
            parent.emit("url", {
                result: win.webContents.getURL()
            });
        });
    },
    function () {
        debug('.url() getting it');

        return this._invokeRunnerOperation("url");
    });

/**
  * Set the useragent.
  *
  * @param {String} useragent
  */
Nightmare.action('useragent',
    function (ns, options, parent, win, renderer) {
        parent.on('useragent', function (useragent) {
            win.webContents.setUserAgent(useragent);
            parent.emit('useragent');
        });
    },
    function (useragent) {
        debug('.useragent() to ' + useragent);

        return this._invokeRunnerOperation("useragent", useragent);
    });

/**
  * Set the viewport.
  *
  * @param {Number} width
  * @param {Number} height
  */
Nightmare.action('viewport',
    function (ns, options, parent, win, renderer) {
        parent.on('size', function (width, height) {
            win.setSize(width, height);
            parent.emit("size");
        });
    },
    function (width, height) {
        debug('.viewport()');

        return this._invokeRunnerOperation("size", width, height);
    });

/**
  * Determine if a selector is visible on a page.
  *
  * @param {String} selector
  */
Nightmare.action('visible',
    function (selector) {
        debug('.visible() for ' + selector);
        return this.evaluate_now(function (selector) {
            var elem = document.querySelector(selector);
            if (elem)
                return (elem.offsetWidth > 0 && elem.offsetHeight > 0);
            else
                return false;
        }, selector);
    });

/**
  * Wait
  */
Nightmare.action('wait',
    function () {
        let args = Array.from(arguments);
        if (args.length < 1) {
            debug('Not enough arguments for .wait()');
            return;
        }

        let self = this;

        let timeout = new Promise(function (resolve, reject) {
            setTimeout(reject, self._options.waitTimeout, ".wait() timed out after " + self._options.waitTimeout);
        });

        let arg = args[0];
        if (_.isNumber(arg)) {
            debug('.wait() for ' + arg + 'ms');
            return Promise.race([delay(arg), timeout]);
        }
        else if (_.isString(arg)) {
            debug('.wait() for ' + arg + ' element');
            let fn = function (selector) {
                var element = document.querySelector(selector);
                return (element ? true : false);
            }
            return this.waitUntilTrue(fn, arg);
        }
        else if (_.isFunction(arg)) {
            debug('.wait() for fn');
            return this.waitUntilTrue.apply(args);
        }

        throw new Error("wait() Unsupported Arguments.");
    });
/**
  * Wait until evaluated function returns true or timeout
  *
  * @param {Function} fn
  * @param {...} args
  */
Nightmare.action('waitUntilTrue',
    function (fn/**, arg1, arg2...**/) {
        let args = Array.from(arguments);
        let self = this;

        let timeout = new Promise(function (resolve, reject) {
            setTimeout(reject, self._options.waitTimeout, task.name + " timed out after " + self._options.waitTimeout);
        });

        let check = function* () {
            let testResult = false;
            do {
                testResult = yield self.evaluate_now.apply(self, args);
            } while (!testResult)
        };

        return Promise.race([check, timeout]);
    });

/**
  * Waits until current web browser finishes loading all resources.
  */
Nightmare.action('waitUntilFinishLoad',
    function (ns, options, parent, win, renderer) {
        parent.on("waitUntilFinishLoad", function () {

            var start;
            var init = new Promise(function (resolve, reject) {
                start = resolve;
            });

            if (!win.webContents.isLoading()) {
                init.then(function () {
                    return new Promise(function (resolve, reject) {
                        win.webContents.once('did-start-loading', function () {
                            resolve();
                        });
                    });
                });
            }

            init.then(function () {
                return new Promise(function (resolve, reject) {

                    let resolveGoto = function (message) {
                        win.webContents.removeListener("did-fail-load", rejectGoto);
                        var url = win.webContents.getURL();
                        resolve(url);
                    };

                    let rejectGoto = function (message) {
                        win.webContents.removeListener("did-finish-load", resolveGoto);
                        parent.emit('goto', message);
                    };

                    win.webContents.once('did-fail-load', rejectGoto);
                    win.webContents.once('did-finish-load', resolveGoto);
                });
            }).then(function (url) {
                parent.emit('waitUntilFinishLoad', {
                    result: url
                });
            }, function (message) {
                parent.emit('waitUntilFinishLoad', {
                    error: message
                });
            });

            start();
        });
    },
    function () {
        debug('waitUntilFinishLoad() starting');

        return this._invokeRunnerOperation("waitUntilFinishLoad");
    });