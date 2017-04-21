
2.10.0 / 2017-02-23
===================

  * Remove redundant docs for 'log' event from README
  * changed some `var` declarations to `const`
  * replace the 404 link with valid link
  * added Promise override tests
  * added docs for new Promise override features
  * added ability to override internal Promise library

2.9.1 / 2017-01-02
==================

  * Minor touchups to key press documentation
  * Link to Electron documentation updated
  * Updates speed information on the readme
  * Swaps Yahoo example out for a faster DuckDuckGo example
  * Fixes an issue where `nightmare` may be undefined in the browser at injection time
  * Changes screenshot rendering to use debugger API instead of forcing a DOM change

2.9.0 / 2016-12-17
==================

  * Prevents unload dialogs, allowing Nightmare to end gracefully
  * `.end(fn)` now uses `.then()` under the covers
  * **Possibly breaking change:** Nightmare will now default to using a non-persistent partition.  Data between executions of Nightmare will no longer be saved.
  * Adds `.mouseup()` action
  * Fixes several typos/copy-paste errors in the readme, as well as clarifying error-first callbacks
  * Adds `.path()` to get the URL's route (as opposed to the fully-qualified URL)

2.8.1 / 2016-10-20
==================

  * Fixes parsing issues with arguments to `evaluate_now`
  * Upgrades to Electron 1.4.4

2.8.0 / 2016-10-20
==================

  * Fixes a missing semicolon in the first readme example
  * Fixes a reference error inside `.wait()` when using `node --use_strict`
  * Adds missing documentation for `.mouseover()`
  * Corrects a typo in the readme
  * Removes dependency on `object-assign`
  * Adds `.halt()` API to stop Nightmare execution immediately
  * Fixes `blur` exception when elements are removed by keyboard events
  * **Possibly breaking change:** Changes `.evaluate()` to allow for asynchronous execution.  If the `.evaluate()`d function's arity is one less than the passed in parameters, it'll assume the last argument to the function is the callback. If the return value is a thenable, it'll call `then()` to wait for promise fulfillment. Otherwise, the call will behave synchronously as it does now.

2.7.0 / 2016-09-05
==================

  * Adds `.wait(element, timeout)` to wait for whichever comes first
  * `.end()` will now end Electron gracefully instead of issuing a `SIGKILL`
  * Touches up readme for `.end()`

2.6.1 / 2016-08-08
==================

  * Fixes treating provisional load failures as real load failures

2.6.0 / 2016-08-02
==================

  * Makes the CircleCI badge an SVG
  * Adds an option for `.type()` to control time elapsed between keystrokes with `typeInterval`
  * Adds `.cookies.clearAll()` to clear all cookies
  * Fixes crashing if the Electron process is closed first
  * Adds `pollInterval` as an option to control the tick time for `.wait()`
  * Forces Nightmare to error on bad HTTP authentication
  * Fixes a crash by omitting event data due to circular references
  * Adds environment variable forwarding to the Electron process
  * Fixes `openDevTools` docs to be more explicit about detaching the devtools tray
  * Fixes the link to the preload script

2.5.3 / 2016-07-08
==================

  * Adds better proxy information to the readme
  * Fixes a readme typo
  * Updates `ipcRenderer` usage for preload scripts in readme
  * Bumps Electron to version 1.2.5

2.5.2 / 2016-06-20
==================

  * Fixes `Referer` header support
  * Removes timeout between keystrokes when using `.type()`
  * Checks instance existence when calling `.end()`
  * Adds a link to `nightmare-examples`
  * Changes `yield` to `.then()` in readme
  * Swaps `did-finish-loading` for `did-stop-loading` when waiting for page transitions
  * Adds optional `loadTimeout` for server responses that do not end

2.5.1 / 2016-06-07
==================

  * Bumps Electron dependency to 1.2.1.
  * Removes a `sender` workaround
  * Moves the start of Electron from the constructor into the queue

