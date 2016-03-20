"use strict";

/**
 * DEBUG=nightmare*
 */

const log = require('debug')('nightmare:log');
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
            waitTimeout: 30000,
            electronPath: default_electron_path,
            electronArgs: {
                dock: false
            }
        });

        let self = this;
        this._noop = function () {
            return new Promise(function (resolve, reject) {
                resolve();
            });
        };

        process.setMaxListeners(Infinity);
        process.on('uncaughtException', function (err) {
            console.error(err.stack);
            self._endInstance();
        });

        // if the process nightmare is running in dies, make sure to kill electron
        var endSelf = self._endInstance.bind(this, self);
        process.on('exit', endSelf);
        process.on('SIGINT', endSelf);
        process.on('SIGTERM', endSelf);
        process.on('SIGQUIT', endSelf);
        process.on('SIGHUP', endSelf);
        process.on('SIGBREAK', endSelf);

        // initial state
        this.state = 'initial';
        this._headers = {};
    }

    _endInstance() {
        if (this.proc && this.proc.connected) {
            this.proc.disconnect();
            this.proc.kill();
            this.state = "ended";
        }
    }

    /**
     * Go back to previous url.
     */
    *back() {
        debug('.back()');

        if (this.state !== "ready")
            throw "Nightmare is not ready. Did you forget to call init()?";

        var child = this.child;

        var p = new Promise(function (resolve, reject) {
            console.log("waiting for goback.");
            child.once('goBack', function (err, result) {
                if (err)
                    reject(err)
                debug('goBack() completed navigation to %s', result);
                resolve(result);
            });
        });

        child.emit('goBack');
        return p;
    };

    /**
     * Creates a nightmare object which can be used to chain a number of actions sequentally.
     */
    chain() {
        let self = this;

        let properties = [];
        for (let propertyKey of Object.getOwnPropertyNames(Object.getPrototypeOf(this))) {
            var tink = this[propertyKey];
            if (_.isFunction(tink))
                properties.push(propertyKey);
        }

        //Exclude some methods from the chain.
        properties = _.without(properties, "constructor", "chain");
        properties = _.remove(properties, function (name) {
            if (name.startsWith("_"))
                return false;
            return true;
        });

        let lastResult = undefined;
        let q = async.queue(function (task, cb) {
            debug("Running " + task.name);

            let timeout = new Promise(function (resolve, reject) {
                setTimeout(reject, self._options.waitTimeout, task.name + " timed out after " + self._options.waitTimeout);
            });

            Promise.race([task.promise(), timeout])
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
            finalResolve(lastResult);
        }

        let initialPromise = new Promise(function (resolve, reject) {
            finalResolve = resolve;
            finalReject = reject;
        });

        let wrap = function (fnName, fn) {
            return function () {
                let args = arguments;

                let promise;
                //if (fn.constructor.name === 'GeneratorFunction') {
                promise = co.wrap(function* () {
                        var res = yield fn.apply(self, args);
                        return res;
                    });
                //}

                debug("Queueing " + fnName);
                q.push({
                    name: fnName,
                    promise: promise
                });
                return initialPromise;
            }
        };

        properties.forEach(function (methodName) {
            initialPromise[methodName] = wrap(methodName, self[methodName]);
        });
        return initialPromise;
    }

    /**
     * Check a checkbox, fire change event
     *
     * @param {String} selector
     */
    *check(selector) {
        debug('.check() ' + selector);
        yield this.evaluate_now(function (selector) {
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
    *click(selector) {
        debug('.click() on ' + selector);
        yield this.evaluate_now(function (selector) {
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
    *clickAndWaitUntilFinishLoad(selector) {
        debug('.clickAndWaitUntilFinishLoad() on ' + selector);

        var child = this.child;
        var p = new Promise(function (resolve, reject) {
            console.log("waiting for finish load");
            child.once('did-fail-load', function () {
                reject();
            });
            child.once('did-stop-loading', function () {
                console.log("stopped loading.");
                resolve();
            });
            child.once('did-finish-load', function () {
                resolve();
            });
        });
        
        yield this.evaluate_now(function (selector) {
            document.activeElement.blur();
            var element = document.querySelector(selector);
            var event = document.createEvent('MouseEvent');
            event.initEvent('click', true, true);
            element.dispatchEvent(event);
        }, selector);

        return p;
    };

    /**
     * Click an element using electron's sendInputEvent command.
     *
     * @param {String} selector
     */
    *emulateClick(selector) {
        debug('.emulateClick() on ' + selector);

        var child = this.child;
        var p = new Promise(function (resolve, reject) {
            child.once('emulateClick', function (err, result) {
                debug('emulateClick() clicked at', result.x, result.y);
                if (err)
                    reject(err)
                resolve(result);
            });
        });

        child.emit('emulateClick', { selector: selector });
        return p;
    }

    /**
     * end
     */
    *end() {
        this._endInstance();
    };

    /**
     * Returns a promise which will be resolved once the specified JavaScript has been evaluated.
     */
    evaluate_now(js_fn) {
        var child = this.child;

        var p = new Promise(function (resolve, reject) {
            child.once('javascript', function (err, result) {
                if (err)
                    reject(err)
                resolve(result);
            });
        });

        var args = Array.from(arguments).slice(1);
        var argsList = JSON.stringify(args).slice(1, -1);

        child.emit('javascript', template.execute({ src: String(js_fn), args: argsList }));
        return p;
    }

    /**
     * Execute a function on the page.
     *
     * @param {Function} fn
     * @param {...} args
     */
    *evaluate(fn/**, arg1, arg2...**/) {
        var args = Array.from(arguments);
        debug('.evaluate() fn on the page');
        var result = yield this.evaluate_now.apply(this, args);
        return result;
    };

    /**
     * Determine if a selector exists on a page.
     *
     * @param {String} selector
     */
    *exists(selector) {
        debug('.exists() for ' + selector);
        return yield this.evaluate_now(function (selector) {
            return (!!document.querySelector(selector));
        }, selector);
    };

    /**
     * Go forward to previous url.
     */
    *forward() {
        debug('.goForward()');

        if (this.state !== "ready")
            throw "Nightmare is not ready. Did you forget to call init()?";

        var child = this.child;

        var p = new Promise(function (resolve, reject) {
            child.once('goForward', function (err, result) {
                debug('goForward() completed navigation to %s', result);
                if (err)
                    reject(err)
                resolve(result);
            });
        });

        child.emit('goForward');
        return p;
    };

    /**
     * Instructs the browser to go to a specific url and wait until loading completes.
     * If the browser is currently at the specified URL, no action is taken.
     */
    goto(url, headers) {
        debug('goto() starting navigation to %s', url);

        if (this.state !== "ready")
            throw "Nightmare is not ready. Did you forget to call init()?";

        var child = this.child;

        headers = headers || {};
        for (var key in this._headers) {
            headers[key] = headers[key] || this._headers[key];
        }

        var p = new Promise(function (resolve, reject) {
            console.log("waiting for goto.");
            child.once('goto', function (err, result) {
                debug('goto() completed navigation to %s', url);
                if (err)
                    reject(err)
                resolve(result);
            });
        });

        child.emit('goto', url, headers);
        return p;
    };

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
        child.on('did-finish-load', function () { log('did-finish-load', JSON.stringify(Array.from(arguments))); });
        child.on('did-fail-load', function () { log('did-fail-load', JSON.stringify(Array.from(arguments))); });
        child.on('did-frame-finish-load', function () { log('did-frame-finish-load', JSON.stringify(Array.from(arguments))); });
        child.on('did-start-loading', function () { log('did-start-loading', JSON.stringify(Array.from(arguments))); });
        child.on('did-stop-loading', function () { log('did-stop-loading', JSON.stringify(Array.from(arguments))); });
        child.on('did-get-response-details', function () { log('did-get-response-details', JSON.stringify(Array.from(arguments))); });
        child.on('did-get-redirect-request', function () { log('did-get-redirect-request', JSON.stringify(Array.from(arguments))); });
        child.on('dom-ready', function () { log('dom-ready', JSON.stringify(Array.from(arguments))); });
        child.on('page-favicon-updated', function () { log('page-favicon-updated', JSON.stringify(Array.from(arguments))); });
        child.on('new-window', function () { log('new-window', JSON.stringify(Array.from(arguments))); });
        child.on('will-navigate', function () { log('will-navigate', JSON.stringify(Array.from(arguments))); });
        child.on('crashed', function () { log('crashed', JSON.stringify(Array.from(arguments))); });
        child.on('plugin-crashed', function () { log('plugin-crashed', JSON.stringify(Array.from(arguments))); });
        child.on('destroyed', function () { log('destroyed', JSON.stringify(Array.from(arguments))); });
        
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
    *inject(type, file) {

        var self = this;
        var child = this.child;

        debug('.inject()-ing a file');
        if (type === 'js') {
            var js = fs.readFileSync(file, { encoding: 'utf-8' });
            var jsInjectPromise = new Promise(function (resolve, reject) {
                child.once('javascript', function (err, result) {
                    if (err)
                        reject(err)
                    resolve(result);
                });
            });
            child.emit('javascript', template.inject({ src: js }));
            return jsInjectPromise;
        }
        else if (type === 'css') {
            var css = fs.readFileSync(file, { encoding: 'utf-8' });
            this.child.emit('css', css);
        }
        else {
            debug('unsupported file type in .inject()');
        }
    };

    /**
     * Insert text
     *
     * @param {String} selector
     * @param {String} text
     */
    *insert(selector, text) {
        debug('.insert() %s into %s', text, selector)

        var child = this.child;

        if (!text) {
            yield this.evaluate_now(function (selector) {
                document.querySelector(selector).focus();
                document.querySelector(selector).value = '';
            }, selector);
        } else {
            yield this.evaluate_now(function (selector) {
                document.querySelector(selector).focus();
            }, selector);

            var insertPromise = new Promise(function (resolve, reject) {
                child.once('insert', function (err, result) {
                    if (err)
                        reject(err)
                    resolve(result);
                });
            });
            child.emit('insert', text);
            return insertPromise;
        }
    }


    /**
     * Mousedown on an element.
     *
     * @param {String} selector
     */
    *mousedown(selector) {
        debug('.mousedown() on ' + selector);
        yield this.evaluate_now(function (selector) {
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
    *mouseover(selector) {
        debug('.mouseover() on ' + selector);
        yield this.evaluate_now(function (selector) {
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

        var child = this.child;
        var pdfPromise = new Promise(function (resolve, reject) {
            child.once('pdf', function (err, pdf) {
                if (err)
                    debug(err);

                var buf = new Buffer(pdf.data);
                debug('.pdf() captured with length %s', buf.length);
                path ? fs.writeFile(path, buf, resolve) : resolve(buf);
            });
        });

        this.child.emit('pdf', path, options);
        return pdfPromise;
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
    *refresh() {
        debug('.refresh()');
        yield this.evaluate_now(function () {
            window.location.reload();
        });
    };

    /**
     * instructs the browser to reload the page.
     */
    *reload() {
        debug('.reload()');
        var child = this.child;
        var reloadPromise = new Promise(function (resolve, reject) {
            child.once('reload', function (err, result) {
                if (err)
                    reject(err)
                resolve(result);
            });
        });
        child.emit('reload');
        return reloadPromise;
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

        var child = this.child;
        var screenshotPromise = new Promise(function (resolve, reject) {
            child.once('screenshot', function (img) {
                var buf = new Buffer(img.data);
                debug('.screenshot() captured with length %s', buf.length);
                path ? fs.writeFile(path, buf, resolve) : resolve(buf);
            });
        });
        this.child.emit('screenshot', clip);
        return screenshotPromise;
    };

    /**
     * Set the scroll position.
     *
     * @param {Number} x
     * @param {Number} y
     */
    *scrollTo(y, x) {
        debug('.scrollTo()');
        yield this.evaluate_now(function (y, x) {
            window.scrollTo(x, y);
        }, y, x);
    };

    /**
     * Choose an option from a select dropdown
     *
     * @param {String} selector
     * @param {String} option value
     */
    *select(selector, option) {
        debug('.select() ' + selector);
        yield this.evaluate_now(function (selector, option) {
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

        if (this.state !== "ready")
            throw "Nightmare is not ready. Did you forget to call init()?";

        var child = this.child;
        var setAudioMutedPromise = new Promise(function (resolve, reject) {
            child.once('audio', function (isAudioMuted) {
                resolve(isAudioMuted);
            });
        });

        child.emit('audio', isMuted);
        return setAudioMutedPromise;
    };

    /**
     * instructs the browser to stop page loading.
     */
    *stop() {
        debug('.stop()');
        var child = this.child;
        var stopPromise = new Promise(function (resolve, reject) {
            child.once('stop', function (err, result) {
                if (err)
                    reject(err)
                resolve(result);
            });
        });
        child.emit('stop');
        return stopPromise;
    }

    /**
     * Get the title of the page.
     */
    *title() {
        debug('.title() getting it');
        return yield this.evaluate_now(function () {
            return document.title;
        });
    };

    /**
     * Type into an element.
     *
     * @param {String} selector
     * @param {String} text
     */
    *type() {
        var selector = arguments[0], text;
        if (arguments.length == 2) {
            text = arguments[1];
        }

        debug('.type() %s into %s', text, selector);
        var child = this.child;

        if (!text) {
            yield this.evaluate_now(function (selector) {
                document.querySelector(selector).focus();
                document.querySelector(selector).value = '';
            }, selector);

            return this._noop();
        } else {
            yield this.evaluate_now(function (selector) {
                document.querySelector(selector).focus();
            }, selector);

            var typePromise = new Promise(function (resolve, reject) {
                child.once('type', function (err, result) {
                    if (err)
                        reject(err)
                    resolve(result);
                });
            });
            child.emit('type', text);
            return typePromise;
        }
    };

    /*
     * Uncheck a checkbox, fire change event
     *
     * @param {String} selector
     */
    *uncheck(selector) {
        debug('.uncheck() ' + selector);
        yield this.evaluate_now(function (selector) {
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
    *url() {
        debug('.url() getting it');
        return yield this.evaluate_now(function () {
            return document.location.href;
        });
    };

    /**
     * Provides an easy way to call fn.apply(nightmare)
     * @param {Function} 
     */
    *use(fn) {
        var self = this;
        var fnPromise = co.wrap(fn);
        var res = yield fnPromise.apply(this);
        return res;
    };

    /**
     * Set the useragent.
     *
     * @param {String} useragent
     */
    useragent(useragent) {
        debug('.useragent() to ' + useragent);

        if (this.state !== "ready")
            throw "Nightmare is not ready. Did you forget to call init()?";

        var child = this.child;
        var setUserAgentPromise = new Promise(function (resolve, reject) {
            child.once('useragent', function () {
                resolve();
            });
        });

        child.emit('useragent', useragent);
        return setUserAgentPromise;
    };

    /**
     * Set the viewport.
     *
     * @param {Number} width
     * @param {Number} height
     */
    viewport(width, height) {
        debug('.viewport()');
        this.child.emit('size', width, height);
        return this._noop();
    };

    /**
     * Determine if a selector is visible on a page.
     *
     * @param {String} selector
     */
    *visible(selector) {
        debug('.visible() for ' + selector);
        return yield this.evaluate_now(function (selector) {
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
    *wait() {
        var args = Array.from(arguments);
        if (args.length < 1) {
            debug('Not enough arguments for .wait()');
            return;
        }

        var self = this;

        let timeout = new Promise(function (resolve, reject) {
            setTimeout(reject, self._options.waitTimeout, task.name + " timed out after " + self._options.waitTimeout);
        });

        var arg = args[0];
        if (_.isNumber(arg)) {
            debug('.wait() for ' + arg + 'ms');
            yield Promise.race([yield delay(arg), timeout]);
        }
        else if (_.isString(arg)) {
            debug('.wait() for ' + arg + ' element');
            var fn = function (selector) {
                var element = document.querySelector(selector);
                return (element ? true : false);
            }
            yield this.waitUntilTrue(fn, arg);
        }
        else if (_.isFunction(arg)) {
            debug('.wait() for fn');
            yield this.waitUntilTrue.apply(args);
        }

        return undefined;
    };

    /**
     * Returns a promise that resolves when the current web browser finishes loading all resources.
     */
    waitUntilFinishLoad() {
        debug('waitUntilFinishLoad() starting');

        if (this.state !== "ready")
            throw "Nightmare is not ready. Did you forget to call init()?";

        var child = this.child;

        var p = new Promise(function (resolve, reject) {
            child.once('waitUntilFinishLoad', function (err, result) {
                if (err)
                   reject(err);
                resolve(result);
            });
        });

        child.emit('waitUntilFinishLoad');
        return p;
    };

    /**
     * Wait until evaluated function returns true or timeout
     *
     * @param {Function} fn
     * @param {...} args
     */
    *waitUntilTrue(fn/**, arg1, arg2...**/) {
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
        }

        yield Promise.race([check, timeout]);
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
                    _.set(obj, fnName, function () {
                        return fn[fnName].bind(self);
                    });
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

        var child = this.child;
        var getCookiePromise = new Promise(function (resolve, reject) {
            child.once('cookie.get', function (err, result) {
                if (err)
                    reject(err)
                resolve(result);
            });
        });

        child.emit('cookie.get', query);
        return getCookiePromise;
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
        
        var child = this.child;
        var setCookiePromise = new Promise(function (resolve, reject) {
            child.once('cookie.set', function (err, result) {
                if (err)
                    reject(err)
                resolve(result);
            });
        });

        child.emit('cookie.set', cookies);
        return setCookiePromise;
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

        var child = this.child;
        var clearCookiePromise = new Promise(function (resolve, reject) {
            child.once('cookie.clear', function (err, result) {
                if (err)
                    reject(err)
                resolve(result);
            });
        });

        child.emit('cookie.clear', cookies);
        return clearCookiePromise;
    };

}

module.exports = Nightmare;