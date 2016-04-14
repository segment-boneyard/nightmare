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
const shortid = require("shortid");

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
            // This allows any user defined 'uncaughtException' handlers
            // to run before exiting
            process.nextTick(function () {
                process.exit(1);
            });
        });

        process.on('close', function (code) {
            let help = {
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

        var runnerRequestMessageName, runnerResponseMessageName;
        if (_.isObject(operationName)) {
            runnerRequestMessageName = operationName.runnerRequestMessageName;
            runnerResponseMessageName = operationName.runnerResponseMessageName ? operationName.runnerResponseMessageName : operationName.runnerRequestMessageName;
        }
        else {
            runnerRequestMessageName = operationName;
            runnerResponseMessageName = operationName;
        }

        let child = this.child;
        let p = new Promise(function (resolve, reject) {
            debug('._invokeRunnerOperation() waiting for %s', runnerResponseMessageName);

            child.once(runnerResponseMessageName, function (result) {
                if (result && !_.isUndefined(result.err)) {
                    debug('._invokeRunnerOperation() %s failed.', runnerResponseMessageName);
                    reject(result.err);
                    return;
                }
                debug('._invokeRunnerOperation() %s succeeded.', runnerResponseMessageName);
                if (result && !_.isUndefined(result.result)) {
                    resolve(result.result);
                    return;
                }

                resolve(undefined);
            });
        });

        let args = Array.from(arguments);
        args[0] = runnerRequestMessageName;

        debug('._invokeRunnerOperation() invoking %s', runnerRequestMessageName);
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
        let chainArgs = Array.from(arguments);

        let getFunctionNames = function (obj, prefix) {
            let functionNames = [];
            let propertyNames = [];

            propertyNames = Object.getOwnPropertyNames(Object.getPrototypeOf(obj));

            //Exclude some methods from the chain.
            propertyNames = _.remove(propertyNames, function (name) {
                if (name.startsWith("_") || name == "constructor" || name == "chain")
                    return false;
                return true;
            });

            for (let propertyKey of propertyNames) {
                let tink = obj[propertyKey];
                if (_.isFunction(tink)) {
                    if (prefix)
                        functionNames.push(prefix + "." + propertyKey);
                    else
                        functionNames.push(propertyKey);
                }
                else if (_.isObject(tink)) {
                    var results = getFunctionNames(tink, propertyKey);
                    functionNames = functionNames.concat(results);
                }
                    
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

        let initializeChainablePromise = function (chainablePromise, obj) {
            let wrap = function (fnName, fn) {
                return function () {
                    let args = Array.from(arguments);

                    debug("chain() Queueing " + fnName);
                    q.push({
                        name: fnName,
                        promise: co.wrap(function () {
                            return fn.apply(self, args);
                        })
                    });
                    return chainablePromise;
                }
            };

            for (let functionName of getFunctionNames(obj)) {
                _.set(chainablePromise, functionName, wrap(functionName, _.get(obj, functionName)));
            }
        }

        if (self.state != "ready")
            self.initializeNamespaces();
        
        initializeChainablePromise(initialPromise, self);

        if (self.state != "ready") {
            debug("chain() called before init() queueing init");
            initialPromise.init();
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
            let self = this;
            return co(function* () {
                let clientRects = yield self.getClientRects(y);
                let rect = clientRects[0];

                let res = {
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

        let self = this;
        return co(function* () {
            if (selector) {
                yield self.emulateClick(selector)
                yield delay(opts.initialFocusDelay);
            }

            let keyCodes = [];
            if (_.isArray(text))
                keyCodes = text;
            else {
                for (let char of Array.from(text)) {
                    let acc = {
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
        
        let waitPromise = Promise.all([this.waitUntilFinishLoad(), fn.apply(this)]);

        let timeoutPromise = new Promise(function (resolve, reject) {
            setTimeout(reject, timeout, ".expectNavigation() timed out after " + timeout);
        });
        return Promise.race([waitPromise, timeoutPromise]);
    };

    /**
     * Returns a promise which will be resolved once the specified JavaScript has been evaluated.
     */
    evaluate_now(fn) {
        let args = Array.from(arguments).slice(1);
        let js = "(" + template.evaluate + "(" + (String(fn)) + ", " + (JSON.stringify(args)) + "))";

        var id = shortid.generate();
        var operationParams = {
            runnerRequestMessageName: "javascript",
            runnerResponseMessageName: "javascript " + id
        }
        return this._invokeRunnerOperation(operationParams, js, false, id);
    }

    /**
     * Execute a function on the page.
     *
     * @param {Function} fn
     * @param {...} args
     */
    evaluate(fn/**, arg1, arg2...**/) {
        let args = Array.from(arguments);
        if (!_.isFunction(fn)) {
            return done(new Error('.evaluate() fn should be a function'));
        }
        debug('.evaluate() fn on the page');
        return this.evaluate_now.apply(this, args);
    };

    /*
     * Evaluate an asynchronous function on the page and wait for the promise/generator/thenable/callback to complete.
     */
    evaluateAsync(fn) {
        let args = Array.from(arguments).slice(1);
        debug('.evaluateAsync() fn on the page');
        let js = "(" + template.evaluateAsync + "(" + (String(fn)) + ", " + (JSON.stringify(args)) + "))";

        let child = this.child;
        let p = new Promise(function (resolve, reject) {
            child.once('javascript', function (result) {
                if (result && !_.isUndefined(result.err)) {
                    reject(result.err);
                    return;
                }

                if (result && !_.isUndefined(result.result)) {
                    resolve(result.result);
                    return;
                }

                resolve(undefined);
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
        for (let key in this._headers) {
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
     * Save the contents of the current page as html
     */
    html(path, saveType) {
        debug('.html() starting');
        return this._invokeRunnerOperation("html", path, saveType);
    };

    /*
     * Initializes the nightmare
     */
    init() {
        debug('.init() starting');
        this.proc = proc.spawn(this._options.electronPath, [runner].concat(JSON.stringify(this._options.electronArgs)), {
            stdio: [null, null, null, 'ipc']
        });

        let self = this;

        let child = ipc(this.proc);

        let readyPromise = new Promise(function (resolve, reject) {
            child.once('ready', function (err, result) {
                if (err)
                    reject(err);
                resolve(result);
            });
        });

        let browserInitializePromise = new Promise(function (resolve, reject) {
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

        self.child = child;
        self.cookies = new Cookies(this);

        self.initializeNamespaces();

        return readyPromise
            .then(function () {
                self.child.emit('browser-initialize', self._options);
            })
            .then(browserInitializePromise)
            .then(function () {
                debug('.init() now ready.');
                self.state = "ready";
            })
            .then(function () {
                return self.initializeElectronActions();
            });
    };

    /*
     * Initializes Namespaces - binds namespace methods to the current instance. Should only need to be run if a namespace has been added after init().
     */
    initializeNamespaces() {
        debug('.initializeNamespaces() starting');
        if (_.isUndefined(Nightmare._namespaces)) {
            debug('.initializeNamespaces() no namespaces defined.');
            return;
        }

        let self = this;
        for (let ns of Nightmare._namespaces) {
            if (_.isFunction(self[ns])) {
                self[ns] = new self[ns](self);
            }
        }
    }

    /*
     * Initializes Custom Electron Actions - should only need to be run if an electron action has been added after init()
     */
    initializeElectronActions() {
        debug('.initializeElectronActions() starting');
        if (_.isUndefined(Nightmare._electronActions)) {
            debug('.initializeElectronActions() no electron actions defined.');
            return;
        }

        let promises = [];
        for (let electronActionName of _.keys(Nightmare._electronActions)) {
            debug('adding electron action for "%s"', electronActionName);

            let p = this._invokeRunnerOperation("electronAction", electronActionName, String(Nightmare._electronActions[electronActionName]));
            promises.push(p);
        }
        return Promise.all(promises);
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
            let innerJS = fs.readFileSync(file, { encoding: 'utf-8' });
            let js = "(" + template.inject + "(function(){" + innerJS + "}))";

            return this._invokeRunnerOperation("javascript", js);
        }
        else if (type === 'css') {
            let css = fs.readFileSync(file, { encoding: 'utf-8' });
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
        if (this.state !== "ready")
            throw "Nightmare is not ready. Did you forget to call init()?";

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
                let buf = new Buffer(pdf.data);
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
                let buf = new Buffer(img.data);
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
        let self = this;
        let fnPromise = co.wrap(fn);
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
    }

    /*
     * Class properties
     */

    /*
     * Define a custom action.
     */
    static action(name) {

        if (!name)
            throw "A value indicating the action name must be supplied as the first argument.";

        let args = Array.from(arguments);

        let fn, ns, electronFn, electronNs;
        if (_.isFunction(args[1]) && _.isFunction(args[2])) {
            electronFn = args[1];
            fn = args[2];
        } else if (_.isObject(args[1]) && _.isFunction(args[2])) {
            electronNs = args[1];
            fn = args[2];
        }
        else if (_.isObject(args[1]) && _.isObject(args[2])) {
            electronNs = args[1];
            ns = args[2];
        }
        else if (_.isFunction(args[1])) {
            fn = args[1];
        }
        else if (_.isObject(args[1])) {
            ns = args[1];
        }
        else {
            throw "Incorrect or unsupported arguments."
        }

        if (fn) {
            debug('action() defining an action function %s', name);
            _.set(Nightmare.prototype, name, function () {
                return fn.apply(this, Array.from(arguments));
            });
        }

        if (ns) {
            debug('action() defining an action namespace %s', name);
            if (_.isUndefined(Nightmare._namespaces))
                Nightmare._namespaces = [];

            if (Nightmare._namespaces.indexOf(name) === -1) {
                Nightmare._namespaces.push(name);
            }

            let nsObj = class {
                constructor(parent) {
                    for (let functionName of Object.getOwnPropertyNames(nsObj.prototype)) {
                        if (_.isFunction(this[functionName]) && functionName !== "constructor") {
                            this[functionName] = this[functionName].bind(parent);
                        }
                    }
                }
            };

            for (let fnName of _.keys(ns)) {
                _.set(nsObj.prototype, fnName, ns[fnName]);
            }
            
            _.set(Nightmare.prototype, name, nsObj);
        }

        if (electronFn || electronNs) {
            if (_.isUndefined(Nightmare._electronActions))
                Nightmare._electronActions = {};
        }

        if (electronFn) {
            debug('action() defining an electron action %s', name);
            Nightmare._electronActions[name] = electronFn;
        }

        if (electronNs) {
            debug('action() defining an electron action namespace %s', name);
            for (let key in electronNs) {
                Nightmare._electronActions[name + '.' + key] = electronNs[key];
            }
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
        let query = {}

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

        let cookies = [];
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

        let cookies = [];
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

Nightmare._namespaces = [];
module.exports = Nightmare;