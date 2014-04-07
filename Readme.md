[![Build Status](https://circleci.com/gh/segmentio/nightmare.png?circle-token=dbb94336673268633371a89865e008b70ffedf6d)](https://circleci.com/gh/segmentio/nightmare)
Nightmare
=========

Nightmare is a high level wrapper for [PhantomJS]() that lets you automate browser tassks.

The goal is to expose just a few simple methods, and have an API that feels synchronous for each block of scripting, rather than deeply nested callbacks. It's designed for automating tasks across sites that don't have APIs.

## Examples

Let's search on Google:

```js
new Nightmare()
  .goto('https://google.com')
    .type('input#gbqfq', 'github nightmare')
    .click('button#gbqfba');
```

Or, here's how you might run a simple login sequence:

```javascript
var Nightmare = require('nightmare');

function login(done) {
    new Nightmare()
      .error(done)
      .goto('https://swiftly.com/')
        .click('#asdf')
      .wait()
        .type('#email', email)
        .type('#password', password)
        .click('#login-submit')
      .wait()
      .done(done);
}
```

Then later you could then use that same nightmare page to submit a complex form:

```javascript
function submit(nightmare, description, path, done) {
    nightmare
      .error(done)
      .goto('https://swiftly.com/create')
        .type('#body', description)
        .upload('.uploader__button > input', path)
        .click('#task-pay-button')
      .wait()
      .done(done);
}
```

## API

#### new Nightmare(options)
Create a new instance that can navigate around the web.

The available options are:
* `timeout`: how long to wait for page loads, default `5000ms`
* `interval`: how frequently to poll for page load state, default `50ms`

#### .goto(url)
Load the page at `url`.

#### .click(selector)
Clicks the `selector` element once.

#### .type(selector, text)
Enters the `text` provided into the `selector` element.

#### .upload(selector, path)
Specify the `path` to upload into a file input `selector` element.

#### .run(fn, cb, [arg1, arg2,...])
Invokes `fn` on the page with `args`. On completion it passes the return value of `fn` as to `cb(err, res)`. Useful for extracting information from the page.

#### .wait([options])
Wait until a page finishes loading, typically after a `.click()`.

The possible `options` are:
* `null` or not passed: wait for a new page to load e.g. `.wait()`
* `number`: wait for that many milliseconds e.g. `.wait(150)`
* `string`: wait until that element selector is present e.g. `.wait('#pay-button')`

#### .screen(path)
Saves a screenshot of the current page to the specified `path`. Useful for debugging.

#### .agent(userAgent)
Set the `userAgent` used by PhantomJS.

#### .viewport(width, height)
Set the `width` and `height` of the viewport, useful for screenshotting.

#### .done(cb)
Doesn't do anything, except call your `cb` when the script reaches it. The method signature is `cb(nightmare)`.

#### .error(cb)
Set the `cb` for any errors that occur on this instance. The method signature is `cb(err, nightmare)`.

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

