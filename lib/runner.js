"use strict";
/**
 * Module Dependencies
 */

const parent = require('./ipc')(process);
const electron = require('electron');
const BrowserWindow = electron.BrowserWindow;
const join = require('path').join;
const renderer = require('electron').ipcMain;
const app = require('electron').app;
const fs = require('fs');
const _ = require("lodash");
const async = require("async");

const template = require('./javascript');
var FrameManager = require('./frame-manager');

const powerSaveBlocker = electron.powerSaveBlocker;
powerSaveBlocker.start('prevent-app-suspension');

/**
 * Handle uncaught exceptions in the main electron process
 */

process.on('uncaughtException', function (e) {
    parent.emit('uncaughtException', e.stack);
});

/**
 * Update the app paths
 */
if (process.argv.length < 3) {
  throw new Error(`Too few runner arguments: ${JSON.stringify(process.argv)}`);
}

var processArgs = JSON.parse(process.argv[2]);
var paths = processArgs.paths;
if (paths) {
    for (var i in paths) {
        app.setPath(i, paths[i]);
    }
}
var switches = processArgs.switches;
if (switches) {
    for (var i in switches) {
        app.commandLine.appendSwitch(i, switches[i]);
    }
}


/**
 * Hide the dock
 */

// app.dock is not defined when running
// electron in a platform other than OS X
if (!processArgs.dock && app.dock) {
    app.dock.hide();
}

/**
 * Listen for the app being "ready"
 */

app.on('ready', function () {
    let win, frameManager, options;
    
    /**
     * create a browser window
     */

    parent.respondTo('browser-initialize', function (opts, done) {
        options = _.defaults(opts, {
            show: false,
            alwaysOnTop: true,
            openDevTools: false,
            setAudioMuted: true,
            webPreferences: {
                preload: join(__dirname, 'preload.js'),
                nodeIntegration: false
            }
        });

        /**
         * Create a new Browser Window
         */

        win = new BrowserWindow(options);
        if (options.show && options.openDevTools) {
            if (_.isObject(options.openDevTools)) {
                win.openDevTools(options.openDevTools);
            } else {
                win.openDevTools();
            }
        }

        /**
         * Window Docs:
         * https://github.com/atom/electron/blob/master/docs/api/browser-window.md
         */

        frameManager = FrameManager(win);

        /**
         * Window options
         */

        win.webContents.setAudioMuted(options.setAudioMuted);

        /**
         * Pass along web content events
         */

        renderer.on('page', function (sender/*, arguments, ... */) {
            parent.emit.apply(parent, ['page'].concat(Array.from(arguments).slice(1)));
        });

        renderer.on('console', function (sender, type, args) {
            parent.emit.apply(parent, ['console', type].concat(args));
        });

        win.webContents.on('did-finish-load', forward('did-finish-load'));
        win.webContents.on('did-fail-load', forward('did-fail-load'));
        win.webContents.on('did-fail-provisional-load', forward('did-fail-provisional-load'));
        win.webContents.on('did-frame-finish-load', forward('did-frame-finish-load'));
        win.webContents.on('did-start-loading', forward('did-start-loading'));
        win.webContents.on('did-stop-loading', forward('did-stop-loading'));
        win.webContents.on('did-get-response-details', forward('did-get-response-details'));
        win.webContents.on('did-get-redirect-request', forward('did-get-redirect-request'));
        win.webContents.on('dom-ready', forward('dom-ready'));
        win.webContents.on('page-favicon-updated', forward('page-favicon-updated'));
        win.webContents.on('new-window', forward('new-window'));
        win.webContents.on('will-navigate', forward('will-navigate'));
        win.webContents.on('login', forward('login'));
        win.webContents.on('media-started-playing', forward('media-started-playing'));
        win.webContents.on('media-paused', forward('media-paused'));
        win.webContents.on('crashed', forward('crashed'));
        win.webContents.on('plugin-crashed', forward('plugin-crashed'));
        win.webContents.on('destroyed', forward('destroyed'));

        done.resolve();
    });

    /**
     * javascript
     */
    parent.respondTo('javascript', function (code, isAsync, done) {

        var logForwarder = function (event, args) {
            parent.emit.apply(parent, ['log'].concat(args));
        };

        renderer.on('log', logForwarder);

        win.webContents.executeJavaScript(code, function (result) {

            renderer.removeListener("log", logForwarder);

            if (isAsync) {
                //wait until the script emits a 'javascript' event.
                renderer.once('javascript', function (event, result) {
                    if (result.err) {
                        done.reject(result.err);
                    } else {
                        done.resolve(result.result);
                    }
                });
            } else {
                //We're not async, we're done at this point.
                if (result.err) {
                    done.reject(result.err);
                } else {
                    done.resolve(result.result);
                }
            }
        });
    });

    /**
     * insert css
     */
    parent.respondTo('insertCSS', function (css, done) {
        win.webContents.insertCSS(css);
        done.resolve();
    });

    /**
     * Add custom functionality
     */
    parent.respondTo('electronAction', function (name, fntext, done) {

        let actions = [];
        if (_.isArray(name))
            actions = name;
        else
            actions.push({
                name: name,
                fntext: fntext
            });

        for (let action of actions) {
            let fn = new Function('with(this){ parent.emit("log", "registering electron action for ' + action.name + '"); return ' + action.fntext + '}')
                .call({
                    require: require,
                    parent: parent
                });
            fn(name, options, parent, win, renderer, frameManager);
        }
        done.resolve();
    });

    /**
     * Send "ready" event to the parent process
     */
    parent.emit('ready', null, {
        electron: process.versions['electron'],
        chrome: process.versions['chrome']
    });
});

/**
 * Forward events
 */

function forward(name) {
    return function (event) {
        // trying to send the event's `sender` can crash electron, so strip it
        // https://github.com/electron/electron/issues/5180
        var safeEvent = Object.assign({}, event);
        delete safeEvent.sender;
        parent.emit.apply(parent, [name, safeEvent].concat(Array.from(arguments).slice(1)));
    };
}
