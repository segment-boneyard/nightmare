"use strict";

const debug = require("debug")("nightmare:navigation");
const Nightmare = require("../lib/nightmare");
const _ = require("lodash");

const DEFAULT_GOTO_TIMEOUT = 30 * 1000;

/**
  * Go back to previous url.
  */
Nightmare.prototype.back = [
    function (ns, options, parent, win, renderer) {
        parent.respondTo('goBack', function (done) {
            if (!win.webContents.canGoBack()) {
                done.reject("Browser unable to go back.");
            } else {
                win.webContents.once('did-finish-load', function () {
                    done.resolve('goBack', win.webContents.getURL());
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
        parent.respondTo('goForward', function (done) {
            if (!win.webContents.canGoForward()) {
                done.reject("Browser unable to go forward.");
            } else {
                win.webContents.once('did-finish-load', function () {
                    done.resolve(win.webContents.getURL());
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

        // URL protocols that don't need to be checked for validity
        const KNOWN_PROTOCOLS = ['http', 'https', 'file', 'about', 'javascript'];

        parent.respondTo('goto', function (url, headers, done) {
            if (!url || typeof url !== 'string') {
                return done.reject('goto: `url` must be a non-empty string');
            }

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
                    cleanup();

                    done.resolve(responseData);
                };

                let rejectGoto = function (event, code, detail, failedUrl, isMainFrame) {
                    if (!isMainFrame)
                        return;

                    cleanup();

                    done.reject({
                        message: 'navigation error',
                        code: code,
                        details: detail,
                        url: failedUrl || url
                    });
                };

                let getDetails = function (event, status, newUrl, oldUrl, statusCode, method, referrer, headers, resourceType) {

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

                let cleanup = function (data) {
                    win.webContents.removeListener('did-fail-load', rejectGoto);
                    win.webContents.removeListener('did-get-response-details', getDetails);
                    win.webContents.removeListener('did-finish-load', resolveGoto);
                    // wait a tick before notifying to resolve race conditions for events
                    //setImmediate(() => parent.emit('goto', data));
                };

                // In most environments, loadURL handles this logic for us, but in some
                // it just hangs for unhandled protocols. Mitigate by checking ourselves.
                let canLoadProtocol = function (protocol, callback) {
                    protocol = (protocol || '').replace(/:$/, '');
                    if (!protocol || KNOWN_PROTOCOLS.includes(protocol)) {
                        callback(true);
                        return;
                    }
                    electron.protocol.isProtocolHandled(protocol, callback);
                };

                var protocol = urlFormat.parse(url).protocol;
                canLoadProtocol(protocol, function (canLoadProtocol) {
                    if (canLoadProtocol) {
                        win.webContents.on('did-fail-load', rejectGoto);
                        win.webContents.on('did-get-response-details', getDetails);
                        win.webContents.on('did-finish-load', resolveGoto);

                        win.webContents.loadURL(url, {
                            extraHeaders: extraHeaders
                        });

                        // javascript: URLs *may* trigger page loads; wait a bit to see
                        if (protocol === 'javascript:') {
                            setTimeout(function () {
                                if (!win.webContents.isLoadingMainFrame()) {
                                    cleanup();
                                    done.resolve({
                                        url: url,
                                        code: 200,
                                        method: 'GET',
                                        referrer: win.webContents.getURL(),
                                        headers: {}
                                    });
                                }
                            }, 10).unref();
                        }
                        return;
                    }

                    cleanup();
                    done.reject({
                        message: 'navigation error',
                        code: -300,
                        details: 'ERR_INVALID_URL',
                        url: url
                    });
                });
            }
        });
    },
    function (url, headers, gotoTimeout) {
        debug('goto() starting navigation to %s', url);

        if (headers && _.isNumber(headers) && !gotoTimeout) {
            gotoTimeout = headers;
            headers = {};
        }

        if (!_.isNumber(gotoTimeout))
            gotoTimeout = this._options.gotoTimeout || DEFAULT_GOTO_TIMEOUT;

        headers = headers || {};
        _.assign(headers, this._headers);

        let timeout = new Promise(function (resolve, reject) {
            setTimeout(reject, gotoTimeout, {
                message: 'navigation error',
                code: -7, // chromium's generic networking timeout code
                details: `.goto() timed out after ${gotoTimeout} ms`,
                url: url
            }).unref();
        });

        return Promise.race([this._invokeRunnerOperation("goto", url, headers), timeout]);
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
        parent.respondTo('reload', function (done) {
            win.webContents.reload();
            done.resolve();
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
        parent.respondTo('stop', function (done) {
            win.webContents.stop();
            done.resolve();
        });
    },
    function () {
        debug('.stop()');

        return this._invokeRunnerOperation("stop");
    }];