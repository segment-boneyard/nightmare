[![Build Status](https://img.shields.io/circleci/project/segmentio/nightmare/master.svg)](https://circleci.com/gh/segmentio/nightmare)
[![Join the chat at https://gitter.im/rosshinkley/nightmare](https://badges.gitter.im/rosshinkley/nightmare.svg)](https://gitter.im/rosshinkley/nightmare?utm_source=badge&utm_medium=badge&utm_campaign=pr-badge&utm_content=badge)

# Nightmare

Nightmare is a high-level browser automation library from [Segment](https://segment.com).

The goal is to expose a few simple methods that mimic user actions (like `goto`, `type` and `click`), with an API that feels synchronous for each block of scripting, rather than deeply nested callbacks. It was originally designed for automating tasks across sites that don't have APIs, but is most often used for UI testing and crawling.

Under the covers it uses [Electron](http://electron.atom.io/), which is similar to [PhantomJS](http://phantomjs.org/) but roughly [twice as fast](https://github.com/segmentio/nightmare/issues/484#issuecomment-184519591) and more modern. 

**⚠️ Security Warning:** We've implemented [many](https://github.com/segmentio/nightmare/issues/1388) of the security recommendations [outlined by Electron](https://github.com/electron/electron/blob/master/docs/tutorial/security.md) to try and keep you safe, but undiscovered vulnerabilities may exist in Electron that could allow a malicious website to execute code on your computer. Avoid visiting untrusted websites.

**🛠 Migrating to 3.x:** You'll want to check out [this issue](https://github.com/segmentio/nightmare/issues/1396) before upgrading. We've worked hard to make improvements to nightmare while limiting the breaking changes and there's a good chance you won't need to do anything.

[Niffy](https://github.com/segmentio/niffy) is a perceptual diffing tool built on Nightmare. It helps you detect UI changes and bugs across releases of your web app.

[Daydream](https://github.com/segmentio/daydream) is a complementary chrome extension built by [@stevenmiller888](https://github.com/stevenmiller888) that generates Nightmare scripts for you while you browse.

Many thanks to [@matthewmueller](https://github.com/matthewmueller) and [@rosshinkley](https://github.com/rosshinkley) for their help on Nightmare.

* [Examples](#examples)
  * [UI Testing Quick Start](https://segment.com/blog/ui-testing-with-nightmare/)
  * [Perceptual Diffing with Niffy & Nightmare](https://segment.com/blog/perceptual-diffing-with-niffy/)
* [API](#api)
  * [Set up an instance](#nightmareoptions)
  * [Interact with the page](#interact-with-the-page)
  * [Extract from the page](#extract-from-the-page)
  * [Cookies](#cookies)
  * [Proxies](#proxies)
  * [Promises](#promises)
  * [Extending Nightmare](#extending-nightmare)
* [Usage](#usage)
* [Debugging](#debugging)
* [Additional Resources](#additional-resources)

## Examples

Let's search on DuckDuckGo:

```js
const Nightmare = require('nightmare')
const nightmare = Nightmare({ show: true })

nightmare
  .goto('https://duckduckgo.com')
  .type('#search_form_input_homepage', 'github nightmare')
  .click('#search_button_homepage')
  .wait('#r1-0 a.result__a')
  .evaluate(() => document.querySelector('#r1-0 a.result__a').href)
  .end()
  .then(console.log)
  .catch(error => {
    console.error('Search failed:', error)
  })
```

You can run this with:

```shell
npm install --save nightmare
node example.js
```

Or, let's run some mocha tests:

```js
const Nightmare = require('nightmare')
const chai = require('chai')
const expect = chai.expect

describe('test duckduckgo search results', () => {
  it('should find the nightmare github link first', function(done) {
    this.timeout('10s')

    const nightmare = Nightmare()
    nightmare
      .goto('https://duckduckgo.com')
      .type('#search_form_input_homepage', 'github nightmare')
      .click('#search_button_homepage')
      .wait('#links .result__a')
      .evaluate(() => document.querySelector('#links .result__a').href)
      .end()
      .then(link => {
        expect(link).to.equal('https://github.com/segmentio/nightmare')
        done()
      })
  })
})
```

You can see examples of every function [in the tests here](https://github.com/segmentio/nightmare/blob/master/test/index.js).

To get started with UI Testing, check out this [quick start guide](https://segment.com/blog/ui-testing-with-nightmare).

### To install dependencies

```
npm install
```

### To run the mocha tests

```
npm test
```

### Node versions

Nightmare is intended to be run on NodeJS 4.x or higher.

## API

#### Nightmare(options)

Creates a new instance that can navigate around the web. The available options are [documented here](https://github.com/atom/electron/blob/master/docs/api/browser-window.md#new-browserwindowoptions), along with the following nightmare-specific options.

##### waitTimeout (default: 30s)

Throws an exception if the `.wait()` didn't return `true` within the set timeframe.

```js
const nightmare = Nightmare({
  waitTimeout: 1000 // in ms
})
```

##### gotoTimeout (default: 30s)

Throws an exception if the `.goto()` didn't finish loading within the set timeframe. Note that, even though `goto` normally waits for all the resources on a page to load, a timeout exception is only raised if the DOM itself has not yet loaded.

```js
const nightmare = Nightmare({
  gotoTimeout: 1000 // in ms
})
```

##### loadTimeout (default: infinite)

Forces Nightmare to move on if a page transition caused by an action (eg, `.click()`) didn't finish within the set timeframe. If `loadTimeout` is shorter than `gotoTimeout`, the exceptions thrown by `gotoTimeout` will be suppressed.

```js
const nightmare = Nightmare({
  loadTimeout: 1000 // in ms
})
```

##### executionTimeout (default: 30s)

The maximum amount of time to wait for an `.evaluate()` statement to complete.

```js
const nightmare = Nightmare({
  executionTimeout: 1000 // in ms
})
```

##### paths

The default system paths that Electron knows about. Here's a list of available paths: https://github.com/atom/electron/blob/master/docs/api/app.md#appgetpathname

You can overwrite them in Nightmare by doing the following:

```js
const nightmare = Nightmare({
  paths: {
    userData: '/user/data'
  }
})
```

##### switches

The command line switches used by the Chrome browser that are also supported by Electron. Here's a list of supported Chrome command line switches:
https://github.com/atom/electron/blob/master/docs/api/chrome-command-line-switches.md

```js
const nightmare = Nightmare({
  switches: {
    'proxy-server': '1.2.3.4:5678',
    'ignore-certificate-errors': true
  }
})
```

##### electronPath

The path to the prebuilt Electron binary. This is useful for testing on different versions of Electron. Note that Nightmare only supports the version on which this package depends. Use this option at your own risk.

```js
const nightmare = Nightmare({
  electronPath: require('electron')
})
```

##### dock (OS X)

A boolean to optionally show the Electron icon in the dock (defaults to `false`). This is useful for testing purposes.

```js
const nightmare = Nightmare({
  dock: true
})
```

##### openDevTools

Optionally shows the DevTools in the Electron window using `true`, or use an object hash containing `mode: 'detach'` to show in a separate window. The hash gets passed to [`contents.openDevTools()`](https://github.com/electron/electron/blob/master/docs/api/web-contents.md#contentsopendevtoolsoptions) to be handled. This is also useful for testing purposes. Note that this option is honored only if `show` is set to `true`.

```js
const nightmare = Nightmare({
  openDevTools: {
    mode: 'detach'
  },
  show: true
})
```

##### typeInterval (default: 100ms)

How long to wait between keystrokes when using `.type()`.

```js
const nightmare = Nightmare({
  typeInterval: 20
})
```

##### pollInterval (default: 250ms)

How long to wait between checks for the `.wait()` condition to be successful.

```js
const nightmare = Nightmare({
  pollInterval: 50 //in ms
})
```

##### maxAuthRetries (default: 3)

Defines the number of times to retry an authentication when set up with `.authenticate()`.

```js
const nightmare = Nightmare({
  maxAuthRetries: 3
})
```

#### certificateSubjectName

A string to determine the client certificate selected by electron. If this options is set, the [`select-client-certificate`](https://github.com/electron/electron/blob/master/docs/api/app.md#event-select-client-certificate) event will be set to loop through the certificateList and find the first certificate that matches `subjectName` on the electron [`Certificate Object`](https://electronjs.org/docs/api/structures/certificate).

```js
const nightmare = Nightmare({
  certificateSubjectName: 'tester'
})
```

#### .engineVersions()

Gets the versions for Electron and Chromium.

#### .useragent(useragent)

Sets the `useragent` used by electron.

#### .authentication(user, password)

Sets the `user` and `password` for accessing a web page using basic authentication. Be sure to set it before calling `.goto(url)`.

#### .end()

Completes any queue operations, disconnect and close the electron process. Note that if you're using promises, `.then()` must be called after `.end()` to run the `.end()` task. Also note that if using an `.end()` callback, the `.end()` call is equivalent to calling `.end()` followed by `.then(fn)`. Consider:

```js
nightmare
  .goto(someUrl)
  .end(() => 'some value')
  //prints "some value"
  .then(console.log)
```

#### .halt(error, done)

Clears all queued operations, kills the electron process, and passes error message or 'Nightmare Halted' to an unresolved promise. Done will be called after the process has exited.

### Interact with the Page

#### .goto(url[, headers])

Loads the page at `url`. Optionally, a `headers` hash can be supplied to set headers on the `goto` request.

When a page load is successful, `goto` returns an object with metadata about the page load, including:

* `url`: The URL that was loaded
* `code`: The HTTP status code (e.g. 200, 404, 500)
* `method`: The HTTP method used (e.g. "GET", "POST")
* `referrer`: The page that the window was displaying prior to this load or an empty string if this is the first page load.
* `headers`: An object representing the response headers for the request as in `{header1-name: header1-value, header2-name: header2-value}`

If the page load fails, the error will be an object with the following properties:

* `message`: A string describing the type of error
* `code`: The underlying error code describing what went wrong. Note this is NOT the HTTP status code. For possible values, see https://code.google.com/p/chromium/codesearch#chromium/src/net/base/net_error_list.h
* `details`: A string with additional details about the error. This may be null or an empty string.
* `url`: The URL that failed to load

Note that any valid response from a server is considered “successful.” That means things like 404 “not found” errors are successful results for `goto`. Only things that would cause no page to appear in the browser window, such as no server responding at the given address, the server hanging up in the middle of a response, or invalid URLs, are errors.

You can also adjust how long `goto` will wait before timing out by setting the [`gotoTimeout` option](#gototimeout-default-30s) on the Nightmare constructor.

#### .back()

Goes back to the previous page.

#### .forward()

Goes forward to the next page.

#### .refresh()

Refreshes the current page.

#### .click(selector)

Clicks the `selector` element once.

#### .mousedown(selector)

Mousedowns the `selector` element once.

#### .mouseup(selector)

Mouseups the `selector` element once.

#### .mouseover(selector)

Mouseovers the `selector` element once.

#### .mouseout(selector)

Mouseout the `selector` element once.

#### .type(selector[, text])

Enters the `text` provided into the `selector` element. Empty or falsey values provided for `text` will clear the selector's value.

`.type()` mimics a user typing in a textbox and will emit the proper keyboard events.

Key presses can also be fired using Unicode values with `.type()`. For example, if you wanted to fire an enter key press, you would write `.type('body', '\u000d')`.

> If you don't need the keyboard events, consider using `.insert()` instead as it will be faster and more robust.

#### .insert(selector[, text])

Similar to `.type()`, `.insert()` enters the `text` provided into the `selector` element. Empty or falsey values provided for `text` will clear the selector's value.

`.insert()` is faster than `.type()` but does not trigger the keyboard events.

#### .check(selector)

Checks the `selector` checkbox element.

#### .uncheck(selector)

Unchecks the `selector` checkbox element.

#### .select(selector, option)

Changes the `selector` dropdown element to the option with attribute [value=`option`]

#### .scrollTo(top, left)

Scrolls the page to desired position. `top` and `left` are always relative to the top left corner of the document.

#### .viewport(width, height)

Sets the viewport size.

#### .inject(type, file)

Injects a local `file` onto the current page. The file `type` must be either `js` or `css`.

#### .evaluate(fn[, arg1, arg2,...])

Invokes `fn` on the page with `arg1, arg2,...`. All the `args` are optional. On completion it returns the return value of `fn`. Useful for extracting information from the page. Here's an example:

```js
const selector = 'h1'
nightmare
  .evaluate(selector => {
    // now we're executing inside the browser scope.
    return document.querySelector(selector).innerText
  }, selector) // <-- that's how you pass parameters from Node scope to browser scope
  .then(text => {
    // ...
  })
```

Error-first callbacks are supported as a part of `evaluate()`. If the arguments passed are one fewer than the arguments expected for the evaluated function, the evaluation will be passed a callback as the last parameter to the function. For example:

```js
const selector = 'h1'
nightmare
  .evaluate((selector, done) => {
    // now we're executing inside the browser scope.
    setTimeout(
      () => done(null, document.querySelector(selector).innerText),
      2000
    )
  }, selector)
  .then(text => {
    // ...
  })
```

Note that callbacks support only one value argument (eg `function(err, value)`). Ultimately, the callback will get wrapped in a native Promise and only be able to resolve a single value.

Promises are also supported as a part of `evaluate()`. If the return value of the function has a `then` member, `.evaluate()` assumes it is waiting for a promise. For example:

```js
const selector = 'h1';
nightmare
  .evaluate((selector) => (
    new Promise((resolve, reject) => {
      setTimeout(() => resolve(document.querySelector(selector).innerText), 2000);
    )}, selector)
  )
  .then((text) => {
    // ...
  })
```

#### .wait(ms)

Waits for `ms` milliseconds e.g. `.wait(5000)`.

#### .wait(selector)

Waits until the element `selector` is present e.g. `.wait('#pay-button')`.

#### .wait(fn[, arg1, arg2,...])

Waits until the `fn` evaluated on the page with `arg1, arg2,...` returns `true`. All the `args` are optional. See `.evaluate()` for usage.

#### .header(header, value)

Adds a header override for all HTTP requests. If `header` is undefined, the header overrides will be reset.

### Extract from the Page

#### .exists(selector)

Returns whether the selector exists or not on the page.

#### .visible(selector)

Returns whether the selector is visible or not.

#### .on(event, callback)

Captures page events with the callback. You have to call `.on()` before calling `.goto()`. Supported events are [documented here](http://electron.atom.io/docs/api/web-contents/#class-webcontents).

##### Additional "page" events

###### .on('page', function(type="error", message, stack))

This event is triggered if any javascript exception is thrown on the page. But this event is not triggered if the injected javascript code (e.g. via `.evaluate()`) is throwing an exception.

##### "page" events

Listens for `window.addEventListener('error')`, `alert(...)`, `prompt(...)` & `confirm(...)`.

###### .on('page', function(type="error", message, stack))

Listens for top-level page errors. This will get triggered when an error is thrown on the page.

###### .on('page', function(type="alert", message))

Nightmare disables `window.alert` from popping up by default, but you can still listen for the contents of the alert dialog.

###### .on('page', function(type="prompt", message, response))

Nightmare disables `window.prompt` from popping up by default, but you can still listen for the message to come up. If you need to handle the confirmation differently, you'll need to use your own preload script.

###### .on('page', function(type="confirm", message, response))

Nightmare disables `window.confirm` from popping up by default, but you can still listen for the message to come up. If you need to handle the confirmation differently, you'll need to use your own preload script.

###### .on('console', function(type [, arguments, ...]))

`type` will be either `log`, `warn` or `error` and `arguments` are what gets passed from the console. This event is not triggered if the injected javascript code (e.g. via `.evaluate()`) is using `console.log`.

#### .once(event, callback)

Similar to `.on()`, but captures page events with the callback one time.

#### .removeListener(event, callback)

Removes a given listener callback for an event.

#### .screenshot([path][, clip])

Takes a screenshot of the current page. Useful for debugging. The output is always a `png`. Both arguments are optional. If `path` is provided, it saves the image to the disk. Otherwise it returns a `Buffer` of the image data. If `clip` is provided (as [documented here](https://github.com/atom/electron/blob/master/docs/api/browser-window.md#wincapturepagerect-callback)), the image will be clipped to the rectangle.

#### .html(path, saveType)

Saves the current page as html as files to disk at the given path. Save type options are [here](https://github.com/atom/electron/blob/master/docs/api/web-contents.md#webcontentssavepagefullpath-savetype-callback).

#### .pdf(path, options)

Saves a PDF to the specified `path`. Options are [here](https://github.com/electron/electron/blob/v1.4.4/docs/api/web-contents.md#contentsprinttopdfoptions-callback).

#### .title()

Returns the title of the current page.

#### .url()

Returns the url of the current page.

#### .path()

Returns the path name of the current page.

### Cookies

#### .cookies.get(name)

Gets a cookie by it's `name`. The url will be the current url.

#### .cookies.get(query)

Queries multiple cookies with the `query` object. If a `query.name` is set, it will return the first cookie it finds with that name, otherwise it will query for an array of cookies. If no `query.url` is set, it will use the current url. Here's an example:

```js
// get all google cookies that are secure
// and have the path `/query`
nightmare
  .goto('http://google.com')
  .cookies.get({
    path: '/query',
    secure: true
  })
  .then(cookies => {
    // do something with the cookies
  })
```

Available properties are documented here: https://github.com/atom/electron/blob/master/docs/api/session.md#sescookiesgetdetails-callback

#### .cookies.get()

Gets all the cookies for the current url. If you'd like get all cookies for all urls, use: `.get({ url: null })`.

#### .cookies.set(name, value)

Sets a cookie's `name` and `value`. This is the most basic form, and the url will be the current url.

#### .cookies.set(cookie)

Sets a `cookie`. If `cookie.url` is not set, it will set the cookie on the current url. Here's an example:

```js
nightmare
  .goto('http://google.com')
  .cookies.set({
    name: 'token',
    value: 'some token',
    path: '/query',
    secure: true
  })
  // ... other actions ...
  .then(() => {
    // ...
  })
```

Available properties are documented here: https://github.com/atom/electron/blob/master/docs/api/session.md#sescookiessetdetails-callback

#### .cookies.set(cookies)

Sets multiple cookies at once. `cookies` is an array of `cookie` objects. Take a look at the `.cookies.set(cookie)` documentation above for a better idea of what `cookie` should look like.

#### .cookies.clear([name])

Clears a cookie for the current domain. If `name` is not specified, all cookies for the current domain will be cleared.

```js
nightmare
  .goto('http://google.com')
  .cookies.clear('SomeCookieName')
  // ... other actions ...
  .then(() => {
    // ...
  })
```

#### .cookies.clearAll()

Clears all cookies for all domains.

```js
nightmare
  .goto('http://google.com')
  .cookies.clearAll()
  // ... other actions ...
  .then(() => {
    //...
  })
```

### Proxies

Proxies are supported in Nightmare through [switches](#switches).

If your proxy requires authentication you also need the [authentication](#authenticationuser-password) call.

The following example not only demonstrates how to use proxies, but you can run it to test if your proxy connection is working:

```js
import Nightmare from 'nightmare';

const proxyNightmare = Nightmare({
  switches: {
    'proxy-server': 'my_proxy_server.example.com:8080' // set the proxy server here ...
  },
  show: true
});

proxyNightmare
  .authentication('proxyUsername', 'proxyPassword') // ... and authenticate here before `goto`
  .goto('http://www.ipchicken.com')
  .evaluate(() => {
    return document.querySelector('b').innerText.replace(/[^\d\.]/g, '');
  })
  .end()
  .then((ip) => { // This will log the Proxy's IP
    console.log('proxy IP:', ip);
  });

// The rest is just normal Nightmare to get your local IP
const regularNightmare = Nightmare({ show: true });

regularNightmare
  .goto('http://www.ipchicken.com')
  .evaluate(() =>
    document.querySelector('b').innerText.replace(/[^\d\.]/g, '');
  )
  .end()
  .then((ip) => { // This will log the your local IP
    console.log('local IP:', ip);
  });
```

### Promises

By default, Nightmare uses default native ES6 promises. You can plug in your favorite [ES6-style promises library](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise) like [bluebird](https://www.npmjs.com/package/bluebird) or [q](https://www.npmjs.com/package/q) for convenience!

Here's an example:

```js
var Nightmare = require('nightmare')

Nightmare.Promise = require('bluebird')
// OR:
Nightmare.Promise = require('q').Promise
```

You can also specify a custom Promise library per-instance with the `Promise` constructor option like so:

```js
var Nightmare = require('nightmare')

var es6Nightmare = Nightmare()
var bluebirdNightmare = Nightmare({
  Promise: require('bluebird')
})

var es6Promise = es6Nightmare
  .goto('https://github.com/segmentio/nightmare')
  .then()
var bluebirdPromise = bluebirdNightmare
  .goto('https://github.com/segmentio/nightmare')
  .then()

es6Promise.isFulfilled() // throws: `TypeError: es6EndPromise.isFulfilled is not a function`
bluebirdPromise.isFulfilled() // returns: `true | false`
```

### Extending Nightmare

#### Nightmare.action(name, [electronAction|electronNamespace], action|namespace)

You can add your own custom actions to the Nightmare prototype. Here's an example:

```js
Nightmare.action('size', function(done) {
  this.evaluate_now(() => {
    const w = Math.max(
      document.documentElement.clientWidth,
      window.innerWidth || 0
    )
    const h = Math.max(
      document.documentElement.clientHeight,
      window.innerHeight || 0
    )
    return {
      height: h,
      width: w
    }
  }, done)
})

Nightmare()
  .goto('http://cnn.com')
  .size()
  .then(size => {
    //... do something with the size information
  })
```

> Remember, this is attached to the static class `Nightmare`, not the instance.

You'll notice we used an internal function `evaluate_now`. This function is different than `nightmare.evaluate` because it runs it immediately, whereas `nightmare.evaluate` is queued.

An easy way to remember: when in doubt, use `evaluate`. If you're creating custom actions, use `evaluate_now`. The technical reason is that since our action has already been queued and we're running it now, we shouldn't re-queue the evaluate function.

We can also create custom namespaces. We do this internally for `nightmare.cookies.get` and `nightmare.cookies.set`. These are useful if you have a bundle of actions you want to expose, but it will clutter up the main nightmare object. Here's an example of that:

```js
Nightmare.action('style', {
  background(done) {
    this.evaluate_now(
      () => window.getComputedStyle(document.body, null).backgroundColor,
      done
    )
  }
})

Nightmare()
  .goto('http://google.com')
  .style.background()
  .then(background => {
    // ... do something interesting with background
  })
```

You can also add custom Electron actions. The additional Electron action or namespace actions take `name`, `options`, `parent`, `win`, `renderer`, and `done`. Note the Electron action comes first, mirroring how `.evaluate()` works. For example:

```javascript
Nightmare.action(
  'clearCache',
  (name, options, parent, win, renderer, done) => {
    parent.respondTo('clearCache', done => {
      win.webContents.session.clearCache(done)
    })
    done()
  },
  function(done) {
    this.child.call('clearCache', done)
  }
)

Nightmare()
  .clearCache()
  .goto('http://example.org')
  //... more actions ...
  .then(() => {
    // ...
  })
```

...would clear the browser’s cache before navigating to `example.org`.

See [this document](https://github.com/rosshinkley/nightmare-examples/blob/master/docs/beginner/action.md) for more details on creating custom actions.

#### .use(plugin)

`nightmare.use` is useful for reusing a set of tasks on an instance. Check out [nightmare-swiftly](https://github.com/segmentio/nightmare-swiftly) for some examples.

#### Custom preload script

If you need to do something custom when you first load the window environment, you
can specify a custom preload script. Here's how you do that:

```js
import path from 'path'

const nightmare = Nightmare({
  webPreferences: {
    preload: path.resolve('custom-script.js')
    //alternative: preload: "absolute/path/to/custom-script.js"
  }
})
```

The only requirement for that script is that you'll need the following prelude:

```js
window.__nightmare = {}
__nightmare.ipc = require('electron').ipcRenderer
```

To benefit of all of nightmare's feedback from the browser, you can instead copy the contents of nightmare's [preload script](lib/preload.js).

#### Storage Persistence between nightmare instances

By default nightmare will create an in-memory partition for each instance. This means that any localStorage or cookies or any other form of persistent state will be destroyed when nightmare is ended. If you would like to persist state between instances you can use the [webPreferences.partition](http://electron.atom.io/docs/api/browser-window/#new-browserwindowoptions) api in electron.

```js
import Nightmare from 'nightmare';

nightmare = Nightmare(); // non persistent paritition by default
yield nightmare
  .evaluate(() => {
    window.localStorage.setItem('testing', 'This will not be persisted');
  })
  .end();

nightmare = Nightmare({
  webPreferences: {
    partition: 'persist: testing'
  }
});
yield nightmare
  .evaluate(() => {
    window.localStorage.setItem('testing', 'This is persisted for other instances with the same paritition name');
  })
  .end();
```

If you specify a `null` paritition then it will use the electron default behavior (persistent) or any string that starts with `'persist:'` will persist under that partition name, any other string will result in in-memory only storage.

## Usage

#### Installation

Nightmare is a Node.js module, so you'll need to [have Node.js installed](http://nodejs.org/). Then you just need to `npm install` the module:

```bash
$ npm install --save nightmare
```

#### Execution

Nightmare is a node module that can be used in a Node.js script or module. Here's a simple script to open a web page:

```js
import Nightmare from 'nightmare';

const nightmare = Nightmare();

nightmare.goto('http://cnn.com')
  .evaluate(() => {
    return document.title;
  })
  .end()
  .then((title) => {
    console.log(title);
  })
```

If you save this as `cnn.js`, you can run it on the command line like this:

```bash
npm install --save nightmare
node cnn.js
```

#### Common Execution Problems

Nightmare heavily relies on [Electron](http://electron.atom.io/) for heavy lifting. And Electron in turn relies on several UI-focused dependencies (eg. libgtk+) which are often missing from server distros.

For help running nightmare on your server distro check out [How to run nightmare on Amazon Linux and CentOS](https://gist.github.com/dimkir/f4afde77366ff041b66d2252b45a13db) guide.

#### Debugging

There are three good ways to get more information about what's happening inside the headless browser:

1. Use the `DEBUG=*` flag described below.
2. Pass `{ show: true }` to the [nightmare constructor](#nightmareoptions) to have it create a visible, rendered window where you can watch what is happening.
3. Listen for [specific events](#onevent-callback).

To run the same file with debugging output, run it like this `DEBUG=nightmare node cnn.js` (on Windows use `set DEBUG=nightmare & node cnn.js`).

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

Only logs

`DEBUG=nightmare:log*`

## Additional Resources

* [Ross Hinkley's Nightmare Examples](https://github.com/rosshinkley/nightmare-examples) is a great resource for setting up nightmare, learning about custom actions, and avoiding common pitfalls.

* [Nightmare Issues](https://github.com/matthewmueller/nightmare-issues) has a bunch of standalone runnable examples. The script numbers correspond to nightmare issue numbers.

* [Nightmarishly good scraping](https://hackernoon.com/nightmarishly-good-scraping-with-nightmare-js-and-async-await-b7b20a38438f) is a great tutorial by [Ændrew Rininsland](https://twitter.com/@aendrew) on getting up & running with Nightmare using real-life data.

## Tests

Automated tests for nightmare itself are run using [Mocha](http://mochajs.org/) and Chai, both of which will be installed via `npm install`. To run nightmare's tests, just run `make test`.

When the tests are done, you'll see something like this:

```bash
make test
  ․․․․․․․․․․․․․․․․․․
  18 passing (1m)
```

Note that if you are using `xvfb`, `make test` will automatically run the tests under an `xvfb-run` wrapper. If you are planning to run the tests headlessly without running `xvfb` first, set the `HEADLESS` environment variable to `0`.

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

Copyright (c) 2015 Segment.io, Inc. <mailto:friends@segment.com>

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the 'Software'), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED 'AS IS', WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
