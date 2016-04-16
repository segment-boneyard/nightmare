"use strict";

const debug = require("debug")("nightmare:emulateInput");
const co = require("co");
const Nightmare = require("../lib/nightmare");
const _ = require("lodash");
const delay = require("delay");

/**
  * Click an element using electron's sendInputEvent command.
  *
  * @param {String} selector
  */
Nightmare.action("emulateClick",
    function (ns, options, parent, win, renderer) {
        //Retrieves the specified element from clickOpts.selector and clicks it using webContents.sendInputEvent.
        parent.on('emulateClick', function (clickOpts) {
            const _ = require("lodash");
            clickOpts = _.defaults(clickOpts, {
                button: "left",
                clickCount: 1,
                clickDelay: 25
            });

            var x = Math.round(clickOpts.x);
            var y = Math.round(clickOpts.y);
            parent.emit("log", "clicking " + x + ", " + y + ".");
            win.webContents.sendInputEvent({ type: 'mouseDown', x: x, y: y, button: clickOpts.button, clickCount: clickOpts.clickCount });
            setTimeout(function () {
                win.webContents.sendInputEvent({ type: 'mouseUp', x: x, y: y, button: clickOpts.button, clickCount: clickOpts.clickCount });
                parent.emit("emulateClick", {
                    result: { x: x, y: y }
                });
            }, clickOpts.clickDelay);

        });
    },
    function (y, x) {
        debug('.emulateClick() on ' + y);

        //click the selector at y
        if (_.isString(y) && !x) {
            let self = this;
            return co(function* () {
                let clientRects = yield self.getClientRects(y);
                let rect = clientRects[0];

                let res = {
                    x: Math.floor(rect.left + (rect.width / 2)),
                    y: Math.floor(rect.top + (rect.height / 2))
                };
                debug('.emulateClick() found element at ' + res.x + ", " + res.y);
                return self._invokeRunnerOperation("emulateClick", res);
            });
        }
        //just pass the full object
        else if (_.isObject(y) && !x) {
            return this._invokeRunnerOperation("emulateClick", y);
        }
        //click x, y.
        else {
            return this._invokeRunnerOperation("emulateClick", { x: x, y: y });
        }
    });

/**
     * Click an element using electron's sendInputEvent command.
     *
     * @param {String} selector
     */
Nightmare.action("emulateKeystrokes",
    function (ns, options, parent, win, renderer) {
        const _ = require("lodash");
        const async = require("async");

        parent.on('emulateKeystrokes', function (keystrokeOpts) {
            keystrokeOpts = _.defaults(keystrokeOpts, {
                keyCodes: [],
                keystrokeDelay: 87,
                finalKeystrokeDelay: 500
            });

            var q = async.queue(function (task, callback) {
                parent.emit("log", task.keyCode);
                win.webContents.sendInputEvent({
                    type: 'keyDown',
                    keyCode: task.keyCode,
                    modifier: task.modifier
                });

                if (task.isChar) {
                    win.webContents.sendInputEvent({
                        type: 'char',
                        keyCode: task.keyCode,
                        modifier: task.modifier
                    });
                }

                setTimeout(function () {
                    win.webContents.sendInputEvent({
                        type: 'keyUp',
                        keyCode: task.keyCode,
                        modifiers: task.modifiers
                    });
                    callback();
                }, keystrokeOpts.keystrokeDelay);

            }, 1);

            q.drain = function () {
                //this is to allow the final keyup to be fired.
                setTimeout(function () {
                    parent.emit("emulateKeystrokes");
                }, keystrokeOpts.finalKeystrokeDelay);
            }

            for (var keyCode of keystrokeOpts.keyCodes) {
                q.push(keyCode)
            }
        });
    },
    function (selector, text, opts) {
        if (!text) {
            text = selector;
            selector = null;
        }

        opts = _.defaults(opts, {
            initialFocusDelay: 750,
            finalKeystrokeDelay: 500
        });

        debug('.emulateKeystrokes() on ' + selector);

        let self = this;
        return co(function* () {
            if (selector) {
                yield self.emulateClick(selector)
                yield delay(opts.initialFocusDelay);
            }

            let keyCodes = [];
            if (_.isArray(text))
                keyCodes = text;
            else {
                for (let char of Array.from(text)) {
                    let acc = {
                        keyCode: char,
                        modifiers: [],
                        isChar: true
                    };

                    if (char == char.toUpperCase())
                        acc.modifiers.push("Shift");

                    keyCodes.push(acc);
                }
            }

            return self._invokeRunnerOperation("emulateKeystrokes", { keyCodes: keyCodes, finalKeystrokeDelay: opts.finalKeystrokeDelay });
        });
    });