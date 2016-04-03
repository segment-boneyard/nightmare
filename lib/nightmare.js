"use strict";

/**
 * DEBUG=nightmare*
 */

const log = require('debug')('nightmare:log');
const eventLog = require('debug')('nightmare:eventLog');
const debug = require('debug')('nightmare');

const default_electron_path = require('electron-prebuilt');
const proc = require('child_process');
const join = require('path').join;
const _ = require("lodash");
const co = require("co");
const async = require("async");
const delay = require("delay");
const fs = require('fs');

const ipc = require('./ipc');

/**
 * runner script
 */

const runner = join(__dirname, 'runner.js');

/**
 * Template
 */
const template = require('./javascript');

/**
 * Initialize `Nightmare`
 *
 * @param {Object} options
 */
class Nightmare {
    constructor(options) {
        this._options = _.defaultsDeep(options, {
            show: false,
            alwaysOnTop: true,
            waitTimeout: 30000,
            electronPath: default_electron_path,
            electronArgs: {
                dock: false
            },
            openDevTools: false,
            setAudioMuted: true,
            webPreferences: {
                preload: join(__dirname, 'preload.js'),
                nodeIntegration: false
            }
        });

        let self = this;

        process.setMaxListeners(Infinity);
        process.on('uncaughtException', function (err) {
            console.error(err.stack);
            self._endInstance();
        });

        process.on('close', function (code) {
            var help = {
                127: 'command not found - you may not have electron installed correctly',
                126: 'permission problem or command is not an executable - you may not have all the necessary dependencies for electron',
                1: 'general error - you may need xvfb',
                0: 'success!'
            };

            debug('electron child process exited with code ' + code + ': ' + help[code]);
        });

        // if the process nightmare is running in dies, make sure to kill electron
        this._endSelf = self._endInstance.bind(this, self);
        process.on('exit', this._endSelf);
        process.on('SIGINT', this._endSelf);
        process.on('SIGTERM', this._endSelf);
        process.on('SIGQUIT', this._endSelf);
        process.on('SIGHUP', this._endSelf);
        process.on('SIGBREAK', this._endSelf);

        // initial state
        this.state = 'initial';
        this._headers = {};
    }

    _noop() {
        return new Promise(function (resolve, reject) {
            resolve();
        });
    };

    _endInstance() {
        debug('_endInstance() starting.');
        if (this.proc && this.proc.connected) {
            debug('_endInstance() shutting down child process.');
            this.proc.disconnect();
            this.proc.kill();
            this.proc = null;
            this.state = "ended";
        }

        //remove events
        process.removeListener("exit", this._endSelf);
        process.removeListener("SIGINT", this._endSelf);
        process.removeListener("SIGTERM", this._endSelf);
        process.removeListener("SIGQUIT", this._endSelf);
        process.removeListener("SIGHUP", this._endSelf);
        process.removeListener("SIGBREAK", this._endSelf);
    }

    _invokeRunnerOperation(operationName) {

        if (this.state !== "ready")
            throw "Nightmare is not ready. Did you forget to call init()?";

        var child = this.child;
        var p = new Promise(function (resolve, reject) {
            debug('._invokeRunnerOperation() waiting for %s', operationName);
            child.once(operationName, function (err, result) {
                if (err) {
                    debug('._invokeRunnerOperation() %s failed.', operationName);
                    reject(err);
                    return;
                }
                debug('._invokeRunnerOperation() %s succeeded.', operationName);
                resolve(result);
            });
        });

        var args = Array.from(arguments);
        debug('._invokeRunnerOperation() invoking %s', operationName);
        child.emit.apply(this, args);
        return p;
    }

    /**
     * Go back to previous url.
     */
    back() {
        debug('.back()');
        return this._invokeRunnerOperation("goBack");
    };

