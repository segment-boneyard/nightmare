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
const path = require('path');
const _ = require("lodash");
const co = require("co-bluebird");
const async = require("async");
const delay = require("delay");
const fs = require('fs');
const split2 = require('split2');
const util = require("util");

const ipc = require('./ipc');

/**
 * runner script
 */

const runnerPath = path.join(__dirname, 'runner.js');

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
                preload: path.join(__dirname, 'preload.js'),
                nodeIntegration: false
            }
        });

        let self = this;

        process.setMaxListeners(Infinity);
        process.on('uncaughtException', function (err) {
            console.error(err.stack);
            self._endInstance(self);
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
        this._attachToProcess(this);

        // initial state
        this.state = 'initial';
        this._headers = {};
        
        //Snapshot the actions defined on the prototype.
        this._initializeActionTuples();
    }

    /**
     * Attach any instance-specific process-level events.
     */
    _attachToProcess(instance) {
        instance._endSelf = this._endInstance.bind(this, instance);
        process.setMaxListeners(Infinity);
        process.on('exit', instance._endSelf);
        process.on('SIGINT', instance._endSelf);
        process.on('SIGTERM', instance._endSelf);
        process.on('SIGQUIT', instance._endSelf);
        process.on('SIGHUP', instance._endSelf);
        process.on('SIGBREAK', instance._endSelf);
    }

    /**
     * Detach instance-specific process-level events.
     */
    _detachFromProcess(instance) {
        process.removeListener('exit', instance._endSelf);
        process.removeListener('SIGINT', instance._endSelf);
        process.removeListener('SIGTERM', instance._endSelf);
        process.removeListener('SIGQUIT', instance._endSelf);
        process.removeListener('SIGHUP', instance._endSelf);
        process.removeListener('SIGBREAK', instance._endSelf);
    }
    
    _endInstance(instance) {
        debug('_endInstance() starting.');
        this._detachFromProcess(instance);
        if (instance.proc && instance.proc.connected) {
            debug('_endInstance() shutting down child process.');
            instance.child.removeAllListeners();
            instance.proc.removeAllListeners();
            instance.proc.disconnect();
            instance.proc.kill();
            instance.proc = null;
        }
        instance.state = "ended";
    }

    /*
     * Initialize nightmare/electron action tuples.
     */
    _initializeActionTuples(obj) {
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
     * Initializes a Nightmare Promise Subclass
     */
    _initializeNightmarePromise() {

        let self = this;
        let NightmarePromise = class extends Promise {
            constructor(executor) {
                if (!_.isFunction(executor))
                    throw new TypeError("NightmarePromise resolver ${executor} is not a function");
                    
                let finalResolve, finalReject;
                
                //Call the Promise constructor with the final resolve/reject functions.
                super(function (resolve, reject) {
                    finalResolve = resolve;
                    finalReject = reject;
                });

                this._lastResult;
                this._lastError;

                var that = this;
                //Setup the queue which will process chained functions.
                this._queue = async.queue(function (task, cb) {
                    debug(`Running ${task.name}`);

                    let timeout = new Promise(function (resolve, reject) {
                        setTimeout(reject, self._options.waitTimeout, task.name + " timed out after " + self._options.waitTimeout).unref();
                    });

                    return Promise.race([task.promise(that), timeout])
                        .then(function (res) {
                            that._lastResult = res;
                            debug(`Resolved ${task.name}`);
                            cb();

                        })
                        .catch(function (err) {
                            that._lastError = err;
                            debug(`Rejected ${task.name}`);
                            cb();
                        });
                });
                
                this._queue.drain = function () {
                    debug("Completed promise chain.");
                    if (that._lastError)
                        return finalReject(that._lastError);
                        
                    finalResolve(that._lastResult);
                };
                
                //If the constructor defines a function, add it to the start of the queue.
                this._queue.push({
                    name: "executor",
                    promise: function() {
                        return new Promise(executor);
                    }
                });
            }
            //TODO: Contructor that goes through and clones all objects on the instances from the prototype to detach???
            //But we don't really care since this is anonymous...hm.
        };
        
        let getFunctionNames = function (obj, prefix, bindThis) {
            let functionNames = [];
            let propertyNames = [];

            propertyNames = Object.getOwnPropertyNames(Object.getPrototypeOf(obj));

            //Exclude some methods from the chain.
            propertyNames = _.remove(propertyNames, function (name) {
                if (name.startsWith("_") || name === "constructor" || name === "chain" || name === "engineVersions" || name === "nightmarePromise")
                    return false;
                return true;
            });

            for (let propertyKey of propertyNames) {
                let tink = obj[propertyKey];
                if (_.isFunction(tink)) {
                    if (prefix)
                        functionNames.push({
                            name: prefix + "." + propertyKey,
                            bindThis: bindThis
                        });
                    else
                        functionNames.push({
                            name: propertyKey,
                            bindThis: bindThis
                        });
                }
                //Also allow 'tuples' to be chainable.
                else if (_.isArray(tink) && tink.length === 2 && _.isFunction(tink[0]) && _.isFunction(tink[1])) {
                    if (prefix)
                        functionNames.push({
                            name: prefix + "." + propertyKey,
                            bindThis: bindThis
                        });
                    else
                        functionNames.push({
                            name: propertyKey,
                            bindThis: bindThis
                        });
                }
                //Allow namespaces to be chainable. 
                else if (_.isObject(tink)) {
                    let bindThis = true;
                    var nsDef = _.find(Nightmare._namespaces, { name: propertyKey });
                    if (nsDef)
                        bindThis = nsDef.bindThis;

                    var results = getFunctionNames(tink, propertyKey, bindThis);
                    functionNames = functionNames.concat(results);
                }
            }

            return functionNames;
        };

        let defineNightmarePromisePrototypeFunction = function (fnName, fn, bindThis) {

            bindThis = _.isBoolean(bindThis) ? bindThis : true;

            let thisArg = self;
            if (bindThis !== true) {
                let activatorPath = fnName.substring(0, fnName.lastIndexOf("."));
                let activator = _.get(NightmarePromise.prototype, activatorPath);

                if (activator)
                    thisArg = activator;
            }

            let wrapperFunc = function () {
                let args = Array.from(arguments);

                debug(`.${fnName}() Promise queuing`);

                this._queue.push({
                    name: fnName,
                    promise: co.wrap(function () {
                        return fn.apply(thisArg, args);
                    })
                });

                return this;
            };
            
            _.set(NightmarePromise.prototype, fnName, wrapperFunc);
        };

        for (let functionName of getFunctionNames(self)) {
            let fn = _.get(self, functionName.name);

            //Allow tuples to be chainable.
            if (_.isArray(fn) && fn.length === 2 && _.isFunction(fn[0]) && _.isFunction(fn[1]))
                fn = fn[1];
                
            defineNightmarePromisePrototypeFunction(functionName.name, fn, functionName.bindThis);
        }
        
        //Proxy the then function.
        NightmarePromise.prototype.then = function (onFulfilled, onRejected) {
            this._queue.push({
                name: "then",
                promise: function (self) {
                    return new Promise(function (resolve, reject) {

                        if (self._lastError) {
                            if (_.isFunction(onRejected)) {
                                try {
                                    let result = onRejected(self._lastError);
                                    self._lastError = undefined;
                                    return resolve(result);
                                }
                                catch (ex) {
                                    return reject(ex);
                                }
                            }
                            else {
                                return reject(self._lastError);
                            }
                        }
                        
                        try {
                            let result = onFulfilled(self._lastResult);
                            return resolve(result);
                        } catch (ex) {
                            return reject(ex);
                        }

                    });
                }
            });
            return this;
        };
        
        return NightmarePromise;
    }
    
    _invokeRunnerOperation(operationName) {
        if (this.state !== "ready")
            throw "Nightmare is not ready. Did you forget to call init()?";

        let child = this.child;

        verbose('._invokeRunnerOperation() invoking %s', operationName);
        return child.call.apply(this, Array.from(arguments));
    }
    
    /**
     * Gets the version info for Electron and Chromium.
     */
    get engineVersions() {
        return this._engineVersions;
    };
    
    /*
     * Gets an new of the NightmarePromise.
     */
    get nightmarePromise() {
        return this._initializeNightmarePromise();
    }
    
    /**
     * Creates a nightmare object which can be used to chain a number of actions sequentally.
     */
    chain(initOpts) {
        let self = this;
        let chainArgs = Array.from(arguments);

        let getFunctionNames = function (obj, prefix, bindThis) {
            let functionNames = [];
            let propertyNames = [];

            propertyNames = Object.getOwnPropertyNames(Object.getPrototypeOf(obj));

            //Exclude some methods from the chain.
            propertyNames = _.remove(propertyNames, function (name) {
                if (name.startsWith("_") || name === "constructor" || name === "chain" || name === "engineVersions")
                    return false;
                return true;
            });

            for (let propertyKey of propertyNames) {
                let tink = obj[propertyKey];
                if (_.isFunction(tink)) {
                    if (prefix)
                        functionNames.push({
                            name: prefix + "." + propertyKey,
                            bindThis: bindThis
                        });
                    else
                        functionNames.push({
                            name: propertyKey,
                            bindThis: bindThis
                        });
                }
                //Also allow 'tuples' to be chainable.
                else if (_.isArray(tink) && tink.length === 2 && _.isFunction(tink[0]) && _.isFunction(tink[1])) {
                    if (prefix)
                        functionNames.push({
                            name: prefix + "." + propertyKey,
                            bindThis: bindThis
                        });
                    else
                        functionNames.push({
                            name: propertyKey,
                            bindThis: bindThis
                        });
                }
                //Allow namespaces to be chainable. 
                else if (_.isObject(tink)) {
                    let bindThis = true;
                    var nsDef = _.find(Nightmare._namespaces, { name: propertyKey });
                    if (nsDef)
                        bindThis = nsDef.bindThis;
                    
                    var results = getFunctionNames(tink, propertyKey, bindThis);
                    functionNames = functionNames.concat(results);
                }
            }

            return functionNames;
        };

        let lastResult = undefined;
        let q = async.queue(function (task, cb) {
            debug("Running " + task.name);

            let timeout = new Promise(function (resolve, reject) {
                setTimeout(reject, self._options.waitTimeout, task.name + " timed out after " + self._options.waitTimeout).unref();
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
        };

        //Defining custom behavior on Promise rather than subclassing as Node 5.x isn't quite there yet.
        let initialPromise = new Promise(function (resolve, reject) {
            finalResolve = resolve;
            finalReject = reject;
        });

        let initializeChainablePromise = function (chainablePromise, obj) {
            let wrap = function (fnName, fn, bindThis) {
                return function () {
                    let args = Array.from(arguments);
                    bindThis = _.isBoolean(bindThis) ? bindThis : true;

                    debug("chain() Queueing " + fnName);

                    let thisArg = self;
                    if (bindThis !== true) {
                        let activatorPath = fnName.substring(0, fnName.lastIndexOf("."));
                        let activator = _.get(obj, activatorPath);
                        
                        if (activator)
                            thisArg = activator;
                    }
                        
                    q.push({
                        name: fnName,
                        promise: co.wrap(function () {
                            return fn.apply(thisArg, args);
                        })
                    });
                    return chainablePromise;
                };
            };

            for (let functionName of getFunctionNames(obj)) {
                var fn = _.get(obj, functionName.name);

                //Allow tuples to be chainable.
                if (_.isArray(fn) && fn.length === 2 && _.isFunction(fn[0]) && _.isFunction(fn[1]))
                    fn = fn[1];

                _.set(chainablePromise, functionName.name, wrap(functionName.name, fn, functionName.bindThis));
            }
            
            //Proxy then() function
            let oldThen = chainablePromise.then;
            _.set(chainablePromise, "then", function() { let cont = oldThen.apply(chainablePromise, Array.from(arguments)); initializeChainablePromise(cont, self); return cont; });
        };

        initializeChainablePromise(initialPromise, self);

        if (self.state != "ready") {
            debug("chain() called before init() queueing init");
            initialPromise.init(initOpts);
        }

        return initialPromise;
    }

    /**
     * end
     */
    end() {
        this._endInstance(this);
    };

    /**
     * Returns a promise which will be resolved once the specified JavaScript has been evaluated.
     */
    evaluate_now(fn) {
        let args = Array.from(arguments).slice(1);
        debug('.evaluate_now() fn on the page');
        let js = "(" + template.evaluate + "(" + (String(fn)) + ", " + (JSON.stringify(args)) + "))";

        return this._invokeRunnerOperation("javascript", js, false);
    }

    /*
     * Returns a promise which will be resolved when an asynchronous function on the page is evaluated and waits for the promise/generator/thenable/callback to complete.
     */
    evaluate_async(fn) {
        let args = Array.from(arguments).slice(1);
        debug('.evaluate_async() fn on the page');
        let js = "(" + template.evaluateAsync + "(" + (String(fn)) + ", " + (JSON.stringify(args)) + "))";

        return this._invokeRunnerOperation("javascript", js, true);
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

        return Promise.resolve();
    };

    /*
     * Initializes the nightmare
     */
    init(opts) {
        debug('.init() starting');
        
        opts = _.defaultsDeep(opts, {
            onChildReady: undefined
        });

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
        self.state = "childReady";
        
        if (_.isFunction(self.childReady))
            self.childReady();
            
        if (_.isFunction(opts.onChildReady))
            opts.onChildReady();
        
        return co(function* () {

            self._engineVersions = yield readyPromise;

            yield self.child.call('browser-initialize', self._options);

            debug('.init() now ready.');
            self.state = "ready";

            yield self.initializeElectronActions();
            
            return self._engineVersions;
        });
    };

    /*
     * Initializes Custom Electron Actions.
     */
    initializeElectronActions() {
        debug('.initializeElectronActions() starting');
        if (_.isUndefined(Nightmare._electronActions)) {
            debug('.initializeElectronActions() no electron actions defined.');
            return;
        }

        let electronActions = [];
        let promises = [];
        for (let electronActionName of _.keys(Nightmare._electronActions)) {
            verbose('adding electron action for "%s"', electronActionName);

            electronActions.push({
                name: electronActionName,
                fntext: String(Nightmare._electronActions[electronActionName])
            });
        }

        return this._invokeRunnerOperation("electronAction", electronActions, null).then(function () {
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

            return this._invokeRunnerOperation("javascript", js, false);
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
        if (this.state !== "childReady" && this.state !== "ready")
            throw "Nightmare is not ready. Did you forget to call init()?";

        this.child.on(event, handler);
        return Promise.resolve();
    };

    /**
     * once
     */
    once(event, handler) {
        this.child.once(event, handler);
        return this;
    };

    /**
     * removeEventListener
     */
    removeListener(event, handler) {
        this.child.removeListener(event, handler);
        return this;
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
            throw "Incorrect or unsupported arguments.";
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

            Nightmare.registerNamespace(name, false);
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
    static registerNamespace(name, bindThis) {
        if (_.isUndefined(Nightmare._namespaces))
            Nightmare._namespaces = [];

        bindThis = _.isBoolean(bindThis) ? bindThis :  true;
        
        let nsObj;
        if (_.isString(name)) {
            nsObj = {
                name: name,
                bindThis: bindThis
            };
        } else if (_.isObject(name)) {
            nsObj = name;
        }
        
        if (!_.find(Nightmare._namespaces, { name: nsObj.name })) {
            Nightmare._namespaces.push(nsObj);
        } else {
            throw util.format(`A ${nsObj.name} namespace has already been registered.`);
        }
    };
    
    /*
     * Gets the Nightmare version
    */
    static version() {
        return require(path.resolve(__dirname, '..', 'package.json')).version;
    }
}

Nightmare._namespaces = [];
Nightmare._electronActions = {};

//So Meta!
let NightmareProxy = new Proxy(Nightmare, {
    //Intercept the Nightmare constructor and return a proxy of the nightmare instance.
    //We'll use this to do super-meta things... like return proxies to promises and
    //remapping namespaces.
    construct(targetPrototype, propertyKey, receiver) {
        let nightmareObject = Reflect.construct(targetPrototype, propertyKey, receiver);
        let nightmareObjectProxy = new Proxy(nightmareObject, {
            get(target, propertyKey, receiver) {
                
                //If the property that we're getting is defined as a namespace, ensure that it's been initialized.
                let ns = _.find(Nightmare._namespaces, { name: propertyKey });
                if (ns && _.isFunction(target[propertyKey]) && !target[propertyKey]._nightmareNamespaceInitialized) {
                    
                    var nsObj = new target[ns.name](nightmareObjectProxy);

                    if (ns.bindThis === true) {
                        //Ensure that this is bound to the Nightmare object on all namespace functions.
                        for (let functionName of Object.getOwnPropertyNames(Object.getPrototypeOf(nsObj))) {
                            if (_.isFunction(nsObj[functionName]) && functionName !== "constructor") {
                                nsObj[functionName] = nsObj[functionName].bind(target);
                            }
                        }
                    }

                    target._initializeActionTuples(nsObj);
                    nsObj._nightmareNamespaceInitialized = true;
                    
                     target[ns.name] = nsObj;
                }
                
                return Reflect.get(target, propertyKey, receiver);
            },
        });
        return nightmareObjectProxy;
    }
});

module.exports = NightmareProxy;