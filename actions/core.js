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