    /**
     * Creates a nightmare object which can be used to chain a number of actions sequentally.
     */
    chain() {
        let self = this;

        let getFunctionNames = function (obj) {
            let functionNames = [];
            let propertyNames = [];
            if (Object.getPrototypeOf(obj) === Object.prototype)
                propertyNames = Object.getOwnPropertyNames(obj);
            else
                propertyNames = Object.getOwnPropertyNames(Object.getPrototypeOf(obj));

            //Exclude some methods from the chain.
            propertyNames = _.remove(propertyNames, function (name) {
                if (name.startsWith("_"))
                    return false;
                if (name == "constructor" || name == "chain" || name == "caller" || name == "arguments")
                    return false;
                return true;
            });

            for (let propertyKey of propertyNames) {
                var tink = obj[propertyKey];
                if (_.isFunction(tink))
                    functionNames.push(propertyKey);
            }

            return functionNames;
        };

        let lastResult = undefined;
        let q = async.queue(function (task, cb) {
            debug("Running " + task.name);

            let timeout = new Promise(function (resolve, reject) {
                setTimeout(reject, self._options.waitTimeout, task.name + " timed out after " + self._options.waitTimeout);
            });

            return Promise.race([task.promise(), timeout])
                .then(function (res) {
                    lastResult = res;
                    cb();
                })
                .catch(function (err) {
                    q.kill();
                    finalReject(err);
                    cb();
                });
        });

        let finalResolve;
        let finalReject;

        q.drain = function () {
            debug("Completed chain.");
            finalResolve(lastResult);
        }

        let initialPromise = new Promise(function (resolve, reject) {
            finalResolve = resolve;
            finalReject = reject;
        });

        let wrap = function (fnName, fn) {
            return function () {
                let args = Array.from(arguments);

                debug("Queueing " + fnName);
                q.push({
                    name: fnName,
                    promise: co.wrap(function () {
                        return fn.apply(self, args);
                    })
                });
                return initialPromise;
            }
        };

        for (var functionName of getFunctionNames(self)) {
            initialPromise[functionName] = wrap(functionName, self[functionName]);
        }

        //Also allow methods defined in namespaces to be chainable.
        if (_.isObject(Nightmare._namespaces)) {
            for (var ns of Nightmare._namespaces) {
                if (_.isObject(self[ns])) {
                    initialPromise[ns] = {};
                    
                    for (var functionName of getFunctionNames(self[ns])) {
                        initialPromise[ns][functionName] = wrap(ns + "." + functionName, self[ns][functionName]);
                    }
                }
            }
        }

        return initialPromise;
    }

    /**
     * Check a checkbox, fire change event
     *
     * @param {String} selector
     */
    check(selector) {
        debug('.check() ' + selector);
        return this.evaluate_now(function (selector) {
            var element = document.querySelector(selector);
            var event = document.createEvent('HTMLEvents');
            element.checked = true;
            event.initEvent('change', true, true);
            element.dispatchEvent(event);
        }, selector);
    };

    /**
     * Click an element using a JavaScript based event.
     *
     * @param {String} selector
     */
    click(selector) {
        debug('.click() on ' + selector);
        return this.evaluate_now(function (selector) {
            document.activeElement.blur();
            var element = document.querySelector(selector);
            var event = document.createEvent('MouseEvent');
            event.initEvent('click', true, true);
            element.dispatchEvent(event);
        }, selector);
    };

    /**
     * Click an element and wait until the next load operation completes.
     * Use this function when you expect a click to perform a navigation action, usually on anchor elements, but elsewhere too.
     *
     * @param {String} selector
     */
    clickAndWaitUntilFinishLoad(selector) {
        debug('.clickAndWaitUntilFinishLoad() on ' + selector);

        var child = this.child;
        var waitUntilFinishLoadPromise = this._invokeRunnerOperation("waitUntilFinishLoad");

        var clickPromise = this.evaluate_now(function (selector) {
            document.activeElement.blur();
            var element = document.querySelector(selector);
            var event = document.createEvent('MouseEvent');
            event.initEvent('click', true, true);
            element.dispatchEvent(event);
        }, selector);

        return Promise.all([clickPromise, waitUntilFinishLoadPromise]);
    };

    /**
     * Click an element using electron's sendInputEvent command.
     *
     * @param {String} selector
     */
    emulateClick(y, x) {
        debug('.emulateClick() on ' + y);

        //click the selector at y
        if (_.isString(y) && !x) {
            var self = this;
            return co(function* () {
                var clientRects = yield self.getClientRects(y);
                var rect = clientRects[0];

                var res = {
                    x: Math.floor(rect.left + (rect.width / 2)),
                    y: Math.floor(rect.top + (rect.height / 2))
                };
                debug('.emulateClick() found element at ' + res.x + ", " + res.y);
                return self._invokeRunnerOperation("emulateClick", res);
            });
        }
        //just pass the full object
        else if (_.isObject(y) && !x) {
            return this._invokeRunnerOperation("emulateClick", y);
        }
        //click x, y.
        else {
            return this._invokeRunnerOperation("emulateClick", { x: x, y: y });
        }
    }

