"use strict";

const debug = require("debug")("nightmare:core");
const Nightmare = require("../lib/nightmare");
const _ = require("lodash");
const fs = require("fs");
const delay = require("delay");
const co = require("co");

/**
 * Contains the core set of actions
 */

/**
  * Evaluate a function on the page.
  *
  * @param {Function} fn
  * @param {...} args
  */
Nightmare.prototype.evaluate = function (fn/**, arg1, arg2...**/) {
    let args = Array.from(arguments);
    if (!_.isFunction(fn)) {
        return done(new Error('.evaluate() fn should be a function'));
    }
    debug('.evaluate() fn on the page');
    return this.evaluate_now.apply(this, args);
};

/**
  * Evaluates an asynchronous function on the page.
  *
  * @param {Function} fn
  * @param {...} args
  */
Nightmare.prototype.evaluateAsync = function (fn/**, arg1, arg2...**/) {
    let args = Array.from(arguments);
    if (!_.isFunction(fn)) {
        return done(new Error('.evaluateAsync() fn should be a function'));
    }
    debug('.evaluateAsync() fn on the page');
    return this.evaluate_async.apply(this, args);
};

/**
 * Determine if a selector exists on a page.
 *
 * @param {String} selector
 */
Nightmare.prototype.exists = function (selector) {
    debug('.exists() for ' + selector);
    return this.evaluate_now(function (selector) {
        return (!!document.querySelector(selector));
    }, selector);
};

/**
  * Get the client rects of the specified selector
  */
