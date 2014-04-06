Nightmare
=========

Nightmare is a high level wrapper for [PhantomJS]() that lets you automate browser tasks, including testing.

The goal is to expose just a few simple methods, and have an API that feels synchronous for each block of scripting, rather than deeply nested callbacks.

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

#### .goto(url)
Load the page at `url`.

#### .click(selector)
Clicks the `selector` element once.

#### .type(selector, text)
Enters the `text` provided into the `selector` element.

#### .upload(selector, path)
Specify the `path` to upload into a file input `selector` element.

#### .wait([options])
Wait until a page finishes loading, typically after a `.click()`.

The possible `options` are:
* `null` or not passed: wait for a new page to load
* `number`: wait for that many milliseconds
* `string`: wait until that element selector is present
* `dictionary`: specify a combination of the above options, waits for all before proceding

```js
nightmare.wait({
  page: true,
  timeout: 150,
  selector: '.order-complete-image'
});
```

#### .done(callback)
Doesn't do anything, except call your `callback` when the script reaches it. The method signature is `(nightmare)`.

#### .error(handler)
Set the `handler` for any errors that occur on this instance. The method signature is `(err, nightmare)`.

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