    /**
     * Click an element using electron's sendInputEvent command.
     *
     * @param {String} selector
     */
    emulateKeystrokes(selector, text, opts) {
        if (!text) {
            text = selector;
            selector = null;
        }

        opts = _.defaults(opts, {
            initialFocusDelay: 750,
            finalKeystrokeDelay: 500
        });

        debug('.emulateKeystrokes() on ' + selector);

        var self = this;
        return co(function* () {
            if (selector) {
                yield self.emulateClick(selector)
                yield delay(opts.initialFocusDelay);
            }

            var keyCodes = [];
            if (_.isArray(text))
                keyCodes = text;
            else {
                for (var char of Array.from(text)) {
                    var acc = {
                        keyCode: char,
                        modifiers: [],
                        isChar: true
                    };

                    if (char == char.toUpperCase())
                        acc.modifiers.push("Shift");

                    keyCodes.push(acc);
                }
            }

            return self._invokeRunnerOperation("emulateKeystrokes", { keyCodes: keyCodes, finalKeystrokeDelay: opts.finalKeystrokeDelay });
        });
    }

    /**
     * end
     */
    end() {
        this._endInstance();
    };

    /**
     * Returns a promise which invokes the specified action which expects to perform a navigation action.
     */
    expectNavigation(fn, timeout) {
        if (!timeout)
            timeout = this._options.waitTimeout;
        
        var waitPromise = Promise.all([this.waitUntilFinishLoad(), fn.apply(this)]);

        var timeoutPromise = new Promise(function (resolve, reject) {
            setTimeout(reject, timeout, ".expectNavigation() timed out after " + timeout);
        });
        return Promise.race([waitPromise, timeoutPromise]);
    };

    /**
     * Returns a promise which will be resolved once the specified JavaScript has been evaluated.
     */
    evaluate_now(fn) {
        var args = Array.from(arguments).slice(1);
        var js = "(" + template.evaluate + "(" + (String(fn)) + ", " + (JSON.stringify(args)) + "))";

        return this._invokeRunnerOperation('javascript', js);
    }

    /**
     * Execute a function on the page.
     *
     * @param {Function} fn
     * @param {...} args
     */
    evaluate(fn/**, arg1, arg2...**/) {
        var args = Array.from(arguments);
        debug('.evaluate() fn on the page');
        return this.evaluate_now.apply(this, args);
    };

    evaluateAsync(fn) {
        var args = Array.from(arguments).slice(1);
        debug('.evaluateAsync() fn on the page');
        var js = "(" + template.evaluateAsync + "(" + (String(fn)) + ", " + (JSON.stringify(args)) + "))";

        var child = this.child;
        var p = new Promise(function (resolve, reject) {
            child.once('javascript', function (err, result) {
                if (err) {
                    reject(err);
                    return;
                }
                resolve(result);
            });
        });
        this.child.emit('javascript', js, true);
        return p;
    }

    /**
     * Determine if a selector exists on a page.
     *
     * @param {String} selector
     */
    exists(selector) {
        debug('.exists() for ' + selector);
        return this.evaluate_now(function (selector) {
            return (!!document.querySelector(selector));
        }, selector);
    };

    /**
     * Go forward to previous url.
     */
    forward() {
        debug('.goForward()');

        return this._invokeRunnerOperation("goForward");
    };

    /**
     * Instructs the browser to go to a specific url and wait until loading completes.
     * If the browser is currently at the specified URL, no action is taken.
     */
    goto(url, headers) {
        debug('goto() starting navigation to %s', url);

        headers = headers || {};
        for (var key in this._headers) {
            headers[key] = headers[key] || this._headers[key];
        }

        return this._invokeRunnerOperation("goto", url, headers);
    };