Nightmare.prototype.getClientRects = function (selector) {

    return this.evaluate_now(function (selector) {
        'use strict';
        var element = document.querySelector(selector);

        if (!element)
            throw "An element could not be located with the specified selector: " + selector;

        var clientRects = element.getClientRects();

        if (!clientRects)
            throw "Client rects could not be retrieved.";

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
};

/*
 * Save the contents of the current page as html
 */
Nightmare.prototype.html = [
    function (ns, options, parent, win, renderer) {
        parent.respondTo('html', function (path, saveType, done) {
            // https://github.com/atom/electron/blob/master/docs/api/web-contents.md#webcontentssavepagefullpath-savetype-callback
            saveType = saveType || 'HTMLComplete';
            win.webContents.savePage(path, saveType, function (err) {
                if (err) return done.reject(err);
                done.resolve();
            });
        });
    },
    function (path, saveType) {
        debug('.html() starting');
        return this._invokeRunnerOperation("html", path, saveType);
    }
];

/**
 * Take a pdf.
 *
 * @param {String} path
 * @param {Object} options
 */
Nightmare.prototype.pdf = [
    function (ns, options, parent, win, renderer) {
        const _ = require("lodash");
        parent.respondTo('pdf', function (path, options, done) {
            // https://github.com/fraserxu/electron-pdf/blob/master/index.js#L98
            options = _.defaults(options, {
                marginType: 0,
                printBackground: true,
                printSelectionOnly: false,
                landscape: false
            });

            win.webContents.printToPDF(options, function (err, data) {
                if (err) return done.reject(err);
                done.resolve(data);
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
    }];

/**
  * Take a screenshot.
  *
  * @param {String} path
  * @param {Object} clip
  */
Nightmare.prototype.screenshot = [
    function (ns, options, parent, win, renderer, frameManager) {
        parent.respondTo('screenshot', function (clip, done) {
            // https://gist.github.com/twolfson/0d374d9d7f26eefe7d38
            var args = [function handleCapture(img) {
                done.resolve(img.toPng());
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
    }];

/**
  * Set the state of audio in the browser process.
  *
  * @param {bool} value that indicates if audio should be muted.
  */
Nightmare.prototype.setAudioMuted = [
    function (ns, options, parent, win, renderer) {
        parent.respondTo('audio', function (audio, done) {
            win.webContents.setAudioMuted(audio);
            done.resolve(win.webContents.isAudioMuted());
        });
    },
    function (isMuted) {
        debug('.setAudioMuted() to ' + isMuted);

        return this._invokeRunnerOperation("audio", isMuted);
    }];
/**
  * If prompted for login, supplies the specified credentials.
  */
Nightmare.prototype.setAuthenticationCredentials = [
    function (ns, options, parent, win, renderer) {
        parent.respondTo('setAuthenticationCredentials', function (username, password, done) {
            win.webContents.on('login', function (webContents, request, authInfo, callback) {
                callback(username, password);
            });
            done.resolve();
        });
    },
    function (username, password) {
        debug(".authentication()");

        return this._invokeRunnerOperation("setAuthenticationCredentials", username, password);
    }];

/**
  * Get the title of the page.
  */
Nightmare.prototype.title = [
    function (ns, options, parent, win, renderer) {
        parent.respondTo('title', function (done) {
            done.resolve(win.webContents.getTitle());
        });
    },
    function () {
        debug('.title() getting it');

        return this._invokeRunnerOperation("title");
    }];

/**
 * Get the url of the page.
 */
Nightmare.prototype.url = [
    function (ns, options, parent, win, renderer) {
        parent.respondTo('url', function (done) {
            done.resolve(win.webContents.getURL());
        });
    },
    function () {
        debug('.url() getting it');

        return this._invokeRunnerOperation("url");
    }];

/**
  * Set the useragent.
  *
  * @param {String} useragent
  */
Nightmare.prototype.useragent = [
    function (ns, options, parent, win, renderer) {
        parent.respondTo('useragent', function (useragent, done) {
            win.webContents.setUserAgent(useragent);
            done.resolve();
        });
    },
    function (useragent) {
        debug('.useragent() to ' + useragent);

        return this._invokeRunnerOperation("useragent", useragent);
    }];

/**
  * Set the viewport.
  *
  * @param {Number} width
  * @param {Number} height
  */
Nightmare.prototype.viewport = [
    function (ns, options, parent, win, renderer) {
        parent.respondTo('size', function (width, height, done) {
            win.setSize(width, height);
            done.resolve();
        });
    },
    function (width, height) {
        debug('.viewport()');

        return this._invokeRunnerOperation("size", width, height);
    }];

/**
  * Determine if a selector is visible on a page.
  *
  * @param {String} selector
  */
Nightmare.prototype.visible = function (selector) {
    debug('.visible() for ' + selector);
    return this.evaluate_now(function (selector) {
        var elem = document.querySelector(selector);
        if (elem)
            return (elem.offsetWidth > 0 && elem.offsetHeight > 0);
        else
            return false;
    }, selector);
};

/**
  * Wait
  */
Nightmare.prototype.wait = function () {
    let args = Array.from(arguments);
    if (args.length < 1) {
        debug('Not enough arguments for .wait()');
        return;
    }

    let self = this;

    let timeout = new Promise(function (resolve, reject) {
        setTimeout(reject, self._options.waitTimeout, ".wait() timed out after " + self._options.waitTimeout).unref();
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
        };
        return this.waitUntilTrue(fn, arg);
    }
    else if (_.isFunction(arg)) {
        debug('.wait() for fn');
        return this.waitUntilTrue.apply(this, args);
    }

    throw new Error("wait() Unsupported Arguments.");
};

/**
  * Wait until evaluated function returns true or timeout
  *
  * @param {Function} fn
  * @param {...} args
  */
Nightmare.prototype.waitUntilTrue = function (fn/**, arg1, arg2...**/) {
    let args = Array.from(arguments);
    let self = this;

    let timeout = new Promise(function (resolve, reject) {
        setTimeout(reject, self._options.waitTimeout, ".waitUntilTrue() timed out after " + self._options.waitTimeout).unref();
    });

    let check = co(function* () {
        let testResult = false;
        do {
            testResult = yield self.evaluate_now.apply(self, args);
        } while (!testResult);
    });

    return Promise.race([check, timeout]);
};

/**
  * Waits until current web browser finishes loading all resources.
  */
Nightmare.prototype.waitUntilFinishLoad = [
    function (ns, options, parent, win, renderer) {
        parent.respondTo("waitUntilFinishLoad", function (done) {

            var start;
            var init = new Promise(function (resolve, reject) {
                start = resolve;
            });

            if (!win.webContents.isLoadingMainFrame()) {
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
                done.resolve(url);
            }, function (message) {
                done.reject(message);
            });

            start();
        });
    },
    function () {
        debug('waitUntilFinishLoad() starting');

        return this._invokeRunnerOperation("waitUntilFinishLoad");
    }];