[![Circle CI](https://circleci.com/gh/Oceanswave/nightmare-promise.svg?style=svg)](https://circleci.com/gh/Oceanswave/nightmare-promise)
Nightmare
=========

Nightmare is a high-level browser automation library.

###Nightmare v3

This version of Nightmare relies on promises. The primary API change is that all functions now return promises instead of the this object.

Since all functions return promises, it's easy to synchronize between other Promise-based apis.

```
  Promise.race([nightmare.goto('http://foo.com'), timeout(500)])
    .then(function() {
      console.log("success!");
    }, function() {
      console.log("timed out.");
    });
```

However, Nightmare is still chainable through the .chain() function.

```
  var Nightmare = require("nightmare");
  var title = new Nightmare().chain()
    .goto("http://foo.com")
    .title();
```

All custom functions and namespaces added are chainable thorugh this method. This simplifies the programming and extension model. No more done callback argument mashing either.


Using promises allows nightmare to work better in conjunction with other libraries, but through chain() still retain the original goal of having a simple, non-pyramid-of-doom API that feels synchronous for each block of scripting, rather than deeply nested callbacks.

####Modules

Starting with Nightmare v3 one can choose the specific base functions that are defined on the Nightmare object.

By default, all modules are associated with the nightmare instance whe using require("nightmare"). If you only want to use a portion of the functionality you can include only the modules you're interested in, or, if you're not happy with the included ones, completely rewrite your own actions.

```
const Nightmare = require("nightmare/lib/nightmare"); //require the base nightmare class.
require("nightmare/actions/core"); //only pull in the 'core' set of actions.
```

The available modules are:

* [Core](#core-actions) - Contains the core functionality: evaluate, title, wait and so forth.
* [Cookies](#cookies) - Contains the 'cookies' namespace used to get/set/clear cookies
* [Input](#input-actions) - Contains the functions associated with interacting with a page - typing, setting values, etc.
* [Navigation](#navigation-actions) - Contains the functions associated with navigating - goto, stop, reload and so forth.

####Simpler Extension

Nightmare v3 can be extended by simply adding functions to Nightmare.prototype.

```
Nightmare.prototype.size = function (scale, offset) {
        return this.evaluate_now(function (scale, offset) {
            var w = Math.max(document.documentElement.clientWidth, window.innerWidth || 0)
            var h = Math.max(document.documentElement.clientHeight, window.innerHeight || 0)
            return {
                height: h,
                width: w,
                scaledHeight: h * scale + offset,
                scaledWidth: w * scale + offset
            };
        }, scale, offset)
    };

var scaleFactor = 2.0;
var offsetFactor = 1;

var size = yield nightmare.chain()
	.goto(fixture('simple'))
	.size(scaleFactor, offsetFactor)
```

This simplifies creating extensions and lets IDEs with autocomplete pick up the API automatically. Arguments don't need to be specially handled to support done() -- simply return a promise.

The chain() method will pickup all functions associated with the prototype and make them chainable so you don't have to explicitly return the this object.

See [Nightmare.prototype](#nightmareprototype) for more information.

#### Migration from v2 to v3

* Ensure that all instances are created with ```new Nightmare(...);```
* When chaining functionality, add the .chain() method. e.g. ``` let nightmare = new Nightmare(); nightmare.chain().goto("http://www.github.com").title(); ```
* Ensure that ```.init()``` is called if ```.chain()``` isn't the first function called.

####About

Under the covers it uses [Electron](http://electron.atom.io/), which is similar to [PhantomJS](http://phantomjs.org/) but faster and more modern.

[Daydream](https://github.com/segmentio/daydream) is a complementary chrome extension built by [@stevenmiller888](https://github.com/stevenmiller888) that generates Nightmare scripts for you while you browse.

Many thanks to [@matthewmueller](https://github.com/matthewmueller) for his help on Nightmare.

## Nightmare Documentation

* [Examples](#examples)
* [API](#api)
  - [Set up an instance](#new-nightmareoptions)
  - [Nightmare Lifecycle](#nightmare-lifecycle)
  - Actions
    - [Core Actions](#core-actions)
    - [Navigation Actions](#navigation-actions)
    - [Input Actions](#input-actions)
    - [Cookie Actions](#cookies)
  - [Events](#events)
  - [Extending Nightmare](#extending-nightmare)
* [Usage](#usage)
* [Debugging](#debugging)

## Examples

Let's search on Yahoo:

```js
var Nightmare = require('nightmare');
var nightmare = new Nightmare({ show: true })

nightmare.chain()
  .goto('http://yahoo.com')
  .type('form[action*="/search"] [name=p]', 'github nightmare')
  .click('form[action*="/search"] [type=submit]')
  .wait('#main')
  .evaluate(function () {
    return document.querySelector('#main .searchCenterMiddle li a').href
  })
  .end()
  .then(function (result) {
    console.log(result)
  })
  .catch(function (error) {
    console.error('Search failed:', error);
  });

```

You can run this with:

```shell
npm install nightmare
node yahoo.js
```

Or, let's run some mocha tests:

```js
var Nightmare = require('nightmare');
var expect = require('chai').expect; // jshint ignore:line

describe('test yahoo search results', function() {
  it('should find the nightmare github link first', function*() {
    var nightmare = new Nightmare()
    var link = yield nightmare.chain()
      .goto('http://yahoo.com')
      .type('form[action*="/search"] [name=p]', 'github nightmare')
      .click('form[action*="/search"] [type=submit]')
      .wait('#main')
      .evaluate(function () {
        return document.querySelector('#main .searchCenterMiddle li a').href
      })
    expect(link).to.equal('https://github.com/segmentio/nightmare');
  });
});
```

You can see examples of every function [in the tests here](https://github.com/segmentio/nightmare/blob/master/test/index.js).

Please note that the examples are using the [mocha-generators](https://www.npmjs.com/package/mocha-generators)
package for Mocha, which enables the support for generators.

### To install dependencies

    npm install

### To run the mocha tests

    npm test

## API

#### new Nightmare(options)
Create a new instance that can navigate around the web. The available options are [documented here](https://github.com/atom/electron/blob/master/docs/api/browser-window.md#new-browserwindowoptions), along with the following nightmare-specific options.

##### waitTimeout (default: 30s)
This will throw an exception if the `.wait()` didn't return `true` within the set timeframe.

```js
var nightmare = new Nightmare({
  waitTimeout: 1000 // in ms
});
```

##### paths
The default system paths that Electron knows about. Here's a list of available paths: https://github.com/atom/electron/blob/master/docs/api/app.md#appgetpathname

You can overwrite them in Nightmare by doing the following:

```js
var nightmare = new Nightmare({
  paths: {
    userData: '/user/data'
  }
});
```

##### switches
The command line switches used by the Chrome browser that are also supported by Electron. Here's a list of supported Chrome command line switches:
https://github.com/atom/electron/blob/master/docs/api/chrome-command-line-switches.md

```js
var nightmare = new Nightmare({
  switches: {
    'proxy-server': '1.2.3.4:5678',
    'ignore-certificate-errors': true
  }
});
```

##### electronPath
The path to prebuilt Electron binary.  This is useful for testing on different version Electron.  Note that Nightmare only supports the version this package depending on.  Please use this option at your own risk.

```js
var nightmare = new Nightmare({
  electronPath: require('electron-prebuilt')
});
```

##### dock (OS X)
A boolean to optionally show the Electron icon in the dock (defaults to `false`).  This is useful for testing purposes.

```js
var nightmare = new Nightmare({
  dock: true
});
```
#### Nightmare Lifecycle

With Nightmare v3, once a new Nightmare instance is created, the instance must first be initialized with the .init() function prior to calling any page interaction functions.

```
   var nightmare = new Nightmare();
   yield nightmare.init();
   yield nightmare.goto("http://foo.com");
```

*Eventually, it will be possible to attach to an existing Electron instance by providing it as an argument to the init function.*

##### Chain
With Nightmare v3, all functions return promises, however, the API can still be chained using the .chain() function which dynamically creates a chainable promise:

```
   var nightmare = new Nightmare();
   yield nightmare.chain()
      .goto("http://foo.com")
      .type('input[title="Search"]', 'github nightmare')
      .click('#UHSearchWeb')
      .wait('#main');
```

Nightmare calls the initialization function if it has not been called when running the chain.

##### .end()
Complete any queue operations, disconnect and close the electron process.

##### .inject(type, file)
Inject a local `file` onto the current page. The file `type` must be either `js` or `css`.

##### .header([header, value])
Add a header override for all HTTP requests.  If `header` is undefined, the header overrides will be reset.

#### Core Actions

##### .engineVersions()
Gets the versions for Electron and Chromium.

##### .evaluate(fn[, arg1, arg2,...])
Invokes `fn` on the page with `arg1, arg2,...`. All the `args` are optional. On completion it returns the return value of `fn`. Useful for extracting information from the page. Here's an example:

```js
var selector = 'h1';
var text = yield nightmare
  .evaluate(function (selector) {
    // now we're executing inside the browser scope.
    return document.querySelector(selector).innerText;
   }, selector); // <-- that's how you pass parameters from Node scope to browser scope
```

##### .evaluateAsync(fn[, arg1, arg2,...])
Evaluates an asynchronous function on the page and waits until the returned promise/generator/thenable/callback completes.

##### .exists(selector)
Returns whether the selector exists or not on the page.

##### .getClientRects(selector)
Returns the client rectangle for the selector.

##### .html(path, saveType)
Save the current page as html as files to disk at the given path. Save type options are [here](https://github.com/atom/electron/blob/master/docs/api/web-contents.md#webcontentssavepagefullpath-savetype-callback).

##### .pdf(path, options)
Saves a PDF to the specified `path`. Options are [here](https://github.com/atom/electron/blob/v0.35.2/docs/api/web-contents.md#webcontentsprinttopdfoptions-callback).

##### .screenshot([path][, clip])
Takes a screenshot of the current page. Useful for debugging. The output is always a `png`. Both arguments are optional. If `path` is provided, it saves the image to the disk. Otherwise it returns a `Buffer` of the image data. If `clip` is provided (as [documented here](https://github.com/atom/electron/blob/master/docs/api/browser-window.md#wincapturepagerect-callback)), the image will be clipped to the rectangle.

##### .setAudioMuted(audioMuted)
Set if audio is muted on the electron process.

##### .setAuthenticationCredentials(username, password)
Sets authentication credentials that will be supplied if prompted for a basic/digest login.

##### .title()
Returns the title of the current page.

##### .url()
Returns the url of the current page.

##### .useragent(useragent)
Set the `useragent` used by electron.

##### .viewport(width, height)
Set the viewport size.

##### .visible(selector)
Returns whether the selector is visible or not

##### .wait(ms)
Wait for `ms` milliseconds e.g. `.wait(5000)`

##### .wait(selector)
Wait until the element `selector` is present e.g. `.wait('#pay-button')`

##### .wait(fn[, arg1, arg2,...])
Wait until the `fn` evaluated on the page with `arg1, arg2,...` returns `true`. All the `args` are optional. See `.evaluate()` for usage.

##### Nightmare.version
Returns the version of Nightmare.

#### Navigation actions

##### .back()
Go back to the previous page.

##### .forward()
Go forward to the next page.

##### .goto(url)
Load the page at `url`. Optionally, a `headers` hash can be supplied to set headers on the `goto` request.

When a page load is successful, `goto` returns an object with metadata about the page load, including:

- `url`: The URL that was loaded
- `code`: The HTTP status code (e.g. 200, 404, 500)
- `method`: The HTTP method used (e.g. "GET", "POST")
- `referrer`: The page that the window was displaying prior to this load or an empty string if this is the first page load.
- `headers`: An object representing the response headers for the request as in `{header1-name: header1-value, header2-name: header2-value}`

If the page load fails, the error will be an object wit the following properties:

- `message`: A string describing the type of error
- `code`: The underlying error code describing what went wrong. Note this is NOT the HTTP status code. For possible values, see https://code.google.com/p/chromium/codesearch#chromium/src/net/base/net_error_list.h
- `details`: A string with additional details about the error. This may be null or an empty string.
- `url`: The URL that failed to load

Note that any valid response from a server is considered “successful.” That means things like 404 “not found” errors are successful results for `goto`. Only things that would cause no page to appear in the browser window, such as no server responding at the given address, the server hanging up in the middle of a response, or invalid URLs, are errors.

##### .refresh()
Refresh the current page using window.location.reload.

##### .reload()
Reloads the current page via electron.

##### .stop()
Stops the loading of the page.

#### Input Actions

##### .blur(selector)
Blurs the specified selector.

##### .click(selector)
Clicks the `selector` element once.

##### .clickAndWaitUntilFinishLoad(selector)
Clicks the `selector` element once and waits until a navigation event completes (Useful for clicking on links)

##### .check(selector)
Checks the `selector` checkbox element.

##### .emulateClick(selector)
Emulates a click event using electron's sendInputEvent command.

##### .emulateKeystrokes(selector)
Emulates keystrokes using electron's sendInputEvent command.

##### .expectNavigation(fn, timeout)
Returns a promise which invokes the specified action which expects to perform a navigation action.

##### .focus(selector)
Sets focus on the specified selector.

##### .insert(selector[, text])
Similar to `.type()`. `.insert()` enters the `text` provided into the `selector` element.  Empty or falsey values provided for `text` will clear the selector's value.

`.insert()` is faster than `.type()` but does not trigger the keyboard events.

##### .mousedown(selector)
Mousedown the `selector` element once.

##### .mouseover(selector)
Hover over the `selector` element once.

##### .scrollTo(top, left)
Scrolls the page to desired position. `top` and `left` are always relative to the top left corner of the document.

##### .select(selector, option)
Changes the `selector` dropdown element to the option with attribute [value=`option`]

##### .type(selector[, text])
Enters the `text` provided into the `selector` element.  Empty or falsey values provided for `text` will clear the selector's value.

`.type()` mimics a user typing in a textbox and will emit the proper keyboard events

Key presses can also be fired using Unicode values with `.type()`. For example, if you wanted to fire an enter key press, you would  write `.type('document', '\u000d')`. 

> If you don't need the keyboard events, consider using `.insert()` instead as it will be faster and more robust.

##### .uncheck(selector)
unchecks the `selector` checkbox element.

#### Cookies

##### .cookies.get(name)

Get a cookie by it's `name`. The url will be the current url.

##### .cookies.get(query)

Query multiple cookies with the `query` object. If a `query.name` is set, it will return the first cookie it finds with that name, otherwise it will query for an array of cookies. If no `query.url` is set, it will use the current url. Here's an example:

```js
// get all google cookies that are secure
// and have the path `/query`
var cookies = yield nightmare.chain()
  .goto('http://google.com')
  .cookies.get({
    path: '/query',
    secure: true
  })
```

Available properties are documented here: https://github.com/atom/electron/blob/master/docs/api/session.md#sescookiesgetdetails-callback

##### .cookies.get()

Get all the cookies for the current url. If you'd like get all cookies for all urls, use: `.get({ url: null })`.

##### .cookies.set(name, value)

Set a cookie's `name` and `value`. Most basic form, the url will be the current url.

##### .cookies.set(cookie)

Set a `cookie`. If `cookie.url` is not set, it will set the cookie on the current url. Here's an example:

```js
yield nightmare.chain()
  .goto('http://google.com')
  .cookies.set({
    name: 'token',
    value: 'some token',
    path: '/query',
    secure: true
  })
```

Available properties are documented here:  https://github.com/atom/electron/blob/master/docs/api/session.md#sescookiessetdetails-callback

##### .cookies.set(cookies)

Set multiple cookies at once. `cookies` is an array of `cookie` objects. Take a look at the `.cookies.set(cookie)` documentation above for a better idea of what `cookie` should look like.

##### .cookies.clear(name)

Clear a cookie for the current domain.

```js
yield nightmare.chain()
  .goto('http://google.com')
  .cookies.clear('SomeCookieName');
```

#### Events

###### .on(event, callback)
Capture page events with the callback. You have to call `.on()` before calling `.goto()`. Supported events are [documented here](http://electron.atom.io/docs/v0.30.0/api/browser-window/#class-webcontents).

##### "page" events

Listen for `window.addEventListener('error')`, `alert(...)`, `prompt(...)` & `confirm(...)`.

###### .on('page', function(type="error", message, stack))

Listen for top-level page errors. This will get triggered when an error is thrown on the page.

###### .on('page', function(type="alert", message))

Nightmare disables `window.alert` from popping up by default, but you can still listen for the contents of the alert dialog.

###### .on('page', function(type="prompt", message, response))

Nightmare disables `window.prompt` from popping up by default, but you can still listen for the message to come up. If you need to handle the confirmation differently, you'll need to use your own preload script.

###### .on('page', function(type="confirm", message, response))

Nightmare disables `window.confirm` from popping up by default, but you can still listen for the message to come up. If you need to handle the confirmation differently, you'll need to use your own preload script.

###### .on('page', function(type="error", message, stack))
This event is triggered if any javascript exception is thrown on the page. But this event is not triggered if the injected javascript code (e.g. via `.evaluate()`) is throwing an exception.

##### "console" events

Listen for `console.log(...)`, `console.warn(...)`, and `console.error(...)`.

###### .on('console', function(type [, arguments, ...]))

`type` will be either `log`, `warn` or `error` and `arguments` are what gets passed from the console.

###### .on('console', function(type, errorMessage, errorStack))
This event is triggered if `console.log` is used on the page. But this event is not triggered if the injected javascript code (e.g. via `.evaluate()`) is using `console.log`.

### Extending Nightmare

#### Nightmare.prototype

With nightmare v3 the primary mechanism of adding custom behavior is by adding functions to the prototype. This is how Nightmare v3 implements its actions itself.

Functions added to the prototype can be simple prototype functions that can return promises or values. Callback functions can be utilized, but are not required. Custom functions can be generators as well.

```
Nightmare.prototype.size = function (scale, offset) {
                return this.evaluate_now(function (scale, offset) {
                    var w = Math.max(document.documentElement.clientWidth, window.innerWidth || 0)
                    var h = Math.max(document.documentElement.clientHeight, window.innerHeight || 0)
                    return {
                        height: h,
                        width: w,
                        scaledHeight: h * scale + offset,
                        scaledWidth: w * scale + offset
                    };
                }, scale, offset)
            };
```

As described above, the built-in chain() function will make all functions exposed on the nightmare prototype chainable, so the 'this' object need not be returned by the extension function.

Thus, the above custom action can be called simply by:
```
let scaleFactor = 2.0;
let offsetFactor = 1;

let nightmare = new Nightmare();
let size = yield nightmare.chain()
	.goto('http://www.github.com')
	.size(scaleFactor, offsetFactor);
```

Custom 'namespaces' can be implemented by adding a psudo-class and calling the static function 'registerNamespace':

```
'use strict';
Nightmare.prototype.MyStyle = class {
	*background() {
	    return yield this.evaluate_now(function () {
	        return window.getComputedStyle(document.body, null).backgroundColor;
	    })
	}
	*color() {
	    return yield this.evaluate_now(function () {
	        return window.getComputedStyle(document.body, null).color;
	    })
	}
};

Nightmare.registerNamespace("MyStyle");
```

Nightmare v3 will automatically make these chainable as well.

```
let nightmare = new Nightmare();
let color = yield nightmare.chain()
        .goto('http://www.github.com')
        .MyStyle.background()
        .MyStyle.color();
```

Custom electron behaviors can be attached by adding tuples of [ {electron function}, {function} ]to the Nightmare prototype. For instance:

```
Nightmare.prototype.getTitle = [
        function (ns, options, parent, win, renderer) {
            parent.on('getTitle', function () {
                parent.emit('getTitle', {
                    result: win.webContents.getTitle()
                });
            });
        },
        function (path, saveType) {
            return this._invokeRunnerOperation("getTitle", path, saveType);
        }
    ];

    let title = yield nightmare.chain()
        .goto("http://www.github.com")
        .getTitle();
```

These tuples are automatically detached from the prototype by the Nightmare init() function, so if they are mutated later it doesn't affect existing instances.

Namespaces with custom electron actions can be defined too. See the mocha tests for examples.

#### Nightmare.action(name, action|namespace)

While in v3 extending nightmare through Nightmare.prototype is favored, the .action function is still retained for backward compatability. Here's an example:

```js
Nightmare.action('size', function () {
  this.evaluate_now(function() {
    var w = Math.max(document.documentElement.clientWidth, window.innerWidth || 0)
    var h = Math.max(document.documentElement.clientHeight, window.innerHeight || 0)
    return {
      height: h,
      width: w
    }
  })
})

var size = yield new Nightmare().chain()
  .goto('http://cnn.com')
  .size()
```

However, what is this is doing is associating a 'size' function property on the Nightmare prototype for you.

Any functions defined on the prototype can be called using the this. object. In Nightmare v3 the only difference between ```evaluate_now``` and ```evaluate``` is that evaluate checks that the argument passed is a function. Both return promises.

We can also create custom namespaces. We do this internally for `nightmare.cookies.get` and `nightmare.cookies.set`. These are useful if you have a bundle of actions you want to expose, but it will clutter up the main nightmare object. Here's an example of that:

```js
Nightmare.action('style', {
  background: function (done) {
    this.evaluate_now(function () {
      return window.getComputedStyle(document.body, null).backgroundColor
    }, done)
  }
})

var background = yield new Nightmare()
  .chain()
  .goto('http://google.com')
  .style.background()
```

#### .use(plugin)

`nightmare.use` is useful for reusing a set of tasks on an instance. Check out [nightmare-swiftly](https://github.com/segmentio/nightmare-swiftly) for some examples.

#### Custom preload script

If you need to do something custom when you first load the window environment, you
can specify a custom preload script. Here's how you do that:

```js
var nightmare = new Nightmare({
  webPreferences: {
    preload: custom-script.js
  }
})
```

The only requirement for that script is that you'll need the following prelude:

```js
window.__nightmare = {};
__nightmare.ipc = require('ipc');
```

## Usage
#### Installation
Nightmare is a Node.js module, so you'll need to [have Node.js installed](http://nodejs.org/). Then you just need to `npm install` the module:

```bash
$ npm install --save nightmare
```

#### Execution
Nightmare is a node module that can be used in a Node.js script or module. Here's a simple script to open a web page:
```js
var Nightmare = require('nightmare');
var nightmare = new Nightmare();

nightmare.chain()
  .goto('http://cnn.com')
  .evaluate(function(){
    return document.title;
  })
  .end()
  .then(function(title){
    console.log(title);
  })
```
If you save this as `cnn.js`, you can run it on the command line like this:

```bash
npm install nightmare
node cnn.js
```

#### Debugging
There are three good ways to get more information about what's happening inside the headless browser:

1. Use the `DEBUG=*` flag described below.
2. Pass `{ show: true }` to the [nightmare constructor](#nightmareoptions) to have it create a visible, rendered window that you can watch what's happening.
3. Listen for [specific events](#onevent-callback).

To run the same file with debugging output, run it like this `DEBUG=nightmare node --harmony cnn.js` (on Windows use `set DEBUG=nightmare & node cnn.js`).

This will print out some additional information about what's going on:

```bash
  nightmare queueing action "goto" +0ms
  nightmare queueing action "evaluate" +4ms
  Breaking News, U.S., World, Weather, Entertainment & Video News - CNN.com
```

##### Debug Flags

All nightmare messages

`DEBUG=nightmare*`

Only actions

`DEBUG=nightmare:actions*`

Only events

`DEBUG=nightmare:eventLog*`

Only logs

`DEBUG=nightmare:log*`

Verbose messages

`DEBUG=nightmare:verbose*`

#### Tests
Automated tests for nightmare itself are run using [Mocha](http://mochajs.org/) and Chai, both of which will be installed via `npm install`. To run nightmare's tests, just run `make test`.

When the tests are done, you'll see something like this:

```bash
make test
  ․․․․․․․․․․․․․․․․․․
  118 passing (1m)
```

Note that if you are using `xvfb`, `make test` will automatically run the tests under an `xvfb-run` wrapper.  If you are planning to run the tests headlessly without running `xvfb` first, set the `HEADLESS` environment variable to `0`.

## License (MIT)

```
WWWWWW||WWWWWW
 W W W||W W W
      ||
    ( OO )__________
     /  |           \
    /o o|    MIT     \
    \___/||_||__||_|| *
         || ||  || ||
        _||_|| _||_||
       (__|__|(__|__|
```

Copyright (c) 2015 Segment.io, Inc. <friends@segment.com>

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the 'Software'), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED 'AS IS', WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
