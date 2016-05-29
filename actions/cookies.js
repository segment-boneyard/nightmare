"use strict";

const debug = require("debug")("nightmare:cookies");
const Nightmare = require("../lib/nightmare");
const _ = require("lodash");

/**
 * C is for cookie, that's good enough for me.
 */
Nightmare.prototype.cookies = (function () { });

/**
  * Get a cookie
  */
Nightmare.prototype.cookies.prototype.get = [
    function (ns, options, parent, win, renderer) {
        const _ = require("lodash");
        parent.respondTo('cookie.get', function (query, done) {
            var details = _.assign({}, {
                url: win.webContents.getURL(),
            }, query);

            parent.emit('log', 'getting cookie: ' + JSON.stringify(details));
            win.webContents.session.cookies.get(details, function (err, cookies) {
                if (err) return done.reject(err);
                done.resolve(details.name ? cookies[0] : cookies);
            });
        });
    },
    function (name) {
        debug('cookies.get()');
        let query = {};

        if (_.isObject(name))
            query = name;
        else
            query.name = name;

        return this._invokeRunnerOperation("cookie.get", query);
    }
];

/**
  * Set a cookie
  */
Nightmare.prototype.cookies.prototype.set = [
    function (ns, options, parent, win, renderer) {
        const _ = require("lodash");
        parent.respondTo('cookie.set', function (cookies, done) {
            var pending = cookies.length;
            for (var cookie of cookies) {
                _.assign(cookie, {
                    url: win.webContents.getURL()
                });

                parent.emit('log', 'setting cookie: ' + JSON.stringify(cookie));
                win.webContents.session.cookies.set(cookie, function (err) {
                    if (err) return done.reject(err);
                    if (!--pending) done.resolve();
                });
            }
        });
    },
    function (name, value) {
        debug('cookies.set()');

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
            return this._noop();

        return this._invokeRunnerOperation("cookie.set", cookies);
    }
];

/**
  * Clear a cookie
  */
Nightmare.prototype.cookies.prototype.clear = [
    function (ns, options, parent, win, renderer) {
        parent.respondTo('cookie.clear', function (cookies, done) {
            let currentUrl = win.webContents.getURL();
            let getCookies = (cb) => cb(null, cookies);

            if (!cookies || cookies.length == 0) {
                getCookies = (cb) => win.webContents.session.cookies.get({ url: currentUrl }, (error, cookies) => {
                    cb(error, cookies);
                });
            }

            getCookies((error, cookies) => {
                let pending = cookies.length;

                for (let cookie of cookies) {
                    let url = cookie.url || currentUrl;
                    let name = cookie.name;

                    parent.emit('log', 'clearing cookie: ' + JSON.stringify(cookie));
                    win.webContents.session.cookies.remove(url, name, function (err) {
                        if (err) return done.reject(err);
                        if (!--pending) done.resolve();
                    });
                }
            });

        });
    },
    function (name, url) {
        debug('cookies.clear()');

        let cookies = [];
        if (_.isArray(name))
            cookies = name;
        else if (_.isString(name))
            cookies.push({
                name: name,
                url: url
            });
        else if (_.isObject(name) && name.name)
            cookies.push(name);

        return this._invokeRunnerOperation("cookie.clear", cookies);
    }
];

Nightmare.registerNamespace("cookies");