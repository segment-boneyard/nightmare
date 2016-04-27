"use strict";

/**
 * DEBUG=nightmare*
 */
 
const log = require('debug')('nightmare:log');
const eventLog = require('debug')('nightmare:eventLog');
const verbose = require('debug')('nightmare:verbose');
const debug = require('debug')('nightmare');
const electronLog = {
    stdout: require('debug')('electron:stdout'),
    stderr: require('debug')('electron:stderr')
};

const default_electron_path = require('electron-prebuilt');
const proc = require('child_process');
const join = require('path').join;
const _ = require("lodash");
const co = require("co");
const async = require("async");
const delay = require("delay");
const fs = require('fs');
const shortid = require("shortid");
const split2 = require('split2');

const ipc = require('./ipc');

/**
 * runner script
 */

const runnerPath = join(__dirname, 'runner.js');

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
            verbose('._invokeRunnerOperation() waiting for %s', runnerResponseMessageName);

            child.once(runnerResponseMessageName, function (result) {
                if (result && !_.isUndefined(result.err)) {
                    verbose('._invokeRunnerOperation() %s failed.', runnerResponseMessageName);
                    reject(result.err);
                    return;
                }
                verbose('._invokeRunnerOperation() %s succeeded.', runnerResponseMessageName);
                if (result && !_.isUndefined(result.result)) {
                    resolve(result.result);
                    return;
                }

                resolve(undefined);
            });
        });

        let args = Array.from(arguments);
        args[0] = runnerRequestMessageName;

        verbose('._invokeRunnerOperation() invoking %s', runnerRequestMessageName);
        child.emit.apply(this, args);
        return p;
    }

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
                //Also allow 'tuples' to be chainable.
                else if (_.isArray(tink) && tink.length === 2 && _.isFunction(tink[0]) && _.isFunction(tink[1])) {
                    if (prefix)
                        functionNames.push(prefix + "." + propertyKey);
                    else
                        functionNames.push(propertyKey);
                }
                //Allow namespaces to be chainable. 
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
                var fn = _.get(obj, functionName);

                //Allow tuples to be chainable.
                if (_.isArray(fn) && fn.length === 2 && _.isFunction(fn[0]) && _.isFunction(fn[1]))
                    fn = fn[1];

                _.set(chainablePromise, functionName, wrap(functionName, fn));
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
     * end
     */
    end() {
        this._endInstance();
    };

    /**
     * Returns a promise which will be resolved once the specified JavaScript has been evaluated.
     */
    evaluate_now(fn) {
        let args = Array.from(arguments).slice(1);
        debug('.evaluate_now() fn on the page');
        let js = "(" + template.evaluate + "(" + (String(fn)) + ", " + (JSON.stringify(args)) + "))";

        var id = shortid.generate();
        var operationParams = {
            runnerRequestMessageName: "javascript",
            runnerResponseMessageName: "javascript " + id
        }
        return this._invokeRunnerOperation(operationParams, js, false, id);
    }

    /*
     * Returns a promise which will be resolved when an asynchronous function on the page is evaluated and waits for the promise/generator/thenable/callback to complete.
     */
    evaluate_async(fn) {
        let args = Array.from(arguments).slice(1);
        debug('.evaluate_async() fn on the page');
        let js = "(" + template.evaluateAsync + "(" + (String(fn)) + ", " + (JSON.stringify(args)) + "))";

        var id = shortid.generate();
        var operationParams = {
            runnerRequestMessageName: "javascript",
            runnerResponseMessageName: "javascript " + id
        }
        return this._invokeRunnerOperation(operationParams, js, true, id);
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
        debug('.init() starting');
        this.proc = proc.spawn(this._options.electronPath, [runnerPath].concat(JSON.stringify(this._options.electronArgs)), {
            stdio: [null, null, null, 'ipc']
        });

        this.proc.stdout.pipe(split2()).on('data', (data) => {
            electronLog.stdout(data);
        });

        this.proc.stderr.pipe(split2()).on('data', (data) => {
            electronLog.stderr(data);
        });

        let self = this;
        let child = ipc(self.proc);

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
        child.on('did-fail-provisional-load', function () { eventLog('did-fail-provisional-load', JSON.stringify(Array.prototype.slice.call(arguments))); });
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

        if (_.isFunction(self.childReady))
            self.childReady();
        
        return co(function* () {
            self.initializeNamespaces();
            self.initializeActionTuples();

            yield readyPromise;

            self.child.emit('browser-initialize', self._options);

            yield browserInitializePromise;

            debug('.init() now ready.');
            self.state = "ready";

            yield self.initializeElectronActions();
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
                self.initializeActionTuples(self[ns]);
            }
        }
    };

    /*
     * Initialize nightmare/electron action tuples.
     */
    initializeActionTuples(obj) {
        debug('.initializeActionTuples() starting');

        if (!obj)
            obj = this;
        
        //find properties that are arrays of 2 functions, associate the first function with the runner, and set the 2nd as a function property.
        let propertyNames = Object.getOwnPropertyNames(Object.getPrototypeOf(obj));
        for (let propertyKey of propertyNames) {
            let tink = obj[propertyKey];
            if (_.isArray(tink)) {
                if (tink.length === 2 && _.isFunction(tink[0]) && _.isFunction(tink[1])) {
                    Nightmare._electronActions[propertyKey] = tink[0];
                    obj[propertyKey] = tink[1].bind(this);
                }
            }
        }
    };

    /*
     * Initializes Custom Electron Actions - should only need to be run if an electron action has been added after init()
     */
    initializeElectronActions() {
        debug('.initializeElectronActions() starting');
        if (_.isUndefined(Nightmare._electronActions)) {
            debug('.initializeElectronActions() no namespaces defined.');
            return;
        }

        var id = shortid.generate();
        var operationParams = {
            runnerRequestMessageName: "electronAction",
            runnerResponseMessageName: "electronAction " + id
        };

        let electronActions = [];
        let promises = [];
        for (let electronActionName of _.keys(Nightmare._electronActions)) {
            verbose('adding electron action for "%s"', electronActionName);

            electronActions.push({
                name: electronActionName,
                fntext: String(Nightmare._electronActions[electronActionName])
            });
        }

        return this._invokeRunnerOperation(operationParams, electronActions, null, id).then(function () {
            debug('.initializeElectronActions() completed.');
        });
    };

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
            return this._invokeRunnerOperation("insertCSS", css);
        }
        else {
            debug('unsupported file type in .inject()');
            throw new Error("unsupported file type in .inject(): " + type);
        }
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
     * Provides an easy way to call fn.apply(nightmare)
     * @param {Function} 
     */
    use(fn) {
        let self = this;
        let fnPromise = co.wrap(fn);
        return fnPromise.apply(this);
    };

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

            Nightmare.registerNamespace(name);
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
    };

    /*
     * Registers a namespace that has been defined on Nightmare.prototype
     */
    static registerNamespace(name) {
        if (_.isUndefined(Nightmare._namespaces))
            Nightmare._namespaces = [];

        if (Nightmare._namespaces.indexOf(name) === -1) {
            Nightmare._namespaces.push(name);
        }
    };
}

Nightmare._namespaces = [];
Nightmare._electronActions = {};
module.exports = Nightmare;