    getClientRects(selector) {

        return this.evaluate_now(function (selector) {
            'use strict';
            var element = document.querySelector(selector);

            if (!element)
                throw "An element could not be located with the specified selector: " + selector;

            var clientRects = element.getClientRects();

            if (!clientRects)
                throw "Client rects could not be retrieved."

            var result = [];

            for (var rect of Array.from(clientRects)) {
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
    }

    /**
     * Override headers for all HTTP requests
     */
    header(header, value) {
        if (header && !_.isUndefined(value)) {
            this._headers[header] = value;
        } else if (_.isObject(header)) {
            this._headers = header;
        }

        return this._noop();
    };

    /*
     * Initializes the nightmare
     */
    init() {
        this.proc = proc.spawn(this._options.electronPath, [runner].concat(JSON.stringify(this._options.electronArgs)), {
            stdio: [null, null, null, 'ipc']
        });

        let self = this;

        var child = ipc(this.proc);

        var readyPromise = new Promise(function (resolve, reject) {
            child.once('ready', function (err, result) {
                if (err)
                    reject(err);
                resolve(result);
            });
        });

        var browserInitializePromise = new Promise(function (resolve, reject) {
            child.once('browser-initialize', function (err, result) {
                if (err)
                    reject(err);
                resolve(result);
            });
        });

        // propagate console.log(...) through
        child.on('log', function () {
            log.apply(log, arguments);
        });

        child.on('uncaughtException', function (stack) {
            console.error('Nightmare runner error:\n\n%s\n', '\t' + stack.replace(/\n/g, '\n\t'));
            self._endInstance(self);
            process.exit(1);
        });

        child.on('page', function (type) {
            log.apply(null, ['page-' + type].concat(Array.from(arguments).slice(1)));
        });

        // proporate events through to debugging
        child.on('did-finish-load', function () { eventLog('did-finish-load', JSON.stringify(Array.from(arguments))); });
        child.on('did-fail-load', function () { eventLog('did-fail-load', JSON.stringify(Array.from(arguments))); });
        child.on('did-frame-finish-load', function () { eventLog('did-frame-finish-load', JSON.stringify(Array.from(arguments))); });
        child.on('did-start-loading', function () { eventLog('did-start-loading', JSON.stringify(Array.from(arguments))); });
        child.on('did-stop-loading', function () { eventLog('did-stop-loading', JSON.stringify(Array.from(arguments))); });
        child.on('did-get-response-details', function () { eventLog('did-get-response-details', JSON.stringify(Array.from(arguments))); });
        child.on('did-get-redirect-request', function () { eventLog('did-get-redirect-request', JSON.stringify(Array.from(arguments))); });
        child.on('dom-ready', function () { eventLog('dom-ready', JSON.stringify(Array.from(arguments))); });
        child.on('page-favicon-updated', function () { eventLog('page-favicon-updated', JSON.stringify(Array.from(arguments))); });
        child.on('new-window', function () { eventLog('new-window', JSON.stringify(Array.from(arguments))); });
        child.on('will-navigate', function () { eventLog('will-navigate', JSON.stringify(Array.from(arguments))); });
        child.on('login', function () { eventLog('login', JSON.stringify(Array.from(arguments))); });
        child.on('media-started-playing', function () { eventLog('media-started-playing', JSON.stringify(Array.prototype.slice.call(arguments))); });
        child.on('media-paused', function () { eventLog('media-paused', JSON.stringify(Array.prototype.slice.call(arguments))); });
        child.on('crashed', function () { eventLog('crashed', JSON.stringify(Array.from(arguments))); });
        child.on('plugin-crashed', function () { eventLog('plugin-crashed', JSON.stringify(Array.from(arguments))); });
        child.on('destroyed', function () { eventLog('destroyed', JSON.stringify(Array.from(arguments))); });

        this.child = child;
        this.cookies = new Cookies(this);

        this.initializeNamespaces();

        return readyPromise
            .then(function () {
                self.child.emit('browser-initialize', self._options);
            })
            .then(browserInitializePromise)
            .then(function () {
                self.state = "ready";
            });
    };

    /*
     * Initializes Namespaces - should only need to be run if a namespace has been added after init()
     */
    initializeNamespaces() {
        if (_.isUndefined(Nightmare._namespaces))
            return;

        var self = this;
        for (var ns of Nightmare._namespaces) {
            if (_.isFunction(self[ns]))
                self[ns] = self[ns]();
        }
    }

    /**
     * Inject a JavaScript or CSS file onto the page
     *
     * @param {String} type
     * @param {String} file
     */
    inject(type, file) {
        debug('.inject()-ing a file');
        if (type === 'js') {
            var innerJS = fs.readFileSync(file, { encoding: 'utf-8' });
            var js = "(" + template.inject + "(function(){" + innerJS + "}))";

            return this._invokeRunnerOperation("javascript", js);
        }
        else if (type === 'css') {
            var css = fs.readFileSync(file, { encoding: 'utf-8' });
            return this._invokeRunnerOperation("css", css);
        }
        else {
            debug('unsupported file type in .inject()');
            throw new Error("unsupported file type in .inject(): " + type);
        }
    };

    /**
     * Insert text
     *
     * @param {String} selector
     * @param {String} text
     */
    insert(selector, text) {
        debug('.insert() %s into %s', text, selector);

        var self = this;
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
    }


    /**
     * Mousedown on an element.
     *
     * @param {String} selector
     */
    mousedown(selector) {
        debug('.mousedown() on ' + selector);
        return this.evaluate_now(function (selector) {
            var element = document.querySelector(selector);
            var event = document.createEvent('MouseEvent');
            event.initEvent('mousedown', true, true);
            element.dispatchEvent(event);
        }, selector);
    };


    /**
     * Hover over an element.
     *
     * @param {String} selector
     * @param {Function} done
     */
    mouseover(selector) {
        debug('.mouseover() on ' + selector);
        return this.evaluate_now(function (selector) {
            var element = document.querySelector(selector);
            var event = document.createEvent('MouseEvent');
            event.initMouseEvent('mouseover', true, true);
            element.dispatchEvent(event);
        }, selector);
    };

    /**
     * on
     */
    on(event, handler) {
        this.child.on(event, handler);
        return this._noop();
    };

    /**
     * Take a pdf.
     *
     * @param {String} path
     * @param {Object} options
     */
    pdf(path, options) {
        debug('.pdf()');
        if (!options && _.isObject(path)) {
            options = path;
            path = undefined;
        }

        return this._invokeRunnerOperation("pdf", path, options)
            .then(function (pdf) {
                var buf = new Buffer(pdf.data);
                debug('.pdf() captured with length %s', buf.length);
                if (!path)
                    return buf;

                return fs.writeFileSync(path, buf);
            });
    };

    /**
     * ready
     */
    ready(fn) {
        if (this.state == 'ready')
            return fn();

        this.child.once('ready', fn);
        return this;
    }

    /**
     * Refresh the current page.
     */
    refresh() {
        debug('.refresh()');
        return this.evaluate_now(function () {
            window.location.reload();
        });
    };

    /**
     * instructs the browser to reload the page.
     */
    reload() {
        debug('.reload()');
        return this._invokeRunnerOperation("reload");
    }

    /**
     * Take a screenshot.
     *
     * @param {String} path
     * @param {Object} clip
     */
    screenshot(path, clip) {
        debug('.screenshot()');

        if (!clip && _.isObject(path)) {
            clip = path;
            path = undefined;
        }

        return this._invokeRunnerOperation("screenshot", clip)
            .then(function (img) {
                var buf = new Buffer(img.data);
                debug('.screenshot() captured with length %s', buf.length);
                if (!path)
                    return buf;

                return fs.writeFileSync(path, buf);
            });
    };

    /**
     * Set the scroll position.
     *
     * @param {Number} x
     * @param {Number} y
     */
    scrollTo(y, x) {
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
    };

    /**
     * Choose an option from a select dropdown
     *
     * @param {String} selector
     * @param {String} option value
     */
    select(selector, option) {
        debug('.select() ' + selector);
        return this.evaluate_now(function (selector, option) {
            var element = document.querySelector(selector);
            var event = document.createEvent('HTMLEvents');
            element.value = option;
            event.initEvent('change', true, true);
            element.dispatchEvent(event);
        }, selector, option);
    };

    /**
     * Set the state of audio in the browser process.
     *
     * @param {bool} value that indicates if audio should be muted.
     */

    setAudioMuted(isMuted) {
        debug('.setAudioMuted() to ' + isMuted);

        return this._invokeRunnerOperation("audio", isMuted);
    };

    /**
     * If prompted for login, supplies the specified credentials.
     */
    setAuthenticationCredentials(username, password) {
        debug(".authentication()");

        return this._invokeRunnerOperation("setAuthenticationCredentials", username, password);
    };

    /**
     * instructs the browser to stop page loading.
     */
    stop() {
        debug('.stop()');

        return this._invokeRunnerOperation("stop");
    }

    /**
     * Get the title of the page.
     */
    title() {
        debug('.title() getting it');

        return this._invokeRunnerOperation("title");
    };

    /**
     * Type into an element.
     *
     * @param {String} selector
     * @param {String} text
     */
    type() {
        var selector = arguments[0], text;
        if (arguments.length == 2) {
            text = arguments[1];
        }

        debug('.type() %s into %s', text, selector);
        var child = this.child;
        var self = this;
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
    };

    /*
     * Uncheck a checkbox, fire change event
     *
     * @param {String} selector
     */
    uncheck(selector) {
        debug('.uncheck() ' + selector);
        return this.evaluate_now(function (selector) {
            var element = document.querySelector(selector);
            var event = document.createEvent('HTMLEvents');
            element.checked = null;
            event.initEvent('change', true, true);
            element.dispatchEvent(event);
        }, selector);
    };

    /**
     * Get the url of the page.
     */
    url() {
        debug('.url() getting it');

        return this._invokeRunnerOperation("url");
    };

    /**
     * Provides an easy way to call fn.apply(nightmare)
     * @param {Function} 
     */
    use(fn) {
        var self = this;
        var fnPromise = co.wrap(fn);
        return fnPromise.apply(this);
    };

    /**
     * Set the useragent.
     *
     * @param {String} useragent
     */
    useragent(useragent) {
        debug('.useragent() to ' + useragent);

        return this._invokeRunnerOperation("useragent", useragent);
    };

    /**
     * Set the viewport.
     *
     * @param {Number} width
     * @param {Number} height
     */
    viewport(width, height) {
        debug('.viewport()');

        return this._invokeRunnerOperation("size", width, height);
    };

    /**
     * Determine if a selector is visible on a page.
     *
     * @param {String} selector
     */
    visible(selector) {
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
    wait() {
        var args = Array.from(arguments);
        if (args.length < 1) {
            debug('Not enough arguments for .wait()');
            return;
        }

        var self = this;

        let timeout = new Promise(function (resolve, reject) {
            setTimeout(reject, self._options.waitTimeout, ".wait() timed out after " + self._options.waitTimeout);
        });

        var arg = args[0];
        if (_.isNumber(arg)) {
            debug('.wait() for ' + arg + 'ms');
            return Promise.race([delay(arg), timeout]);
        }
        else if (_.isString(arg)) {
            debug('.wait() for ' + arg + ' element');
            var fn = function (selector) {
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
    };

    /**
     * Returns a promise that resolves when the current web browser finishes loading all resources.
     */
    waitUntilFinishLoad() {
        debug('waitUntilFinishLoad() starting');

        return this._invokeRunnerOperation("waitUntilFinishLoad");
    };

    /**
     * Wait until evaluated function returns true or timeout
     *
     * @param {Function} fn
     * @param {...} args
     */
    waitUntilTrue(fn/**, arg1, arg2...**/) {
        var args = Array.from(arguments);
        var self = this;

        let timeout = new Promise(function (resolve, reject) {
            setTimeout(reject, self._options.waitTimeout, task.name + " timed out after " + self._options.waitTimeout);
        });

        let check = function* () {
            var testResult = false;
            do {
                testResult = yield self.evaluate_now.apply(self, args);
            } while (!testResult)
        };

        return Promise.race([check, timeout]);
    }

    /*
     * Class properties
     */

    /*
     * Define a custom action.
     */
    static action(name, fn) {

        if (name && _.isFunction(fn)) {
            _.set(Nightmare.prototype, name, function () {
                return fn.bind(this);
            });
        }
        else if (name && _.isObject(fn)) {

            if (_.isUndefined(Nightmare._namespaces))
                Nightmare._namespaces = [];

            if (Nightmare._namespaces.indexOf(name) === -1) {
                Nightmare._namespaces.push(name);
            }

            _.set(Nightmare.prototype, name, function () {
                var self = this;

                var obj = {};
                for (var fnName of _.keys(fn)) {
                    _.set(obj, fnName, fn[fnName].bind(self))
                }

                return obj;
            });
        }

    }
}

class Cookies {

    constructor(nightmare) {
        this._nightmare = nightmare;
        this.child = this._nightmare.child;
    }

    /**
    * Get a cookie
    */
    get(name) {
        debug('cookies.get()')
        var query = {}

        if (_.isObject(name))
            query = name;
        else
            query.name = name;

        return this._nightmare._invokeRunnerOperation("cookie.get", query);
    };

    /**
     * Set a cookie
     */
    set(name, value) {
        debug('cookies.set()')

        var cookies = [];
        if (_.isArray(name))
            cookies = name;
        else if (_.isObject(name))
            cookies.push(name);
        else cookies.push({
            name: name,
            value: value
        });

        if (cookies.length === 0)
            return this._nightmare._noop();

        return this._nightmare._invokeRunnerOperation("cookie.set", cookies);
    };

    /**
     * Clear a cookie
     */
    clear(name, url) {
        debug('cookies.clear()');

        var cookies = [];
        if (_.isArray(name))
            cookies = name;
        else if (_.isObject(name))
            cookies.push(name);
        else cookies.push({
            name: name,
            url: url
        });

        if (cookies.length == 0)
            return this._nightmare._noop();

        return this._nightmare._invokeRunnerOperation("cookie.clear", cookies);
    };
}

module.exports = Nightmare;