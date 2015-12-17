[![Build Status](https://circleci.com/gh/segmentio/nightmare.png?circle-token=dbb94336673268633371a89865e008b70ffedf6d)](https://circleci.com/gh/segmentio/nightmare)
Nightmare
=========

Nightmare is a high-level browser automation library.

The goal is to expose just a few simple methods, and have an API that feels synchronous for each block of scripting, rather than deeply nested callbacks. It's designed for automating tasks across sites that don't have APIs.

Under the covers it uses [Electron](http://electron.atom.io/), which is similar to [PhantomJS](http://phantomjs.org/) but faster and more modern.

[Daydream](https://github.com/segmentio/daydream) is a complementary chrome extension built by [@stevenmiller888](https://github.com/stevenmiller888) that generates Nightmare scripts for you while you browse.

Many thanks to [@matthewmueller](https://github.com/matthewmueller) for his help on Nightmare.

* [Examples](#examples)
* [API](#api)
  - [Set up an instance](#nightmareoptions)
  - [Interact with the page](#interact-with-the-page)
  - [Extract from the page](#extract-from-the-page)
  - [Extending Nightmare](#extending-nightmare)
* [Usage](#usage)
* [Debugging](#debugging)

## Examples

Let's search on Yahoo:

```js
var Nightmare = require('nightmare');
var vo = require('vo');

vo(function* () {
  var nightmare = Nightmare({ show: true });
  var link = yield nightmare
    .goto('http://yahoo.com')
    .type('input[title="Search"]', 'github nightmare')
    .click('.searchsubmit')
    .wait('.ac-21th')
    .evaluate(function () {
      return document.getElementsByClassName('ac-21th')[0].href;
    });
  yield nightmare.end();
  return link;
})(function (err, result) {
  if (err) return console.log(err);
  console.log(result);
});
```

You can run this with:

```shell
npm install nightmare vo
node --harmony yahoo.js
```

Or, let's run some mocha tests:

```js
var Nightmare = require('nightmare');
var expect = require('chai').expect; // jshint ignore:line

describe('test yahoo search results', function() {
  it('should find the nightmare github link first', function*() {
    var nightmare = Nightmare()
    var link = yield nightmare
      .goto('http://yahoo.com')
      .type('input[title="Search"]', 'github nightmare')
      .click('.searchsubmit')
      .wait('.ac-21th')
      .evaluate(function () {
        return document.getElementsByClassName('ac-21th')[0].href;
      });
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

#### Nightmare(options)
Create a new instance that can navigate around the web. The available options are [documented here](https://github.com/atom/electron/blob/master/docs/api/browser-window.md#new-browserwindowoptions), along with the following nightmare-specific options.

##### waitTimeout
This will throw an exception if the `.wait()` didn't return `true` within the set timeframe.

```js
var nightmare = Nightmare({
  waitTimeout: 1000 //(ms)
});
```

##### paths
The default system paths that Electron knows about. Here's a list of available paths: https://github.com/atom/electron/blob/master/docs/api/app.md#appgetpathname

You can overwrite them in Nightmare by doing the following:

```js
var nightmare = Nightmare({
  paths: {
    userData: '/user/data'
  }
});
```

##### ['web-preferences'].preloadPath
Specifies an absolute file path to add to Nightmare's preload.  (The generated preload file is written to Electron's `userData` path.)

#### .useragent(useragent)
Set the `useragent` used by electron.

#### .end()
Complete any queue operations, disconnect and close the electron process.

### Interact with the Page

#### .goto(url)
Load the page at `url`.

#### .back()
Go back to the previous page.

#### .forward()
Go forward to the next page.

#### .refresh()
Refresh the current page.

#### .click(selector)
Clicks the `selector` element once.

#### .mousedown(selector)
Mousedown the `selector` element once.

#### .type(selector, text)
Enters the `text` provided into the `selector` element.

#### .check(selector)
Toggles the `selector` checkbox element.

#### .select(selector, option)
Changes the `selector` dropdown element to the option with attribute [value=`option`]

#### .scrollTo(top, left)
Scrolls the page to desired position. `top` and `left` are always relative to the top left corner of the document.

#### .inject(type, file)
Inject a local `file` onto the current page. The file `type` must be either `js` or `css`.

#### .evaluate(fn[, arg1, arg2,...])
Invokes `fn` on the page with `arg1, arg2,...`. All the `args` are optional. On completion it returns the return value of `fn`. Useful for extracting information from the page. Here's an example:

```js
var selector = 'h1';
var text = yield nightmare
  .evaluate(function (selector) {
    // now we're executing inside the browser scope.
    return document.querySelector(selector).innerText;
   }, selector); // <-- that's how you pass parameters from Node scope to browser scope
```

#### .wait(ms)
Wait for `ms` milliseconds e.g. `.wait(5000)`

#### .wait(selector)
Wait until the element `selector` is present e.g. `.wait('#pay-button')`

#### .wait(fn[, arg1, arg2,...])
Wait until the `fn` evaluated on the page with `arg1, arg2,...` returns `true`. All the `args` are optional. See `.evaluate()` for usage.


### Extract from the Page

#### .exists(selector)
Returns whether the selector exists or not on the page.

#### .visible(selector)
Returns whether the selector is visible or not

#### .on(event, callback)
Capture page events with the callback. You have to call `.on()` before calling `.goto()`. Supported events are [documented here](http://electron.atom.io/docs/v0.30.0/api/browser-window/#class-webcontents). Additional to the electron-events we provide a nightmare-event `'page'`.

##### .on('page', type='error', errorMessage, errorStack)
This event is triggered if any javscript exception is thrown on the page. But this event is not triggered if the injected javascript code (e.g. via `.evaluate()`) is throwing an exception.

##### .on('page', type='log', errorMessage, errorStack)
This event is triggered if `console.log` is used on the page. But this event is not triggered if the injected javascript code (e.g. via `.evaluate()`) is using `console.log`.

##### .on('page', type='alert', message)
This event is triggered if `alert` is used on the page.

##### .on('page', type='prompt', message [, response])
This event is triggered if `prompt` is used on the page.  Note that unless `prompt` is overridden in a `preload` script, the prompt will cause an exception to be thrown.

##### .on('page', type='confirm', message [, response])
This event is triggered if `confirm` is used on the page.  Note that unless `confirm` is overridden in a `preload` script, the confirm will cause an exception to be thrown.

#### .screenshot([path][, clip])
Takes a screenshot of the current page. Useful for debugging. The output is always a `png`. Both arguments are optional. If `path` is provided, it saves the image to the disk. Otherwise it returns a `Buffer` of the image data. If `clip` is provided (as [documented here](https://github.com/atom/electron/blob/master/docs/api/browser-window.md#wincapturepagerect-callback)), the image will be clipped to the rectangle.

#### .pdf(path, options)
Saves a PDF to the specified `path`. Options are [here](https://github.com/atom/electron/blob/v0.35.2/docs/api/web-contents.md#webcontentsprinttopdfoptions-callback).

#### .title()
Returns the title of the current page.

#### .url()
Returns the url of the current page.

### Cookies

#### .cookies.get(name)

Get a cookie by it's `name`. The url will be the current url.

#### .cookies.get(query)

Query multiple cookies with the `query` object. If a `query.name` is set, it will return the first cookie it finds with that name, otherwise it will query for an array of cookies. If no `query.url` is set, it will use the current url. Here's an example:

```js
// get all google cookies that are secure
// and have the path `/query`
var cookies = yield nightmare
  .goto('http://google.com')
  .cookies.get({
    path: '/query',
    secure: true
  })
```

Available properties are documented here: https://github.com/atom/electron/blob/master/docs/api/session.md#sescookiesgetdetails-callback

#### .cookies.get()

Get all the cookies for the current url. If you'd like get all cookies for all urls, use: `.get({ url: null })`.

#### .cookies.set(name, value)

Set a cookie's `name` and `value`. Most basic form, the url will be the current url.

#### .cookies.set(cookie)

Set a `cookie`. If `cookie.url` is not set, it will set the cookie on the current url. Here's an example:

```js
yield nightmare
  .goto('http://google.com')
  .cookies.set({
    name: 'token',
    value: 'some token',
    path: '/query',
    secure: true
  })
```

Available properties are documented here:  https://github.com/atom/electron/blob/master/docs/api/session.md#sescookiessetdetails-callback

#### .cookies.set(cookies)

Set multiple cookies at once. `cookies` is an array of `cookie` objects. Take a look at the `.cookies.set(cookie)` documentation above for a better idea of what `cookie` should look like.

### Extending Nightmare

#### Nightmare.action(name, action|namespace)

You can add your own custom actions to the Nightmare prototype. Here's an example:

```js
Nightmare.action('size', function (done) {
  this.evaluate_now(function() {
    var w = Math.max(document.documentElement.clientWidth, window.innerWidth || 0)
    var h = Math.max(document.documentElement.clientHeight, window.innerHeight || 0)
    return {
      height: h,
      width: w
    }
  }, done)
})

var size = yield Nightmare()
  .goto('http://cnn.com')
  .size()
```

> Remember, this is attached to the static class `Nightmare`, not the instance.

You'll notice we used an internal function `evaluate_now`. This function is different than `nightmare.evaluate` because it runs it immediately, whereas `nightmare.evaluate` is queued.

An easy way to remember: when in doubt, use `evaluate`. If you're creating custom actions, use `evaluate_now`. The technical reason is that since our action has already been queued and we're running it now, we shouldn't re-queue the evaluate function.

We can also create custom namespaces. We do this internally for `nightmare.cookies.get` and `nightmare.cookies.set`. These are useful if you have a bundle of actions you want to expose, but it will clutter up the main nightmare object. Here's an example of that:

```js
Nightmare.action('style', {
  background: function (done) {
    this.evaluate_now(function () {
      return window.getComputedStyle(document.body, null).backgroundColor
    }, done)
  }
})

var background = yield Nightmare()
  .goto('http://google.com')
  .style.background()
```

#### .use(plugin)

`nightmare.use` is useful for reusing a set of tasks on an instance. Check out [nightmare-swiftly](https://github.com/segmentio/nightmare-swiftly) for some examples.

## Usage
#### Installation
Nightmare is a Node.js module, so you'll need to [have Node.js installed](http://nodejs.org/). Then you just need to `npm install` the module:

```bash
$ npm install --save nightmare
```

#### Execution
Nightmare is a node module that can be used in a Node.js script or module. Here's a simple script to open a web page:
```js
var Nightmare = require('../nightmare');
var vo = require('vo');

vo(run)(function(err, result) {
  if (err) throw err;
});

function *run() {
  var nightmare = Nightmare();
  var title = yield nightmare
    .goto('http://cnn.com')
    .evaluate(function() {
      return document.title;
    });
  console.log(title);
  yield nightmare.end();
}
```
If you save this as `cnn.js`, you can run it on the command line like this:

```bash
npm install vo nightmare
node --harmony cnn.js
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

#### Tests
Automated tests for nightmare itself are run using [Mocha](http://mochajs.org/) and Chai, both of which will be installed via `npm install`. To run nightmare's tests, just run `make test`.

When the tests are done, you'll see something like this:

```bash
make test
  ․․․․․․․․․․․․․․․․․․
  18 passing (1m)
```

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
