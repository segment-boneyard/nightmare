"use strict";
window.__nightmare = {};
__nightmare.ipc = require('ipc');

// Listen for error events
window.addEventListener('error', function (e) {
    __nightmare.ipc.send('page', 'error', e.message, e.error ? e.error.stack : null);
});

(function () {
    // listen for console.log
    var defaultLog = console.log;
    console.log = function () {
        __nightmare.ipc.send('console', 'log', Array.from(arguments));
        return defaultLog.apply(this, arguments);
    };

    // listen for console.warn
    var defaultWarn = console.warn;
    console.warn = function () {
        __nightmare.ipc.send('console', 'warn', Array.from(arguments));
        return defaultWarn.apply(this, arguments);
    };

    // listen for console.error
    var defaultError = console.error;
    console.error = function () {
        __nightmare.ipc.send('console', 'error', Array.from(arguments));
        return defaultError.apply(this, arguments);
    };

    // overwrite the default alert
    window.alert = function (message) {
        __nightmare.ipc.send('page', 'alert', message);
    };

    // overwrite the default prompt
    window.prompt = function (message, defaultResponse) {
        __nightmare.ipc.send('page', 'prompt', message, defaultResponse);
    }

    // overwrite the default confirm
    window.confirm = function (message, defaultResponse) {
        __nightmare.ipc.send('page', 'confirm', message, defaultResponse);
    }
})()
