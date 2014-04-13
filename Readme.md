[![Build Status](https://circleci.com/gh/segmentio/nightmare.png?circle-token=dbb94336673268633371a89865e008b70ffedf6d)](https://circleci.com/gh/segmentio/nightmare)
Nightmare
=========

Nightmare is a high level wrapper for [PhantomJS](http://phantomjs.org/) that lets you automate browser tasks.

The goal is to expose just a few simple methods, and have an API that feels synchronous for each block of scripting, rather than deeply nested callbacks. It's designed for automating tasks across sites that don't have APIs.

## Examples

Let's search on Google:

```js
new Nightmare()
  .goto('https://google.com')
    .type('input#gbqfq', 'github nightmare')
    .click('button#gbqfba');
```

Or, here's how you might automate a nicely abstracted login + task on Swiftly:

```js
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

## API

#### new Nightmare(options)
Create a new instance that can navigate around the web.

The available options are:
* `timeout`: how long to wait for page loads, default `5000ms`
* `interval`: how frequently to poll for page load state, default `50ms`

#### .goto(url)
Load the page at `url`.

#### .refresh()
Refresh the current page.

#### .url(cb)
Get the url of the current page, the signature of the callback is `cb(url)`.

#### .click(selector)
Clicks the `selector` element once.

#### .type(selector, text)
Enters the `text` provided into the `selector` element.

#### .upload(selector, path)
Specify the `path` to upload into a file input `selector` element.

#### .evaluate(fn, cb, [arg1, arg2,...])
Invokes `fn` on the page with `args`. On completion it passes the return value of `fn` as to `cb(res)`. Useful for extracting information from the page.

#### .wait()
Wait until a page finishes loading, typically after a `.click()`.

#### .wait(ms)
Wait for `ms` milliseconds e.g. `.wait(5000)`

#### .wait(selector)
Wait until the element `selector` is present e.g. `.wait('#pay-button')`

#### .wait(fn, value, [delay])
Wait until the `fn` evaluated on the page returns `value`. Optionally, refresh the page every `delay` milliseconds, and only check after each refresh.

#### .screen(path)
Saves a screenshot of the current page to the specified `path`. Useful for debugging.

#### .agent(userAgent)
Set the `userAgent` used by PhantomJS.

#### .viewport(width, height)
Set the `width` and `height` of the viewport, useful for screenshotting.

#### .use(plugin)
Useful for using repeated code blocks, see the example with Swiftly login and task creation in the docs above.

#### .run(cb)
Executes the queue of functions, and calls your `cb` when the script hits an error or completes the queue. The callback signature is `cb(err, nightmare)`.

## Plugins

Here's a list of plugins, pull request to add your own to the list :)

* [nightmare-swiftly](https://github.com/segmentio/nightmare-swiftly)

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

Copyright (c) 2014 Segment.io Inc. <friends@segment.io>

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the 'Software'), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED 'AS IS', WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