2.5.0 / 2016-05-27
==================

  * adds a timeout to `.goto()` such that pages that load the DOM but never finish are considered successful, otherwise failing, preventing a hang.
  * updates the example script and readme file for consistency.
  * reports with more helpful messages when the element does not exist when running `.click()`, `.mousedown()` and `.mouseover()`.
  * `.coookies.clear()` with no arguments will clear all cookies for the current domain.
  * adds Node engine information to package and ensures CircleCI builds and tests against 4.x, 5.x and 6.x.
  * removes extranneous `javascript` event listeners upon execution completion or error.
  * adds `.once()` and `.removeListener()` for more complete Electron process event handling.

2.4.1 / 2016-05-19
==================

  * Points invalid test URLs to the `.tld` domain
  * Switches javascript templates over to using template strings.
  * Adds better switch tests
  * Javascript `goto`s now only wait if the main frame is loading
  * Allows a Nightmare instance to use `.catch()` without a `.then()`
  * Fixes a deprecated IPC inclusion in tests
  * `.goto()` rejects with a helpful message when `url` is not provided

2.4.0 / 2016-05-05
==================

  * adds call safety with IPC callbacks
  * adds `.engineVersions()` to get Electron and Chrome versions, as well as Nightmare.version
  * changes Yahoo example to use more robust selectors, adds `.catch()`
  * adds a check for `runner` arguments

2.3.4 / 2016-04-23
==================

  * blurs text inputs when finished with `.type()` or `.input()`, including clearing selectors
  * now errors properly for non-existent selectors when using `.type()` and `.input()`
  * strips `sender` from Electron -> parent process forwarded events
  * improves test speed for dev tools
  * fixes `.then()` to comply with A+ promises
  * pipes Electron output to `debug` prefixed with `electron:`
  * cleans up several exception test cases using `.should.be.rejected` from `chai-as-promised`
  * upgrades to Electron 0.37.7
  * removes `process` event listeners when a Nightmare instance ends
  * fixes support for `javascript:` urls

2.3.3 / 2016-04-19
==================

  * fixes `.goto()` failing when the page does not load
  * fixes deprecated Electron APIs
  * adds testing for deprecated API usage in Electron

2.3.2 / 2016-04-14
==================

  * fixes the `.wait(selector)` comment
  * adds documentation about headers
  * adds an interim gitter badge
  * adds a unit test for `openDevTools`
  * bumps to electron 0.37.5
  * adds a wrapper to run unit tests when on CircleCI, when Xvfb is running, or the `HEADLESS` environment variable is set.  Prevents Nightmare from hanging when running headlessly.
  * `.evaluate()` errors if a function to evaluate is not supplied

2.3.1 / 2016-04-11
==================

  * fixes passing uncaught exceptions  back to the default handler after cleanup
  * fixes overhead due to automatic subscription to frame data for screenshots
  * Adds unicode documentation for `.type()`

2.3.0 / 2016-04-02
==================

  * extends `.action()` to include adding actions on the Electron process
  * adds a debugging message to inspect how Electron exited
  * ensures multiple instances of Nightmare do not use the same `waitTimeout` value
  * ensures cookies are not shared across tests
  * adds basic HTTP authentication
  * fixes `console.log` with injected/evaluated script
  * ensures screenshots match the currently rendered frame
  * adds ability to open and detach dev tools
  * removes the double-injection from `.inject()`
  * adds ability to save entire page as HTML

2.2.0 / 2016-02-16
==================

  * .then() now returns a full promise instead of nightmare. update yahoo example.

