
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
