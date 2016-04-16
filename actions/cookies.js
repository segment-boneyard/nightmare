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
        parent.on('cookie.get', function (query) {
            var details = _.assign({}, {
                url: win.webContents.getURL(),
            }, query)

            parent.emit('log', 'getting cookie: ' + JSON.stringify(details))
            win.webContents.session.cookies.get(details, function (err, cookies) {
                if (err) return parent.emit('cookie.get', err);
                parent.emit('cookie.get', {
                    result: details.name ? cookies[0] : cookies
                });
            })
        })
    },
    function (name) {
        debug('cookies.get()')
        let query = {}

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
        parent.on('cookie.set', function (cookies) {
            var pending = cookies.length;
            for (var cookie of cookies) {
                var details = _.assign({}, {
                    url: win.webContents.getURL()
                }, cookie)

                parent.emit('log', 'setting cookie: ' + JSON.stringify(details))
                win.webContents.session.cookies.set(details, function (err) {
                    if (err) parent.emit('cookie.set', {
                        error: err
                    });
                    else if (!--pending) parent.emit('cookie.set')
                })
            }
        })
    },
    function (name, value) {
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
            return this._noop();

        return this._invokeRunnerOperation("cookie.set", cookies);
    }
];

/**
  * Clear a cookie
  */
Nightmare.prototype.cookies.prototype.clear = [
    function (ns, options, parent, win, renderer) {
        parent.on('cookie.clear', function (cookies) {
            var pending = cookies.length;
            parent.emit('log', 'listing params', cookies);

            for (var cookie of cookies) {
                let url = cookie.url || win.webContents.getURL();
                let name = cookie.name;

                parent.emit('log', 'clearing cookie: ' + JSON.stringify(cookie))
                win.webContents.session.cookies.remove(url, name, function (err) {
                    if (err) parent.emit('cookie.clear', {
                        error: err,
                    });
                    else if (!--pending) parent.emit('cookie.clear')
                });
            }
        })
    },
    function(name, url) {
        debug('cookies.clear()');

        let cookies = [];
        if(_.isArray(name))
                cookies = name;
        else if (_.isObject(name))
                cookies.push(name);
        else cookies.push({
            name: name,
            url: url
        });

        if(cookies.length == 0)
                return this._noop();

        return this._invokeRunnerOperation("cookie.clear", cookies);
    }
];

Nightmare.registerNamespace("cookies");