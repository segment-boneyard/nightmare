"use strict";

const debug = require("debug")("nightmare:input");
const Nightmare = require("../lib/nightmare");
const co = require("co");
const _ = require("lodash");
const delay = require("delay");

/**
  * Click an element using a JavaScript based event.
  *
  * @param {String} selector
  */
Nightmare.prototype.click = function (selector) {
    debug('.click() on ' + selector);
    return this.evaluate_now(function (selector) {
        document.activeElement.blur();
        var element = document.querySelector(selector);
        var event = document.createEvent('MouseEvent');
        event.initEvent('click', true, true);
        element.dispatchEvent(event);
    }, selector);
};

/**
  * Click an element and wait until the next load operation completes.
  * Use this function when you expect a click to perform a navigation action, usually on anchor elements, but elsewhere too.
  *
  * @param {String} selector
  */
Nightmare.prototype.clickAndWaitUntilFinishLoad = function (selector) {
    debug('.clickAndWaitUntilFinishLoad() on ' + selector);

    let child = this.child;
    let waitUntilFinishLoadPromise = this._invokeRunnerOperation("waitUntilFinishLoad");

    let clickPromise = this.evaluate_now(function (selector) {
        document.activeElement.blur();
        var element = document.querySelector(selector);
        var event = document.createEvent('MouseEvent');
        event.initEvent('click', true, true);
        element.dispatchEvent(event);
    }, selector);

    return Promise.all([clickPromise, waitUntilFinishLoadPromise]);
};


/**
  * Check a checkbox, fire change event
  *
  * @param {String} selector
  */
Nightmare.prototype.check = function (selector) {
    debug('.check() ' + selector);
    return this.evaluate_now(function (selector) {
        var element = document.querySelector(selector);
        var event = document.createEvent('HTMLEvents');
        element.checked = true;
        event.initEvent('change', true, true);
        element.dispatchEvent(event);
    }, selector);
};

/**
  * Click an element using electron's sendInputEvent command.
  *
  * @param {String} selector
  */
Nightmare.prototype.emulateClick = [
    function (ns, options, parent, win, renderer) {
        const _ = require("lodash");
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
    }];

/**
  * Emulates keystrokes using electron's sendInputEvent command.
  *
  * @param {String} selector
  */
Nightmare.prototype.emulateKeystrokes = [
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
    }];

/**
 * Returns a promise which invokes the specified action which expects to perform a navigation action.
 */
Nightmare.prototype.expectNavigation = function (fn, timeout) {
    if (!timeout)
        timeout = this._options.waitTimeout;

    let waitPromise = Promise.all([this.waitUntilFinishLoad(), fn.apply(this)]);

    let timeoutPromise = new Promise(function (resolve, reject) {
        setTimeout(reject, timeout, ".expectNavigation() timed out after " + timeout);
    });
    return Promise.race([waitPromise, timeoutPromise]);
};


/**
  * Insert text
  *
  * @param {String} selector
  * @param {String} text
  */
Nightmare.prototype.insert = [
    function (ns, options, parent, win, renderer) {
        parent.on('insert', function (value) {
            win.webContents.insertText(String(value))
            parent.emit('insert')
        })
    },
    function (selector, text) {
        debug('.insert() %s into %s', text, selector);

        let self = this;
        return co(function* () {
            if (!text) {
                return self.evaluate_now(function (selector) {
                    document.querySelector(selector).focus();
                    document.querySelector(selector).value = '';
                }, selector);
            } else {
                try {
                    yield self.evaluate_now(function (selector) {
                        document.querySelector(selector).focus();
                    }, selector);
                }
                catch (ex) {
                    throw ex;
                }

                return self._invokeRunnerOperation("insert", text);
            }
        });
    }];

/**
  * Mousedown on an element.
  *
  * @param {String} selector
  */
Nightmare.prototype.mousedown = function (selector) {
    debug('.mousedown() on ' + selector);
    return this.evaluate_now(function (selector) {
        var element = document.querySelector(selector);
        var event = document.createEvent('MouseEvent');
        event.initEvent('mousedown', true, true);
        element.dispatchEvent(event);
    }, selector);
};

/**
 * Hover over an element.
 *
 * @param {String} selector
 * @param {Function} done
 */
Nightmare.prototype.mouseover = function (selector) {
    debug('.mouseover() on ' + selector);
    return this.evaluate_now(function (selector) {
        var element = document.querySelector(selector);
        var event = document.createEvent('MouseEvent');
        event.initMouseEvent('mouseover', true, true);
        element.dispatchEvent(event);
    }, selector);
};


/**
  * Set the scroll position.
  *
  * @param {Number} x
  * @param {Number} y
  */
Nightmare.prototype.scrollTo = function (y, x) {
    debug('.scrollTo()');

    if (!x && _.isString(y)) {
        return this.evaluate_now(function (selector) {
            var element = document.querySelector(selector);
            if (element) {
                var rect = element.getBoundingClientRect();
                window.scrollTo(Math.round(rect.left), Math.round(rect.top));
            }
            else
                throw 'invalid selector "' + selector + '"';
        }, y);
    }
    else if (_.isNumber(x) && _.isNumber(x)) {
        return this.evaluate_now(function (y, x) {
            window.scrollTo(x, y);
        }, y, x);
    }
};

/**
  * Choose an option from a select dropdown
  *
  * @param {String} selector
  * @param {String} option value
  */
Nightmare.prototype.select = function (selector, option) {
    debug('.select() ' + selector);
    return this.evaluate_now(function (selector, option) {
        var element = document.querySelector(selector);
        var event = document.createEvent('HTMLEvents');
        element.value = option;
        event.initEvent('change', true, true);
        element.dispatchEvent(event);
    }, selector, option);
};


/**
 * Type into an element.
 *
 * @param {String} selector
 * @param {String} text
 */
Nightmare.prototype.type = [
    function (ns, options, parent, win, renderer) {
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
    },
    function () {
        let selector = arguments[0], text;
        if (arguments.length == 2) {
            text = arguments[1];
        }

        debug('.type() %s into %s', text, selector);
        let child = this.child;
        let self = this;
        return co(function* () {
            if (!text) {
                return self.evaluate_now(function (selector) {
                    document.querySelector(selector).focus();
                    document.querySelector(selector).value = '';
                }, selector);
            } else {
                try {
                    yield self.evaluate_now(function (selector) {
                        document.querySelector(selector).focus();
                    }, selector);
                }
                catch (ex) {
                    throw ex;
                }

                return self._invokeRunnerOperation("type", text);
            }
        });
    }];


/*
 * Uncheck a checkbox, fire change event
 *
 * @param {String} selector
 */
Nightmare.prototype.uncheck = function (selector) {
    debug('.uncheck() ' + selector);
    return this.evaluate_now(function (selector) {
        var element = document.querySelector(selector);
        var event = document.createEvent('HTMLEvents');
        element.checked = null;
        event.initEvent('change', true, true);
        element.dispatchEvent(event);
    }, selector);
};