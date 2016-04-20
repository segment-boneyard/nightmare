"use strict";

const debug = require("debug")("nightmare:navigation");
const Nightmare = require("../lib/nightmare");

/**
  * Go back to previous url.
  */
Nightmare.prototype.back = [
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
    }];

/**
 * Go forward to next url.
 */
Nightmare.prototype.forward = [
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
    }];


/**
 * Instructs the browser to go to a specific url and wait until loading completes.
 * If the browser is currently at the specified URL, no action is taken.
 */
Nightmare.prototype.goto = [
    function (ns, options, parent, win, renderer) {
        const electron = require('electron');
        const urlFormat = require('url');

        const KNOWN_PROTOCOLS = ['http', 'https', 'file', 'about'];

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
                var responseData = {};

                let resolveGoto = function (message) {
                    done({
                        result: responseData
                    });
                };

                let rejectGoto = function (event, code, detail, failedUrl, isMainFrame) {
                     if (!isMainFrame)
                        return;

                     done({
                            err: {
                            message: 'navigation error',
                            code: code,
                            details: detail,
                            url: failedUrl || url
                          }
                     });
                };

                let getDetails = function(event, status, newUrl, oldUrl, statusCode, method, referrer, headers, resourceType) {

                    if (resourceType != 'mainFrame')
                        return;
                    
                    responseData = {
                        url: newUrl,
                        code: statusCode,
                        method: method,
                        referrer: referrer,
                        headers: headers
                    };
                };

                let done = function(data) {
                    win.webContents.removeListener('did-fail-load', rejectGoto);
                    win.webContents.removeListener('did-get-response-details', getDetails);
                    win.webContents.removeListener('did-finish-load', resolveGoto);
                    // wait a tick before notifying to resolve race conditions for events
                    setImmediate(() => parent.emit('goto', data));
                }

                // In most environments, loadURL handles this logic for us, but in some
                // it just hangs for unhandled protocols. Mitigate by checking ourselves.
                let canLoadProtocol = function(url, callback) {
                    let protocol = (urlFormat.parse(url).protocol || '').replace(/:$/, '');
                    if (!protocol || KNOWN_PROTOCOLS.includes(protocol)) {
                        callback(true);
                        return;
                    }
                    electron.protocol.isProtocolHandled(protocol, callback);
                }

                canLoadProtocol(url, function(canLoadProtocol) {
                    if (canLoadProtocol) {
                        win.webContents.on('did-fail-load', rejectGoto);
                        win.webContents.on('did-get-response-details', getDetails);
                        win.webContents.on('did-finish-load', resolveGoto);

                        win.webContents.loadURL(url, {
                          extraHeaders: extraHeaders
                        });
                        return;
                    }

                    done({
                      err:{
                        message: 'navigation error',
                        code: -300,
                        details: 'ERR_INVALID_URL',
                        url: url
                    }});
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
    }];

/**
 * Refresh the current page.
 */
Nightmare.prototype.refresh = function (ns, options, parent, win, renderer) {
    debug('.refresh()');
    return this.evaluate_now(function () {
        window.location.reload();
    });
};

/**
  * Instructs the browser to reload the page.
  */
Nightmare.prototype.reload = [
    function () {
        parent.on('reload', function () {
            win.webContents.reload();
            parent.emit('reload');
        });
    },
    function () {
        debug('.reload()');
        return this._invokeRunnerOperation("reload");
    }];

/**
  * instructs the browser to stop page loading.
  */
Nightmare.prototype.stop = [
    function (ns, options, parent, win, renderer) {
        parent.on('stop', function () {
            win.webContents.stop();
            parent.emit('stop');
        });
    },
    function () {
        debug('.stop()');

        return this._invokeRunnerOperation("stop");
    }];