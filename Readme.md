[![Build Status](https://circleci.com/gh/segmentio/nightmare.png?circle-token=dbb94336673268633371a89865e008b70ffedf6d)](https://circleci.com/gh/segmentio/nightmare)
Nightmare
=========

Nightmare is a high level wrapper for [PhantomJS](http://phantomjs.org/) that lets you automate browser tasks.

The goal is to expose just a few simple methods, and have an API that feels synchronous for each block of scripting, rather than deeply nested callbacks. It's designed for automating tasks across sites that don't have APIs.

[Daydream](https://github.com/segmentio/daydream) is a complementary chrome extension built by [@stevenmiller888](https://github.com/stevenmiller888) that generates Nightmare scripts for you while you browse.

* [Examples](#examples)
* [API](#api)
  - [Create an instance](#new-nightmareoptions)
  - [Interact with the page](#interact-with-the-page)
  - [Extract from the page](#extract-from-the-page)
  - [Settings](#settings)
* [Plugins](#plugins)
* [Usage](#usage)

## Examples

Let's search on Yahoo:

```js
var Nightmare = require('nightmare');
new Nightmare()
  .goto('http://yahoo.com')
    .type('input[title="Search"]', 'github nightmare')
    .click('.searchsubmit')
    .run(function (err, nightmare) {
      if (err) return console.log(err);
      console.log('Done!');
    });
```

Or, let's run some mocha tests:

```js
var Nightmare = require('nightmare');
var expect = require('chai').expect; // jshint ignore:line

describe('test yahoo search results', function() {
  this.timeout(30000);

  it('should find the nightmare github link first', function(done) {
    new Nightmare()
      .goto('http://yahoo.com')
        .type('input[title="Search"]', 'github nightmare')
        .click('.searchsubmit')
        .wait('.url.breadcrumb')
        .evaluate(function () {
          return document.querySelector('.url.breadcrumb').innerText;
        }, function (breadcrumb) {
          expect(breadcrumb).to.equal('github.com');
        })
        .run(done);
  });
});
```

Or, here's how you might automate a nicely abstracted login + task on Swiftly:

```js
var Nightmare = require('nightmare');
var Swiftly = require('nightmare-swiftly');
new Nightmare()
  .use(Swiftly.login(email, password))
  .use(Swiftly.task(instructions, uploads, path))
  .run(function(err, nightmare){
    if (err) return fn(err);
    fn();
  });
```

And [here's the `nightmare-swiftly` plugin](https://github.com/segmentio/nightmare-swiftly).

You can see examples of every function [in the tests here](https://github.com/segmentio/nightmare/blob/master/test/index.js).

## API

#### new Nightmare(options)
Create a new instance that can navigate around the web.

The available options are:
* `timeout`: how long to wait for page loads, default `5000ms`.
* `interval`: how frequently to poll for page load state, default `50ms`.
* `port`: port to mount the phantomjs instance to, default `12301`.
* `weak`: set dnode weak option to `false` to fix cpp compilation for windows users, default `true`.
* `loadImages`: load all inlined images, default `true`.
* `ignoreSslErrors`: ignores SSL errors like expired or self-signed certificates, default `true`.
* `sslProtocol`: set the protocol for secure connections `[sslv3|sslv2|tlsv1|any]`, default `any`.
* `webSecurity`: enables web security and forbids cross-domain XHR, default `true`.
* `proxy`: specify the proxy server to use `address:port`, default not set.
* `proxyType`: specify the proxy server type `[http|socks5|none]`, default not set.
* `proxyAuth`: specify the auth information for the proxy `user:pass`, default not set.
* `cookiesFile`: specify the file to store the persistent cookies, default not set.
* `phantomPath`: specify a different custom path to PhantomJS, default not set.


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

#### .type(selector, text)
Enters the `text` provided into the `selector` element.

#### .check(selector)
Toggles the `selector` checkbox element.

#### .select(selector, option)
Changes the `selector` dropdown element to the option with attribute [value=`option`]

#### .upload(selector, path)
Specify the `path` to upload into a file input `selector` element.

#### .scrollTo(top, left)
Scrolls the page to desired position. `top` and `left` are always relative to the top left corner of the document.

#### .inject(type, file)
Inject a local `file` onto the current page. The file `type` must be either 'js' or 'css'.

#### .evaluate(fn, cb, arg1, arg2,...)
Invokes `fn` on the page with `arg1, arg2,...`. All the `args` are optional. On completion it passes the return value of `fn` as to `cb(res)`. Useful for extracting information from the page. Here's an example:

```js
var p1 = 1;
var p2 = 2;

nightmare
  .evaluate(function (param1, param2) {
        // now we're executing inside the browser scope.
        return param1 + param2;
     }, function (result) {
        // now we're inside Node scope again
        console.log( result);
     }, p1, p2 // <-- that's how you pass parameters from Node scope to browser scope
  ) // end evaluate
  .run();
```

#### .wait()
Wait until a page finishes loading, typically after a `.click()`.

#### .wait(ms)
Wait for `ms` milliseconds e.g. `.wait(5000)`

#### .wait(selector)
Wait until the element `selector` is present e.g. `.wait('#pay-button')`

#### .wait(fn, value, [delay])
Wait until the `fn` evaluated on the page returns `value`. Optionally, refresh the page every `delay` milliseconds, and only check after each refresh.

#### .use(plugin)
Useful for using repeated code blocks, see the example with Swiftly login and task creation in the docs above.

#### .run(cb)
Executes the queue of functions, and calls your `cb` when the script hits an error or completes the queue. The callback signature is `cb(err, nightmare)`.


### Extract from the Page

#### .exists(selector,cb)
Determines if the selector exists, or not, on the page. The signature of the callback is `cb(boolean)`.

#### .visible(selector,cb)
Determines if a selector is visible, or not, on the page. The signature of the callback is `cb(boolean)`.

#### .on(event, callback)
Capture page events with the callback. You have to call `.on()` before calling `.goto()`. Supported events are:
* `initialized` - callback()
* `loadStarted` - callback()
* `loadFinished` - callback(status)
* `urlChanged` - callback(targetUrl)
* `navigationRequested` - callback(url, type, willNavigate, main)
* `resourceRequestStarted` - callback(requestData, networkRequest), inside phantomjs context, useful for aborting `networkRequest.abort()` or changing requests `networkRequest.changeUrl(url)`, `networkRequest.setHeader(key, value)`
* `resourceRequested` - callback(requestData), outside phantomjs context, useful for listening for resourceRequests
* `resourceReceived` - callback(response)
* `resourceError` - callback(resourceError)
* `consoleMessage` - callback(msg, lineNumber, sourceId)
* `alert` - callback(msg)
* `confirm` - callback(msg)
* `prompt` - callback(msg, defaultValue)
* `error` - callback(msg, trace)
* `timeout` - callback(msg) fired when a .wait() times out before condition becomes true
* `exit` - callback(code, signal) fired when the underlying phantom process dies unexpectedly (if not handled, this will become an uncaught exception)

For a more in-depth description, see [the full callbacks list for phantomjs](https://github.com/ariya/phantomjs/wiki/API-Reference-WebPage#callbacks-list).

#### .screenshot(path)
Saves a screenshot of the current page to the specified `path`. Useful for debugging. Note the path must include the file extension. Supported formats include .png, .gif, .jpeg, and .pdf.

#### .pdf(path)
Saves a PDF with A4 size pages of the current page to the specified `path`.

#### .title(cb)
Get the title of the current page, the callback signature is `cb(title)`.

#### .url(cb)
Get the url of the current page, the signature of the callback is `cb(url)`.

### Settings
These functions must be called _before_ `.goto(url)`.

#### .authentication(user, password)
Set the `user` and `password` for accessing a web page using basic authentication. Be sure to set it before calling `.goto(url)`.

```js
new Nightmare()
  .authentication('myUserName','myPassword')
  .goto('http://httpbin.org/basic-auth/myUserName/myPassword')
  .run(function( err, nightmare){
    console.log("done");
  });
```

#### .useragent(useragent)
Set the `useragent` used by PhantomJS. You have to set the useragent before calling `.goto()`.

#### .viewport(width, height)
Set the `width` and `height` of the viewport, useful for screenshotting. Weirdly, you have to set the viewport before calling `.goto()`.

#### .zoom(zoomFactor)
Set the amount of zoom on the page. Default for a page is zoomFactor = 1. To zoom to 200%, set zoomFactor to 2. Combine with larger viewports to produce high DPI screenshots.

```js
new Nightmare()
  //double DPI render of 1600x900
  .viewport(3200, 1800)
  .zoom(2)
  .goto('http://www.wikipedia.org')
  .wait()
  .screenshot('test/testScaleIs2.png')
  .run(function( err, nightmare){
    console.log("done");
  });
```


#### .headers(headers)
Set the request `headers`. You have to call this before calling `.goto()`.

## Plugins

Here's a list of plugins, pull request to add your own to the list :)

* [nightmare-swiftly](https://github.com/segmentio/nightmare-swiftly)
* [nightmare-google-oauth2](https://github.com/h2non/nightmare-google-oauth2)

## Usage
#### Installation
Nightmare is a Node.js module, so you'll need to [have Node.js installed](http://nodejs.org/). You'll also need to have phantomjs itself installed:

```bash
$ sudo brew update && brew install phantomjs
$ npm install --save nightmare
```
Alternatively, you can download Phantom JS from http://phantomjs.org

#### Execution
Nightmare is a node module that can be used in a Node.js script or module. Here's a simple script to open a web page:
```js
var Nightmare = require('nightmare');
var nightmare = new Nightmare();
nightmare
  .goto('http://kayak.com')
  .run(function(err, nightmare){
    console.log('Done.');
  });
```
If you save this as `kayak.js`, you can run it on the command line like this: `node kayak.js`.

#### Debug
To run the same file with debugging output, run it like this `DEBUG=nightmare node kayak.js`.

This will print out some additional information about what's going on:

```bash
nightmare queueing action "goto" +0ms
  nightmare run +3ms
  nightmare .setup() creating phantom instance on port 12301 +1ms
  nightmare .setup() phantom instance created +145ms
  nightmare .setup() phantom page created +4ms
  nightmare .goto() url: http://kayak.com +2ms
  nightmare .goto() page loaded: success +1s
  nightmare .teardownInstance() tearing down and bumping port to 12302 +501ms
Done.
```

#### Tests
Automated tests for nightmare itself are run using [Mocha](http://visionmedia.github.io/mocha/) and [Should](https://github.com/shouldjs/should.js), both of which will be installed via `npm install`. To run nightmare's tests, just do `make test`.

When the tests are done, you'll see something like this:

```bash
make test
  ․․․․․․․․․․․․․․․․․․․․․․․․․․
  42 passing (3m)
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