2.1.6 / 2016-02-01
==================

  * Fix failed wait with queued up functions
  * fix fullscreen switching (#434)

2.1.5 / 2016-02-01
==================

  * add .insert(selector[, text]).
  * improve .type(selector[, text]) robustness.
  * bump electron and fix API updates.

2.1.4 / 2016-01-28
==================

  * added debugging flags to README
  * Update use of electron APIs to kill deprecation warnings for 1.0
  * Implement dock option
  * added default waitTimout
  * page event listener fix

2.1.3 / 2016-01-18
==================

  * added ability to uncheck
  * now properly fails with integer wait time
  * Added ability to return buffer from pdf
  * add ability to clear cookies
  * Added a documentation for .viewport(width, height)
  * Uncomment OS X dock hide
  * fix setting electron paths

2.1.2 / 2015-12-25
==================

  * Support typing in non-strings
  * Support Chrome command line switches.
  * fix eventemitter leak message
  * Blur focussed on click.  Fixes #400

2.1.1 / 2015-12-21
==================

  * clears inputs on falsey/empty values

2.1.0 / 2015-12-17
==================

  * **BREAKING**: changed `page-error`, `page-alert`, and `page-log` to `console` with types `error`, `alert`, `log`
  * **BREAKING**: fixed signature on nightmare.on('console', ...), to act more like console.log(...)

  * use native electron sendInputEvent for nightmare.type(...)
  * properly shutdown nightmare after certain tests and update formatting on the readme
  * add events for prompt, alert, confirm, and the other console events
  * update docs for preload script
  * support passing in a custom preload script
  * Update PDF Options
  * follow new BrowserWindow option naming
  * remove useless mocha opt
  * implement `electronPath` option
  * Fixed 'args is not defined' error for paths option

2.0.9 / 2015-12-09
==================

  * add Nightmare.action(name, action|namespace) and nightmare.use(plugin)
  * bump dependencies
  * Add header() method, and optional headers param to goto()
  * "manipulation" fixture fixed to correctly test horizontal scrolling
  * Viewport size changed in the 'should set viewport' test (for test passing on small screen resolution).
  * prevent alerts from blocking
  * Add support to wait(fn) for passing arguments from node context to browser context, just like evaluate()
  * better cross-platform tests
  * add mousedown event
  * add nightmare.cookies.get(...) and nightmare.cookies.set(...) support
  * improve screenshot documentation
  * remove `.only` from buffered image test case
  * return a buffered image if no path is provided
  * Allow overriding Electron app paths
  * Update mocha-generators so tests run

2.0.8 / 2015-11-24
==================

  * pointing to versioned Electron documentation
  * Use "did-stop-loading" event in "continue"
  * Fix menu sub-section URL in documentation
  * updating yahoo mocha example so it works with yahoo's changes, fixes #275
  * adding a more complete example, fixes #295
  * updating atom events links, fixes #312 and #258
  * set make test as the npm test target
  * log and error event clean up
  * Added license to package.json
  * replace co-mocha w/ mocha-generators
  * Allow for user-specified web-preferences options.
  * Add test case for 'type' The test case of 'type and click' doesn't ensure 'type' works
  * Remove old evaluate method, fix #257

2.0.7 / 2015-10-01
==================

* updated and clarified docs
* fixed package.json description, thanks @tscanlin
* better error handling for ipc, thanks @davidnaas

2.0.6 / 2015-09-25
==================

* changing the tests to point to github to avoid the great firewall fix #249
* Use node-integration for electron, fix scripts loading fix #242 #247
* Remove after and util in test/index.js
* adding windows debug hint

2.0.5 / 2015-09-20
==================

* adding .useragent() support back, thanks @jefeweisen!

2.0.4 / 2015-09-20
==================

* improving logging for screenshot, events and goto

2.0.3 / 2015-09-19
==================

* improving test cleanup, thanks @fritx!
* bumping electron from 0.32.2 to 0.33.0

2.0.2 / 2015-09-13
==================

* improving tests for rendering
* adding support for screenshot clip rect #107

2.0.1 / 2015-09-13
==================

* updated package.json
* credits to @matthewmueller!


2.0.0 / 2015-06-01
==================
* see #200 for details
* added generator love
* switched to electron to speed things up
* many many thanks to @matthewmueller!


1.8.1 / 2015-04-27
==================

  * Fix escaping of selectors in .wait(selector) thanks @thotypous
  * Updated Mocha link thanks @mortonfox

1.8.0 / 2015-03-23
==================

  * handling phantom crashes more gracefully
  * fixing tests by using a local server and static fixtures
  * feat(docs): add google-oauth2 plugin
  * fixing links
  * clearer ToC and clearer evaluate docs from #89

1.7.0 / 2015-01-26
==================

  * adding pdf ignore, fixing test timeout
  * adding new resourceRequestStarted event for executing in phantomjs context
  * Add scrollTo feature. Resolves #130.
  * Adds zoom feature. Resolves #136.
  * added error handling for requiring file extension in screenshot
  * added documentation for supported filetypes for .screenshot
  * add json parsing guard to test
  * adding link to tests for more examples
  * updating readme with clearer function lists and sections, and mocha test example
  * add readme for headers()
  * add tests for headers()
  * add headers method
  * upping timeouts
  * Add ability to save an A4 sized PDF
  * add check and select

1.6.5 / 2014-11-11
==================

  * updating tests and fixing global port issue
  * Adding sequential test case
  * adding multiple clicks across multiple pages test

1.6.4 / 2014-11-10
==================

  * fixing non-existent elem issue in .visible(), fixes #108

1.6.3 / 2014-11-09
==================

  * bumping circleci test version and timeout
  * eliminating global phantom instance and state, fixes #104

1.6.2 / 2014-11-09
==================

  * .type() now uses uses phantom's sendEvent to trigger keypress events. Fixes #81. (by @johntitus)

1.6.1 / 2014-11-09
==================

  * bumping phantom to ~0.7.0, fixes #101
  * readme tweaks
  * adding resourceError event to docs

1.6.0 / 2014-11-02
==================

  * adding timeout handling (by @johntitus)
  * cleaning up styles in tests, adding tests for timeout event

1.5.3 / 2014-11-02
==================

  * Add ability to specify a custom PhantomJS path (by @kevva)

1.5.2 / 2014-11-02
==================

  * updating readme to explain .on() before .goto()
  * fixing callbacks for .wait()
  * adding grep to makefile tests
  * adding check for file existence before file upload, fixes #11

1.5.1 / 2014-10-26
==================

  * making clicks cancelable to allow for ajax forms


1.5.0 / 2014-10-22
==================

  * adding docs and support for ssl, proxy and other cli args

1.4.0 / 2014-10-22
==================

  * added .exists() (by @johntitus)
  * Added .visible(selector) (by @johntitus)
  * Added .authentication(user,password) (by @johntitus)

1.3.3 / 2014-10-20
==================

  * fix for 'Option to run phantom without weak' (by @securingsincity)

1.3.2 / 2014-10-15
==================

  * clarifying a readme example, see #55

1.3.1 / 2014-10-15
==================

  * expanding the readme (by @johntitus)

1.3.0 / 2014-10-15
==================

  * adding a on() action to handle phantom page events (by @johntitus)

1.2.0 / 2014-10-15
==================

  * adding .forward() method with test (by @stevenmiller888)
  * adding .inject() action, test, and updated readme (by @johntitus)

1.1.1 / 2014-10-08
==================

  * adding wait(selector) test and clojure fix, fixes #39
  * adding extraction readme example
  * adding caveat to viewport docs, fixes #33
  * updating readme example
  * Remove OSX .DS_Store file

1.1.0 / 2014-10-05
==================

 * changing run structure to auto-terminate phantomjs instances
 * naming goBack to back

1.0.5 / 2014-09-30
==================

 * added .goBack()

1.0.4 / 2014-05-12
==================

 * contain zalgo

1.0.3 / 2014-05-12
==================

 * cleaning up run based on ians feedback

1.0.2 / 2014-05-12
==================

 * fixing concat in place
 * cleaning up naming, whitespace, structure.. thanks @ianstormtaylor!
 * fixing readme and history

1.0.1 / 2014-05-10
==================

  * fixing queueing and .use() call order
  * Merge pull request #15 from queckezz/fix/use-queueing
  * fixing tests
  * fixing history
  * queue .use(). Closes #10

1.0.0 / 2014-05-10
==================

  * renaming methods, fixes #18 and #19
  * Merge pull request #17 from queckezz/update/phantomjs-node
  * Merge pull request #16 from stevenschobert/master
  * update phantomjs-node for 0.11.x support
  * add instance option for phantomjs port

0.1.7 / 2014-04-14
==================

  * Merge pull request #14 from queckezz/update/allow-no-args
  * allow no args and fix debug for .evaluate()
  * fixing history

0.1.6 / 2014-04-13
==================

  * adding .url(), more debug()s and a test for .url()
  * fxiing histoyr

0.1.5 / 2014-04-12
==================

  * fixing impatient to only apply to upload since it breaks wait
  * fixing history

0.1.4 / 2014-04-12
==================

  * making callbacks impatient based on timeouts
  * fixing history

0.1.3 / 2014-04-12
==================

  * fixing upload not having a callback
  * fixing history

0.1.2 / 2014-04-11
==================

  * clarifying readme
  * adding refresh method and wait for fn on page refresh
  * reworking wait function to make room for a new wait overload
  * refactoring tests into sections
  * fixing history

0.1.1 / 2014-04-08
==================

  * adding test to duplicate queue ordering issue, fixing issue, fixes #9
  * adding nightmare-swiftly plugin mention with docs
  * fixing history

0.1.0 / 2014-04-07
==================

  * adding .use() to docs
  * Merge pull request #8 from segmentio/use-rewrite
  * adding test for .use() pluggability
  * changes .run() to .evaluate(), removes .error() and cleans up internal wrapping
  * fixing history

0.0.13 / 2014-04-07
==================

  * Merge pull request #6 from segmentio/phantomjs-node
  * fixing done callback, fixing agent setting and adding tests. fixes #4, #2, #3.
  * fixing run callback hanging, fixes #3
  * experimenting with phantomjs-node, for #5
  * Merge branch 'master' of https://github.com/segmentio/nightmare
  * Update Readme.md

0.0.12 / 2014-04-06
==================

  * adding .viewport() and .agent(), fixes #2

0.0.11 / 2014-04-06
==================

  * making debug output consistent
  * consistent naming
  * fixing .wait() readme docs
  * fixing history

0.0.10 / 2014-04-06
==================

  * adding .run() method with docs and test. fixes #1
  * Update Readme.md
  * fixing history

0.0.9 / 2014-04-05
==================

  * adding more debug statements
  * fixing history

0.0.8 / 2014-04-05
==================

  * updating readme for screen and options
  * fixing timeout and adding debug for .screen() method
  * fixing history

0.0.7 / 2014-04-05
==================

  * setting viewport
  * fixing history

0.0.6 / 2014-04-05
==================

  * adding better debug logs for page load detection
  * fixing history

0.0.5 / 2014-04-05
==================

  * fixing history

0.0.4 / 2014-04-05
==================

  * fixing main for require to work
  * fixing history

0.0.3 / 2014-04-05
==================

  * fixing tests and getting screen working
  * fixing history again

0.0.2 / 2014-04-05
==================

  * pkilling phantomjs more aggressively
  * fixing phantom singletons
  * fixing history.md

0.0.1 / 2014-04-05
==================

  * updating readme
  * removing unneded circleci stuff
  * adding circle badge to readme
  * adding circle.yml
  * adding tests with lots of fixes everywhere
  * filling in remaining parts of api
  * filling in wait function
  * filling in lots of the first draft
  * adding new done method
  * blocks sync
  * mvoing
  * all before proceding
  * copyright
  * copy
  * adding more wait options
  * adding in scaffolding and readme outline
