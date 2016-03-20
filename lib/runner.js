"use strict";
/**
 * Module Dependencies
 */

const parent = require('./ipc')(process);
const electron = require('electron')
const BrowserWindow = electron.BrowserWindow;
const join = require('path').join;
const renderer = require('electron').ipcMain;
const app = require('electron').app;
const fs = require('fs');
const _ = require("lodash");
const template = require('./javascript');

const powerSaveBlocker = electron.powerSaveBlocker;
powerSaveBlocker.start('prevent-app-suspension');

/**
 * Handle uncaught exceptions in the main electron process
 */

process.on('uncaughtException', function (e) {
    parent.emit('uncaughtException', e.stack)
})

/**
 * Update the app paths
 */

if (process.argv.length > 2) {
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
    var win;

    /**
     * create a browser window
     */

    parent.on('browser-initialize', function (options) {
        options = _.defaultsDeep(options, {
            show: false,
            alwaysOnTop: true,
            webPreferences: {
                preload: join(__dirname, 'preload.js'),
                nodeIntegration: false
            }
        })

        /**
         * Create a new Browser Window
         */

        win = new BrowserWindow(options);

        /**
         * Window Docs:
         * https://github.com/atom/electron/blob/master/docs/api/browser-window.md
         */

        /**
         * Window options
         */

        win.webContents.setAudioMuted(true);

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
        win.webContents.on('did-frame-finish-load', forward('did-frame-finish-load'));
        win.webContents.on('did-start-loading', forward('did-start-loading'));
        win.webContents.on('did-stop-loading', forward('did-stop-loading'));
        win.webContents.on('did-get-response-details', forward('did-get-response-details'));
        win.webContents.on('did-get-redirect-request', forward('did-get-redirect-request'));
        win.webContents.on('dom-ready', forward('dom-ready'));
        win.webContents.on('page-favicon-updated', forward('page-favicon-updated'));
        win.webContents.on('new-window', forward('new-window'));
        win.webContents.on('will-navigate', forward('will-navigate'));
        win.webContents.on('crashed', forward('crashed'));
        win.webContents.on('plugin-crashed', forward('plugin-crashed'));
        win.webContents.on('destroyed', forward('destroyed'));

        parent.emit('browser-initialize');
    });

    /**
     * Parent actions
     */

    /**
     * goto
     */

    parent.on('goto', function (url, headers) {
        var extraHeaders = '';
        for (var key in headers) {
            extraHeaders += key + ': ' + headers[key] + '\n';
        }

        if (win.webContents.getURL() == url) {
            parent.emit('goto', null, url);
        } else {
            win.webContents.once('did-fail-load', function (event, code) {
                parent.emit('goto', code, null);
            });
            win.webContents.once('did-finish-load', function () {
                parent.emit('goto', null, win.webContents.getURL());
            });
            win.webContents.loadURL(url, {
                extraHeaders: extraHeaders
            });
        }
    });

    /**
     * back
     **/
    parent.on('goBack', function () {
        if (!win.webContents.canGoBack()) {
            parent.emit('goBack', true);
        } else {
            if (win.webContents.isLoading())
                parent.emit("goBack", "asdfasdfasdfasdf");

            win.webContents.once('did-fail-load', function (event, code) {
                parent.emit('goBack', code, null);
            });
            win.webContents.once('did-stop-loading', function () {
                parent.emit('goBack', null, win.webContents.getURL());
            });
            win.webContents.once('did-finish-load', function () {
                parent.emit('goBack', null, win.webContents.getURL());
            });
            win.webContents.goBack();
        }
    });

    /**
     * forward
     **/
    parent.on('goForward', function () {
        if (!win.webContents.canGoForward()) {
            parent.emit('goForward', true);
        } else {
            win.webContents.once('did-fail-load', function (event, code) {
                parent.emit('goForward', code, null);
            });
            win.webContents.once('did-finish-load', function () {
                parent.emit('goForward', null, win.webContents.getURL());
            });
            win.webContents.goForward();
        }
    });

    /**
     * stop
     */
    parent.on('stop', function () {
        win.webContents.stop();
        parent.emit('stop');
    });

    /**
     * reload
     */
    parent.on('reload', function () {
        win.webContents.reload();
        parent.emit('reload');
    });

    /**
     * Retrieves the specified element from clickOpts.selector and clicks it using webContents.sendInputEvent.
     */
    parent.on('emulateClick', function (clickOpts) {
        clickOpts = _.defaults(clickOpts, {
            button: "left",
            clickCount: 1
        });

        var js_fn = function (selector) {
            var element = document.querySelector(selector);

            if (!element)
                return false;

            return {
                top: element.offsetTop,
                left: element.offsetLeft,
                width: element.offsetWidth,
                height: element.offsetHeight
            };
        };

        var argsList = JSON.stringify([clickOpts.selector]).slice(1, -1);

        var js = "(" + String(js_fn) + ")(" + argsList + ");";

        win.webContents.executeJavaScript(js, false, function (offset) {
            
            var x = Math.floor(offset.left + (offset.width / 2));
            var y = Math.floor(offset.top + (offset.height / 2));
            
            win.webContents.sendInputEvent({ type: 'mouseDown', x: x, y: y, button: clickOpts.button, clickCount: clickOpts.clickCount });
            win.webContents.sendInputEvent({ type: 'mouseUp', x: x, y: y, button: clickOpts.button, clickCount: clickOpts.clickCount });
            parent.emit("emulateClick", null, { x: x, y: y });
        });
    });

    /**
     * javascript
     */
    parent.on('javascript', function (code) {

        var logForwarder = function (event, args) {
            parent.emit.apply(parent, ['log'].concat(args));
        };

        renderer.on('log', logForwarder);

        win.webContents.executeJavaScript(code, function (result) {
            renderer.removeListener("log", logForwarder);
            parent.emit('javascript', result.error, result.response);
        });
    });

    /**
     * css
     */

    parent.on('css', function (css) {
        win.webContents.insertCSS(css);
    });

    /**
     * size
     */

    parent.on('size', function (width, height) {
        win.setSize(width, height);
    });

    /**
     * title
     */
    parent.on('title', function () {
        parent.emit("title", win.webContents.getTitle());
    });

    /**
     * audio
     */

    parent.on('audio', function (audio) {
        win.webContents.setAudioMuted(audio);
        parent.emit('audio', win.webContents.isAudioMuted());
    });

    /**
     * useragent
     */
    parent.on('useragent', function (useragent) {
        win.webContents.setUserAgent(useragent);
        parent.emit('useragent');
    });

    /**
     * type
     */

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

    /**
     * Insert
     */

    parent.on('insert', function (value) {
        win.webContents.insertText(String(value))
        parent.emit('insert')
    })

    /**
     * screenshot
     */

    parent.on('screenshot', function (clip) {
        // https://gist.github.com/twolfson/0d374d9d7f26eefe7d38
        var args = [function handleCapture(img) {
            parent.emit('screenshot', img.toPng());
        }];
        if (clip) args.unshift(clip);
        win.capturePage.apply(win, args);
    });

    /**
     * pdf
     */

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
            parent.emit('pdf', null, data);
        });
    });

    /**
     * Get cookies
     */

    parent.on('cookie.get', function (query) {
        var details = _.assign({}, {
            url: win.webContents.getURL(),
        }, query)

        parent.emit('log', 'getting cookie: ' + JSON.stringify(details))
        win.webContents.session.cookies.get(details, function (err, cookies) {
            if (err) return parent.emit('cookie.get', err);
            parent.emit('cookie.get', null, details.name ? cookies[0] : cookies)
        })
    })

    /**
     * Set cookies
     */

    parent.on('cookie.set', function (cookies) {
        var pending = cookies.length;
        for (var cookie of cookies) {
            var details = _.assign({}, {
                url: win.webContents.getURL()
            }, cookie)
            
            parent.emit('log', 'setting cookie: ' + JSON.stringify(details))
            win.webContents.session.cookies.set(details, function (err) {
                if (err) parent.emit('cookie.set', err);
                else if (!--pending) parent.emit('cookie.set')
            })
        }
    })

    /**
     * Clear cookie
     */
    parent.on('cookie.clear', function (cookies) {
        var pending = cookies.length;
        parent.emit('log', 'listing params', cookies);

        for (var cookie of cookies) {
            let url = cookie.url || win.webContents.getURL();
            let name = cookie.name;

            parent.emit('log', 'clearing cookie: ' + JSON.stringify(cookie))
            win.webContents.session.cookies.remove(url, name, function (err) {
                if (err) parent.emit('cookie.clear', err);
                else if (!--pending) parent.emit('cookie.clear')
            });
        }
    });

    /**
     * Continue
     */
    parent.on("waitUntilFinishLoad", function () {
        if (!win.webContents.isLoading()) {
            ready();
        }
        else {
            parent.emit('log', 'waiting until resources are finished loading...');
            win.webContents.once('did-finish-load', function () {
                parent.emit('log', 'finished loading ' + win.webContents.getURL());
                ready();
            });
        }

        function ready() {
            parent.emit('waitUntilFinishLoad');
        };
    });

    parent.on('continue', function () {
        if (!win.webContents.isLoading()) {
            ready();
        } else {
            parent.emit('log', 'navigating...');
            win.webContents.once('did-stop-loading', function () {
                parent.emit('log', 'navigated to: ' + win.webContents.getURL());
                ready();
            });
        }

        function ready() {
            parent.emit('continue');
        }
    });

    /**
     * Send "ready" event to the parent process
     */

    parent.emit('ready');
});

/**
 * Forward events
 */

function forward(event) {
    return function (...args) {
        parent.emit.apply(parent, [event].concat(args));
    };
}
