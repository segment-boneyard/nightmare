/**
 * Module dependencies.
 */

require('mocha-generators').install();

var Nightmare = require('..');
var chai = require('chai');
var url = require('url');
var server = require('./server');
var https = require('https');
var fs = require('fs');
var mkdirp = require('mkdirp');
var path = require('path');
var rimraf = require('rimraf');
var child_process = require('child_process');
var PNG = require('pngjs').PNG;
var should = chai.should();
var split = require('split');
var asPromised = require('chai-as-promised');

chai.use(asPromised);

/**
 * Temporary directory
 */

var tmp_dir = path.join(__dirname, 'tmp')

/**
 * Get rid of a warning.
 */

process.setMaxListeners(0);

/**
 * Locals.
 */

var base = 'http://localhost:7500/';

describe('Nightmare', function () {
  before(function (done) {
    server.listen(7500, done);
  });

  it('should be constructable', function*() {
    var nightmare = Nightmare();
    nightmare.should.be.ok;
    yield nightmare.end();
  });

  it('should have version information', function*(){
    var nightmare = Nightmare();
    var versions = yield nightmare.engineVersions();

    nightmare.engineVersions.protocol.should.be.ok;
    versions.protocol.should.be.ok;

    Nightmare.version.should.be.ok;
    yield nightmare.end();
  });

  it('should exit with a non-zero code on uncaughtException', function (done) {
    var child = child_process.fork(
      path.join(__dirname, 'files', 'nightmare-error.js'), [], {silent: true}
    );

    child.once('exit', function(code) {
      code.should.not.equal(0);
      done();
    });
  });

  it('should provide a .catch function', function (done) {
    var nightmare = Nightmare();

    nightmare
      .goto('about:blank')
      .evaluate(function() {
        throw new Error('Test');
      })
      .catch(function(err) {
        done();
      });
  });

  it('should allow ending more than once', function(done){
    var nightmare = Nightmare();
    nightmare.goto(fixture('navigation'))
      .end()
      .then(() => nightmare.end())
      .then(() => done());
  });

  it('should allow end with a callback', function(done){
    var nightmare = Nightmare();
    nightmare.goto(fixture('navigation'))
      .end(() => done());
  });

  it('should allow end with a callback to be thenable', function(done){
    var nightmare = Nightmare();
    nightmare.goto(fixture('navigation'))
      .end(() => 'nightmare')
      .then((str) => {
        str.should.equal('nightmare');
        done();
      });
  });

  it('should successfully end on pages setting onunload or onbeforeunload', function(done) {
    var nightmare = Nightmare();
    nightmare.goto(fixture('unload'))
      .end()
      .then(() => done());
  });

  it('should successfully end on pages binding unload or beforeunload', function(done) {
    var nightmare = Nightmare();
    nightmare.goto(fixture('unload/add-event-listener.html'))
      .end()
      .then(() => done());
  });

  it('should provide useful errors for .click', function(done) {
    var nightmare = Nightmare();

    nightmare
      .goto('about:blank')
      .click('a.not-here')
      .catch(function (error) {
        error.should.include('a.not-here');
        done();
      });
  });

  it('should provide useful errors for .mousedown', function(done) {
    var nightmare = Nightmare();

    nightmare
      .goto('about:blank')
      .mousedown('a.not-here')
      .catch(function (error) {
        error.should.include('a.not-here');
        done();
      });
  });

  it('should provide useful errors for .mouseup', function(done) {
    var nightmare = Nightmare();

    nightmare
      .goto('about:blank')
      .mouseup('a.not-here')
      .catch(function (error) {
        error.should.include('a.not-here');
        done();
      });
  });

  it('should provide useful errors for .mouseover', function(done) {
    var nightmare = Nightmare();

    nightmare
      .goto('about:blank')
      .mouseover('a.not-here')
      .catch(function (error) {
        error.should.include('a.not-here');
        done();
      });
  });

  describe('navigation', function () {
    var nightmare;

    beforeEach(function() {
      nightmare = Nightmare({
        loadTimeout: 45 * 1000,
        waitTimeout: 5 * 1000,
      });
    });

    afterEach(function*() {
      yield nightmare.end();
      Nightmare.resetActions();
    });

    it('should return data about the response', function*() {
      var data = yield nightmare.goto(fixture('navigation'));
      data.should.contain.keys('url', 'code', 'method', 'referrer', 'headers');
    });

    it('should reject with a useful message when no URL', function() {
      return nightmare.goto(undefined).then(
        function () {throw new Error('goto(undefined) didn’t cause an error');},
        function(error) {
          error.should.include('url');
        }
      );
    });

    it('should reject with a useful message for an empty URL', function() {
      return nightmare.goto('').then(
        function () {throw new Error('goto(undefined) didn’t cause an error');},
        function(error) {
          error.should.include('url');
        }
      );
    });

    it('should click on a link and then go back', function*() {
      var title = yield nightmare
        .goto(fixture('navigation'))
        .click('a')
        .wait(1000)
        .title();

      title.should.equal('A')

      title = yield nightmare
        .back()
        .wait(1000)
        .title();

      title.should.equal('Navigation')
    });

    it('should work for links that dont go anywhere', function*() {
      var title = yield nightmare
        .goto(fixture('navigation'))
        .click('a')
        .wait(1000)
        .title();

      title.should.equal('A');

      title = yield nightmare
        .click('.d')
        .title();

      title.should.equal('A');
    });

    it('should click on a link, go back, and then go forward', function*() {
      yield nightmare
        .goto(fixture('navigation'))
        .click('a')
        .back()
        .forward();
    });

    it('should refresh the page', function*() {
      yield nightmare
        .goto(fixture('navigation'))
        .refresh();
    });

    it('should wait until element is present', function*() {
      yield nightmare
        .goto(fixture('navigation'))
        .wait('a');
    });

    it('should soft timeout if element does not appear', function*() {
      yield nightmare
        .goto(fixture('navigation'))
        .wait('ul', 150);
    });

    it('should wait until element is present with a modified poll interval', function*() {
      nightmare = Nightmare({
        pollInterval: 50
      });
      yield nightmare
        .goto(fixture('navigation'))
        .wait('a');
    });

    it('should escape the css selector correctly when waiting for an element', function*() {
      yield nightmare
        .goto(fixture('navigation'))
        .wait('#escaping\\:test');
    });

    it('should wait until the evaluate fn returns true', function*() {
      yield nightmare
        .goto(fixture('navigation'))
        .wait(function () {
          var text = document.querySelector('a').textContent;
          return (text === 'A');
        });
    });

    it('should wait until the evaluate fn with arguments returns true', function*() {
      yield nightmare
        .goto(fixture('navigation'))
        .wait(function (expectedA, expectedB) {
          var textA = document.querySelector('a.a').textContent;
          var textB = document.querySelector('a.b').textContent;
          return (expectedA === textA && expectedB === textB);
        }, 'A', 'B');
    });

    describe('asynchronous wait', function(){
      it('should wait until the evaluate fn with arguments returns true with a callback', function*() {
        yield nightmare
          .goto(fixture('navigation'))
          .wait(function (expectedA, expectedB, done) {
            setTimeout(() => {
              var textA = document.querySelector('a.a').textContent;
              var textB = document.querySelector('a.b').textContent;
              done(null, expectedA === textA && expectedB === textB);
            }, 2000);
          }, 'A', 'B');
      });

      it('should wait until the evaluate fn with arguments returns true with a promise', function*() {
        yield nightmare
          .goto(fixture('navigation'))
          .wait(function (expectedA, expectedB) {
            return new Promise(function(resolve) {
              setTimeout(() => {
                var textA = document.querySelector('a.a').textContent;
                var textB = document.querySelector('a.b').textContent;
                resolve(expectedA === textA && expectedB === textB);
              }, 2000);
            });
          }, 'A', 'B');
      });

      it('should reject timeout on wait', function*() {
        yield nightmare
          .goto(fixture('navigation'))
          .wait(function (done) {
            //never call done
          }).should.be.rejected;
      });

      it('should run multiple times before timeout on wait', function*() {
        yield nightmare
          .goto(fixture('navigation'))
          .wait(function (done) {
            setTimeout(() => done(null, false), 500);
          }).should.be.rejected;
      });
    });

    it('should fail if navigation target is invalid', function() {
      return nightmare.goto('http://this-is-not-a-real-domain.tld')
        .then(
          function() {
            throw new Error('Navigation to an invalid domain succeeded');
          }, function (error) {
            error.should.contain.keys('message', 'details', 'url');
          });
    });

    it('should fail if navigation target is a malformed URL', function(done) {
      nightmare.goto('somewhere out there')
        .then(function() {
          done(new Error('Navigation to an invalid domain succeeded'));
        })
        .catch(function(error) {
          done();
        });
    });

    it('should fail if navigating to an unknown protocol', function(done) {
      nightmare.goto('fake-protocol://blahblahblah')
        .then(function() {
          done(new Error('Navigation to an invalid protocol succeeded'));
        })
        .catch(function(error) {
          done();
        });
    });

    it('should not fail if the URL loads but a resource fails', function() {
      return nightmare.goto(fixture('navigation/invalid-image'));
    });

    it('should not fail if a child frame fails', function() {
      return nightmare.goto(fixture('navigation/invalid-frame'));
    });

    it('should return correct data when child frames are present', function*() {
      var data = yield nightmare.goto(fixture('navigation/valid-frame'));
      data.should.have.property('url');
      data.url.should.equal(fixture('navigation/valid-frame'));
    });

    it('should not fail if response was a valid error (e.g. 404)', function() {
      return nightmare.goto(fixture('navigation/not-a-real-page'));
    });

    it('should fail if the response dies in flight', function(done) {
      nightmare.goto(fixture('do-not-respond'))
        .then(function() {
          done(new Error('Navigation succeeded but server connection died'));
        })
        .catch(function(error) {
          done();
        });
    });

    it('should not fail for a redirect', function() {
      return nightmare.goto(fixture('redirect?url=%2Fnavigation'));
    });

    it('should fail for a redirect to an invalid URL', function(done) {
      nightmare.goto(
        fixture('redirect?url=http%3A%2F%2Fthis-is-not-a-real-domain.tld'))
        .then(function() {
          done(new Error('Navigation succeeded with redirect to bad location'));
        })
        .catch(function(error) {
          done();
        });
    });

    it('should fail immediately/not time out for 304 statuses', function() {
      return Nightmare({gotoTimeout: 500})
        .goto(fixture('not-modified'))
        .end()
        .then(function() {
          throw new Error('Navigating to a 304 should return an error');
        },
        function(error) {
          if (error.code === -7) {
            throw new Error('Navigating to a 304 should not time out');
          }
        });
    });

    describe('timeouts', function () {
      it('should time out after 30 seconds of loading', function() {
        // allow this test to go particularly long
        this.timeout(40000);
        return nightmare.goto(fixture('wait')).should.be.rejected
          .then(function(error) {
            error.code.should.equal(-7);
          });
      });

      // This test passes when run in isolation
      it.skip('should allow custom goto timeout on the constructor', function() {
        var startTime = Date.now();
        return Nightmare({gotoTimeout: 1000}).goto(fixture('wait')).end()
          .should.be.rejected
          .then(function(error) {
            // allow a few extra seconds for browser startup
            (startTime - Date.now()).should.be.below(3000);
          });
      });

      it('should allow a timeout to succeed if DOM loaded', function() {
        return Nightmare({gotoTimeout: 1000})
          .goto(fixture('navigation/hanging-resources.html'))
          .end()
          .then(function(data) {
            data.details.should.include('1000 ms');
          });
      });

      it('should allow actions on a hanging page', function() {
        return Nightmare({gotoTimeout: 500})
          .goto(fixture('navigation/hanging-resources.html'))
          .evaluate(() => document.title)
          .end()
          .then(function(title) {
            title.should.equal('Hanging resource load');
          });
      });

      // "Error: unexpected server response (500)" from DevTools websocket connection
      it.skip('should allow loading a new page after timing out', function() {
        nightmare.end().then();
        nightmare = Nightmare({gotoTimeout: 1000});
        return nightmare.goto(fixture('wait')).should.be.rejected
          .then(function() {
            return nightmare.goto(fixture('navigation'));
          });
      });

      it('should allow for timeouts for non-goto loads', function*() { // ###
        this.timeout(40000);
        var nightmare = Nightmare({loadTimeout: 30000});
        yield nightmare
          .goto(fixture('navigation'))
          .click('#never-ends');

        yield nightmare.end();
      });
    });
  });

  describe('evaluation', function () {
    var nightmare;

    beforeEach(function() {
      nightmare = Nightmare();
    });

    afterEach(function*() {
      yield nightmare.end();
    });

    it('should get the title', function*() {
      var title = yield nightmare
        .goto(fixture('evaluation'))
        .title();
      title.should.eql('Evaluation');
    });

    it('should get the url', function*() {
      var url = yield nightmare
        .goto(fixture('evaluation'))
        .url();
      url.should.have.string(fixture('evaluation'));
    });

    it('should get the path', function*() {
      var path = yield nightmare
        .goto(fixture('evaluation'))
        .path();
      var formalUrl = fixture('evaluation') + '/';

      formalUrl.should.have.string(path);
    });

    it('should check if the selector exists', function*() {
      // existent element
      var exists = yield nightmare
        .goto(fixture('evaluation'))
        .exists('h1.title');
      exists.should.be.true;

      // non-existent element
      exists = yield nightmare.exists('a.blahblahblah');
      exists.should.be.false;
    });

    it('should check if an element is visible', function*() {
      // visible element
      var visible = yield nightmare
        .goto(fixture('evaluation'))
        .visible('h1.title');
      visible.should.be.true;

      // hidden element
      visible = yield nightmare
        .visible('.hidden');
      visible.should.be.false;

        // non-existent element
      visible = yield nightmare
        .visible('#asdfasdfasdf');
      visible.should.be.false;
    });

    it('should evaluate javascript on the page, with parameters', function*() {
      var title = yield nightmare
        .goto(fixture('evaluation'))
        .evaluate(function (parameter) {
          return document.title + ' -- ' + parameter;
        }, 'testparameter');
      title.should.equal('Evaluation -- testparameter');
    });

    it('should capture invalid evaluate fn', function() {
      return nightmare
        .goto(fixture('evaluation'))
        .evaluate('not_a_function')
        .should.be.rejected;
    });

    describe('asynchronous', function(){
      it('should allow for asynchronous evaluation with a callback', function*() {
        var asyncValue = yield nightmare
          .goto(fixture('evaluation'))
          .evaluate(function(done) {
            setTimeout(() => done(null, 'nightmare'), 1000);
          });

          asyncValue.should.equal('nightmare');
      });

      it('should allow for arguments with asynchronous evaluation with a callback', function*() {
        var asyncValue = yield nightmare
          .goto(fixture('evaluation'))
          .evaluate(function(str, done) {
            setTimeout(() => done(null, str), 1000);
          }, 'nightmare');

          asyncValue.should.equal('nightmare');
      });

      it('should allow for errors in asynchronous evaluation with a callback', function*() {
        yield nightmare
          .goto(fixture('evaluation'))
          .evaluate(function(done) {
            setTimeout(() => done(new Error('nightmare')), 1000);
          }).should.be.rejected;
      });

      it('should allow for timeouts in asynchronous evaluation with a callback', function*() {
        this.timeout(40000);
        yield nightmare
          .goto(fixture('evaluation'))
          .evaluate(function(done) {
            //don't call done
          }).should.be.rejected;
      });

      it('should allow for asynchronous evaluation with a promise', function*() {
        var asyncValue = yield nightmare
          .goto(fixture('evaluation'))
          .evaluate(function() {
            return new Promise(resolve => {
              setTimeout(() => resolve('nightmare'), 1000);
            });
          });

          asyncValue.should.equal('nightmare');
      });

      it('should allow for arguments with asynchronous evaluation with a promise', function*() {
        var asyncValue =  yield nightmare
          .goto(fixture('evaluation'))
          .evaluate(function(str) {
            return new Promise(resolve => {
              setTimeout(() => resolve(str), 1000);
            });
          }, 'nightmare')

          asyncValue.should.equal('nightmare');
      });

      it('should allow for errors in asynchronous evaluation with a promise', function*() {
        yield nightmare
          .goto(fixture('evaluation'))
          .evaluate(function () {
            return new Promise((resolve, reject) => {
              setTimeout(() => reject(new Error('nightmare')), 1000);
            });
          }).should.be.rejected;
      });

      it('should allow for timeouts in asynchronous evaluation with a promise', function*() {
        this.timeout(40000);
        yield nightmare
          .goto(fixture('evaluation'))
          .evaluate(function() {
            return new Promise((resolve, reject) => {
              return 'nightmare';
            });
          }).should.be.rejected;
      });
    });
  });

  describe('manipulation', function () {
    var nightmare;

    beforeEach(function() {
      nightmare = Nightmare();
    });

    afterEach(function*() {
      yield nightmare.end();
    });

    it('should inject javascript onto the page', function*() {
      var globalNumber = yield nightmare
        .goto(fixture('manipulation'))
        .inject('js', 'test/files/globals.js')
        .evaluate(function () {
          return globalNumber;
        });
      globalNumber.should.equal(7);

      var numAnchors = yield nightmare
        .goto(fixture('manipulation'))
        .inject('js', 'test/files/jquery-2.1.1.min.js')
        .evaluate(function () {
          return $('h1').length;
        });
      numAnchors.should.equal(1);
    });

    it('should inject javascript onto the page ending with a comment', function*() {
      var globalNumber = yield nightmare
        .goto(fixture('manipulation'))
        .inject('js', 'test/files/globals.js')
        .evaluate(function () {
          return globalNumber;
        });
      globalNumber.should.equal(7);

      var numAnchors = yield nightmare
        .goto(fixture('manipulation'))
        .inject('js', 'test/files/jquery-1.9.0.min.js')
        .evaluate(function () {
          return $('h1').length;
        });
      numAnchors.should.equal(1);
    });

    it('should inject css onto the page', function*() {
      var color = yield nightmare
        .goto(fixture('manipulation'))
        .inject('js', 'test/files/jquery-2.1.1.min.js')
        .inject('css', 'test/files/test.css')
        .evaluate(function () {
          return $('body').css('background-color');
        });
      color.should.equal('rgb(255, 0, 0)');
    });

    it('should not inject unsupported types onto the page', function*() {
      var color = yield nightmare
        .goto(fixture('manipulation'))
        .inject('js', 'test/files/jquery-2.1.1.min.js')
        .inject('pdf', 'test/files/test.css')
        .evaluate(function () {
          return $('body').css('background-color');
        });
      color.should.not.equal('rgb(255, 0, 0)');
    });

    it('should type', function*() {
      var input = 'nightmare';
      var events = input.length * 2;

      var value = yield nightmare
        .on('console', function (type) {
          if (type === 'log') events--;
        })
        .goto(fixture('manipulation'))
        .type('input[type=search]', input)
        .evaluate(function() {
          return document.querySelector('input[type=search]').value;
        });

      value.should.equal('nightmare');
      events.should.equal(0);
    });

    it('should type integer', function* () {
        var input = 10;
        var events = input.toString().length * 2;

        var value = yield nightmare
          .on('console', function (type) {
            if (type === 'log') events--;
          })
          .goto(fixture('manipulation'))
          .type('input[type=search]', input)
          .evaluate(function() {
            return document.querySelector('input[type=search]').value;
          });

        value.should.equal('10');
        events.should.equal(0);
    });

    it('should type object', function* () {
        var input = {
          foo: 'bar'
        };

        var events = input.toString().length * 2;

        var value = yield nightmare
          .on('console', function (type) {
            if (type === 'log') events--;
          })
          .goto(fixture('manipulation'))
          .type('input[type=search]', input)
          .evaluate(function() {
            return document.querySelector('input[type=search]').value;
          });

        value.should.equal('[object Object]');
        events.should.equal(0);
    });

    it('should clear inputs', function*() {
      var input = 'nightmare'
      var events = input.length * 2

      var value = yield nightmare
        .on('console', function (type) {
          if (type === 'log') events--;
        })
        .goto(fixture('manipulation'))
        .type('input[type=search]', input)
        .type('input[type=search]')
        .evaluate(function() {
          return document.querySelector('input[type=search]').value;
        });

      value.should.equal('');
      events.should.equal(0);
    });

    it('should support inserting text', function*() {
      var input = 'nightmare insert typing'

      var value = yield nightmare
        .goto(fixture('manipulation'))
        .insert('input[type=search]', input)
        .evaluate(function() {
          return document.querySelector('input[type=search]').value;
        });

      value.should.equal('nightmare insert typing');
    });

    it('should support clearing inserted text', function*() {
      var value = yield nightmare
        .goto(fixture('manipulation'))
        .insert('input[type=search]')
        .evaluate(function() {
          return document.querySelector('input[type=search]').value;
        });

      value.should.equal('');
    })

    it('should not type in a nonexistent selector', function(){
      return nightmare
        .goto(fixture('manipulation'))
        .type('does-not-exist', 'nightmare')
        .should.be.rejected;
    });

    it('should not insert in a nonexistent selector', function(){
      return nightmare
        .goto(fixture('manipulation'))
        .insert('does-not-exist', 'nightmare')
        .should.be.rejected;
    });

    it('should blur the active element when something is clicked', function*() {
      var isBody = yield nightmare
        .goto(fixture('manipulation'))
        .type('input[type=search]', 'test')
        .click('p')
        .evaluate(function() {
          return document.activeElement === document.body;
        });
      isBody.should.be.true;
    });

    it('should allow for clicking on elements with attribute selectors', function*() {
      yield nightmare
        .goto(fixture('manipulation'))
        .click('div[data-test="test"]')
    });

    it.skip('should not allow for code injection with .click()', function(done){
      var exception;
      nightmare
        .goto(fixture('manipulation'))
        .click('"]\'); document.title = \'injected title\'; (\'"')
        .catch(e => exception = e)
        .then(()=> nightmare.title())
        .then((title) => {
          exception.should.exist;
          title.should.equal('Manipulation');
          done();
        });
    });

    it('should not fail if selector no longer exists to blur after typing', function*() {
      yield nightmare
        .on('console', function(){ console.log(arguments)})
        .goto(fixture('manipulation'))
        .type('input#disappears', 'nightmare');
    });

    it('should type and click', function*() {
      var title = yield nightmare
        .goto(fixture('manipulation'))
        .type('input[type=search]', 'nightmare')
        .click('button[type=submit]')
        .wait(500)
        .title();

      title.should.equal('Manipulation - Results');
    });

    it('should type and click several times', function * () {
      var title = yield nightmare
        .goto(fixture('manipulation'))
        .type('input[type=search]', 'github nightmare')
        .click('button[type=submit]')
        .wait(500)
        .click('a')
        .wait(500)
        .title();
      title.should.equal('Manipulation - Result - Nightmare');
    });

    it('should checkbox', function*() {
      var checkbox = yield nightmare
        .goto(fixture('manipulation'))
        .check('input[type=checkbox]')
        .evaluate(function () {
          return document.querySelector('input[type=checkbox]').checked;
        });
      checkbox.should.be.true;
    });

    it('should uncheck', function*() {
      var checkbox = yield nightmare
        .goto(fixture('manipulation'))
        .check('input[type=checkbox]')
        .uncheck('input[type=checkbox]')
        .evaluate(function () {
          return document.querySelector('input[type=checkbox]').checked;
        });
      checkbox.should.be.false;
    });

    it('should select', function*() {
      var select = yield nightmare
        .goto(fixture('manipulation'))
        .select('select', 'b')
        .evaluate(function () {
          return document.querySelector('select').value;
        });
      select.should.equal('b');
    });

    it('should scroll to specified position', function*() {
      // start at the top
      var coordinates = yield nightmare
        .viewport(320, 320)
        .goto(fixture('manipulation'))
        .evaluate(function () {
          return {
            top: document.body.scrollTop,
            left: document.body.scrollLeft
          };
        });
      coordinates.top.should.equal(0);
      coordinates.left.should.equal(0);

      // scroll down a bit
      coordinates = yield nightmare
        .scrollTo(100, 50)
        .evaluate(function () {
          return {
            top: document.body.scrollTop,
            left: document.body.scrollLeft
          };
        });
      coordinates.top.should.equal(100);
      coordinates.left.should.equal(50);
    });

    it('should hover over an element', function*() {
      var color = yield nightmare
        .goto(fixture('manipulation'))
        .mouseover('h1')
        .evaluate(function () {
          var element = document.querySelector('h1');
          return element.style.background;
        });
      color.should.equal('rgb(102, 255, 102)');
    });

    it('should mousedown on an element', function*() {
      var color = yield nightmare
        .goto(fixture('manipulation'))
        .mousedown('h1')
        .evaluate(function () {
          var element = document.querySelector('h1');
          return element.style.background;
        });
      color.should.equal('rgb(255, 0, 0)');
    });
  });

  describe('cookies', function() {
    var nightmare;

    beforeEach(function () {
      nightmare = Nightmare()
        .goto(fixture('cookie'));
    });

    afterEach(function*() {
      yield nightmare.end();
    });

    it('.set(name, value) & .get(name)', function*() {
      var cookies = nightmare.cookies;

      yield cookies.set('hi', 'hello')
      var cookie = yield cookies.get('hi')

      cookie.name.should.equal('hi')
      cookie.value.should.equal('hello')
      cookie.path.should.equal('/')
      cookie.secure.should.equal(false)
    });

    it('.set(obj) & .get(name)', function*() {
      var cookies = nightmare.cookies

      yield cookies.set({
        name: 'nightmare',
        value: 'rocks',
        path: '/cookie'
      });

      var cookie = yield cookies.get('nightmare')

      cookie.name.should.equal('nightmare')
      cookie.value.should.equal('rocks')
      cookie.path.should.equal('/cookie')
      cookie.secure.should.equal(false)
    });

    it('.set([cookie1, cookie2]) & .get()', function*() {
      var cookies = nightmare.cookies

      yield cookies.set([
        {
          name: 'hi',
          value: 'hello',
          path: '/'
        },
        {
          name: 'nightmare',
          value: 'rocks',
          path: '/cookie'
        }
      ])

      var cookies = yield cookies.get()
      cookies.length.should.equal(2)

      // sort in case they come in a different order
      cookies = cookies.sort(function (a, b) {
        if (a.name > b.name) return 1
        if (a.name < b.name) return -1
        return 0
      })

      cookies[0].name.should.equal('hi')
      cookies[0].value.should.equal('hello')
      cookies[0].path.should.equal('/')
      cookies[0].secure.should.equal(false)

      cookies[1].name.should.equal('nightmare')
      cookies[1].value.should.equal('rocks')
      cookies[1].path.should.equal('/cookie')
      cookies[1].secure.should.equal(false)
    });

    it('.set([cookie1, cookie2]) & .get(query)', function*() {
      var cookies = nightmare.cookies;

      yield cookies.set([
        {
          name: 'hi',
          value: 'hello',
          path: '/'
        },
        {
          name: 'nightmare',
          value: 'rocks',
          path: '/cookie'
        }
      ])

      var cookies = yield cookies.get({ path: '/cookie'})
      cookies.length.should.equal(1)

      cookies[0].name.should.equal('nightmare')
      cookies[0].value.should.equal('rocks')
      cookies[0].path.should.equal('/cookie')
      cookies[0].secure.should.equal(false)
    })

    it('.set([cookie]) & .clear(name) & .get(query)', function*() {
      var cookies = nightmare.cookies

      yield cookies.set([
        {
          name: 'hi',
          value: 'hello',
          path: '/'
        },
        {
          name: 'nightmare',
          value: 'rocks',
          path: '/cookie'
        }
      ])

      yield cookies.clear('nightmare');

      var cookies = yield cookies.get({ path: '/cookie' });

      cookies.length.should.equal(0);
    });

    it('.set([cookie]) & .clear() & .get()', function*() {
      var cookies = nightmare.cookies

      yield cookies.set([
        {
          name: 'hi',
          value: 'hello',
          path: '/'
        },
        {
          name: 'nightmare',
          value: 'rocks',
          path: '/cookie'
        }
      ])

      yield cookies.clear();

      var cookies = yield cookies.get();

      cookies.length.should.equal(0);
    });

    it('.set([cookie]) & .clearAll() & .get()', function*() {
      yield nightmare.cookies.set([
        {
          name: 'hi',
          value: 'hello',
          path: '/'
        },
        {
          name: 'nightmare',
          value: 'rocks',
          path: '/cookie'
        }
      ]);

      yield nightmare.goto(fixture('simple'));

      yield nightmare.cookies.set([
        {
          name: 'hi',
          value: 'hello',
          path: '/'
        },
        {
          name: 'nightmare',
          value: 'rocks',
          path: '/cookie'
        }
      ]);


      yield nightmare.cookies.clearAll();

      var cookies = yield nightmare.cookies.get();
      cookies.length.should.equal(0);

      yield nightmare.goto(fixture('cookie'))

      cookies = yield nightmare.cookies.get();
      cookies.length.should.equal(0);
    })
  });

  describe('rendering', function () {
    var nightmare;

    before(function(done) {
      mkdirp(tmp_dir, done)
    })

    after(function(done) {
      rimraf(tmp_dir, done)
    })

    beforeEach(function() {
      nightmare = Nightmare();
    });

    afterEach(function*() {
      yield nightmare.end();
    });

    it('should take a screenshot', function*() {
      yield nightmare
        .goto('https://github.com/')
        .screenshot(tmp_dir+'/test.png');
      var stats = fs.statSync(tmp_dir+'/test.png');
      stats.size.should.be.at.least(1000);
    });

    it('should buffer a screenshot', function*() {
      var image = yield nightmare
        .goto('https://github.com')
        .screenshot();
      Buffer.isBuffer(image).should.be.true;
      image.length.should.be.at.least(1000);
    });

    it('should take a clipped screenshot', function*() {
      yield nightmare
        .goto('https://github.com/')
        .screenshot(tmp_dir+'/test-clipped.png', {
          x: 200,
          y: 100,
          width: 100,
          height: 100
        });

      var statsClipped = fs.statSync(tmp_dir+'/test-clipped.png');
      statsClipped.size.should.be.at.least(300);
    });

    it('should buffer a clipped screenshot', function*() {
      var image = yield nightmare
        .goto('https://github.com')
        .screenshot({
          x: 200,
          y: 100,
          width: 100,
          height: 100
        });
      Buffer.isBuffer(image).should.be.true;
      image.length.should.be.at.least(300);
    });

    // repeat this test 3 times, since the concern here is non-determinism in
    // the timing accuracy of screenshots -- it might pass once, but likely not
    // several times in a row.
    for (var i = 0; i < 3; i++) {
      it('should screenshot an up-to-date image of the page (' + i + ')', function*() {
        var image = yield nightmare
          .goto('about:blank')
          .viewport(100, 100)
          .evaluate(function() { document.body.style.background = '#900'; })
          .evaluate(function() { document.body.style.background = '#090'; })
          .screenshot();

        var png = new PNG();
        var imageData = yield png.parse.bind(png, image);
        var firstPixel = Array.from(imageData.data.slice(0, 3));
        firstPixel.should.deep.equal([0, 153, 0]);
      });
    }

    it('should screenshot an an idle page', function*() {
      var image = yield nightmare
        .goto('about:blank')
        .viewport(100, 100)
        .evaluate(function() { document.body.style.background = '#900'; })
        .evaluate(function() { document.body.style.background = '#090'; })
        .wait(1000)
        .screenshot();

      var png = new PNG();
      var imageData = yield png.parse.bind(png, image);
      var firstPixel = Array.from(imageData.data.slice(0, 3));
      firstPixel.should.deep.equal([0, 153, 0]);
    });

    it('should load jquery correctly', function*() {
      var loaded = yield nightmare
        .goto(fixture('rendering'))
        .wait(2000)
        .evaluate(function() {
          return !!window.jQuery;
        });
      loaded.should.be.at.least(true);
    });

    it('should render fonts correctly', function*() {
      yield nightmare
        .goto(fixture('rendering'))
        .wait(2000)
        .screenshot(tmp_dir+'/font-rendering.png');
      var stats = fs.statSync(tmp_dir+'/font-rendering.png');
      stats.size.should.be.at.least(1000);
    });

    it('should save as html', function*() {
      yield nightmare
        .goto(fixture('manipulation'))
        .html(tmp_dir+'/test.html');
      var stats = fs.statSync(tmp_dir+'/test.html');
      stats.should.be.ok;
    });

    it('should render a PDF', function*() {
      yield nightmare
        .goto(fixture('manipulation'))
        .pdf(tmp_dir+'/test.pdf');
      var stats = fs.statSync(tmp_dir+'/test.pdf');
      stats.size.should.be.at.least(1000);
    });

    it('should accept options to render a PDF', function*() {
      yield nightmare
        .goto(fixture('manipulation'))
        .pdf(tmp_dir + '/test2.pdf', {printBackground: false});
      var stats = fs.statSync(tmp_dir + '/test2.pdf');
      stats.size.should.be.at.least(1000);
    });

    it('should return a buffer from a PDF with no path', function * () {
      var buf = yield nightmare
        .goto(fixture('manipulation'))
        .pdf({printBackground: false});

      var isBuffer = Buffer.isBuffer(buf);

      buf.length.should.be.at.least(1000);
      isBuffer.should.be.true;
    });
  });

  describe('referer', function() {
    var nightmare;

    beforeEach(function() {
      nightmare = Nightmare();
    });

    afterEach(function*() {
      yield nightmare.end();
    });

    it('should return referer from headers', function*() {
      var referer = 'http://my-referer.tld/';
      var returnedReferer = yield nightmare
        .goto(fixture('referer'), {
          'Referer': referer
        })
        .evaluate(function () {
          return document.body.innerText;
        })
        ;

      referer.should.be.equal(returnedReferer.trim());
    })
  });

  describe('events', function () {
    var nightmare;

    beforeEach(function() {
      nightmare = Nightmare();
    });

    afterEach(function*() {
      yield nightmare.end();
    });

    it('should fire an event on page load complete', function*() {
      var fired = false;
      nightmare
        .on('did-finish-load', function () {
          fired = true;
        });
      yield nightmare
        .goto(fixture('events'));
      fired.should.be.true;
    });

    it('should fire an event on javascript error', function*() {
      var fired = false;
      nightmare
        .on('page', function (type) {
          if (type === 'error') {
            fired = true;
          }
        });
      yield nightmare
        .goto(fixture('events'));
      fired.should.be.true;
    });

    it('should fire an event on javascript console.log', function*() {
      var log = '';

      nightmare.on('console', function (type, str) {
        if (type === 'log') log = str
      });

      yield nightmare.goto(fixture('events'));
      log.should.equal('my log');

      yield nightmare.click('button')
      log.should.equal('clicked');
    });

    it('should fire an event on page load failure', function*() {
      var fired = false;
      nightmare
        .on('did-fail-load', function () {
          fired = true;
        });
      try {
        yield nightmare
          .goto('https://alskdjfasdfuuu.com');
      }
      catch(error) {}
      fired.should.be.true;
    });

    it('should fire an event on javascript window.alert', function*() {
      var alert = '';
      nightmare.on('page', function(type, message){
        if (type === 'alert') {
          alert = message;
        }
      });

      yield nightmare
        .goto(fixture('events'))
        .evaluate(function(){
          alert('my alert');
        });
      alert.should.equal('my alert');
    });

    it('should fire an event on javascript window.prompt', function*() {
      var prompt = '';
      var response = ''
      nightmare.on('page', function(type, message, res){
        if (type === 'prompt') {
          prompt = message;
          response = res
        }
      });

      yield nightmare
        .goto(fixture('events'))
        .evaluate(function(){
          prompt('my prompt');
        });
      prompt.should.equal('my prompt');
    });

    it('should fire an event on javascript window.confirm', function*() {
      var confirm = '';
      var response = ''
      nightmare.on('page', function(type, message, res){
        if (type === 'confirm') {
          confirm = message;
        }
      });

      yield nightmare
        .goto(fixture('events'))
        .evaluate(function(){
          confirm('my confirm');
        });
      confirm.should.equal('my confirm');
    });

    it('should only fire once when using once', function*() {
      var events = 0;

      nightmare.once('page', function(type, message) {
        events++;
      });

      yield nightmare
        .goto(fixture('events'))
      events.should.equal(1);
    });

    it('should remove event listener', function*() {
      var events = 0;
      var handler = function(type, message) {
        if (type === 'alert') {
          events++;
        }
      };

      nightmare.on('page', handler);

      yield nightmare
        .goto(fixture('events'))
        .evaluate(function() {
          alert('alert one');
        });

      nightmare.removeListener('page', handler);

      yield nightmare
        .evaluate(function() {
          alert('alert two');
        });

      events.should.equal(1);
    });
  });

  describe('options', function () {
    var nightmare;
    var server;

    before(function(done) {
      // set up an HTTPS server using self-signed certificates -- Nightmare
      // will only be able to talk to it if 'ignore-certificate-errors' is set.
      server = https.createServer({
        key: fs.readFileSync(path.join(__dirname, 'files', 'server.key')),
        cert: fs.readFileSync(path.join(__dirname, 'files', 'server.crt'))
      }, function(request, response) {
        response.end('ok\n');
      }).listen(0, 'localhost', function() {
        var address = server.address();
        server.url = `https://${address.address}:${address.port}`;
        done();
      });
    });

    after(function() {
      server.close();
      server = null;
    });

    afterEach(function*() {
      yield nightmare.end();
    });

    it('should set useragent', function* () {
      nightmare = new Nightmare();
      var useragent = yield nightmare
        .useragent('firefox')
        .goto(fixture('options'))
        .evaluate(function () {
          return window.navigator.userAgent;
        });
      useragent.should.eql('firefox');
    });

    it('should wait and fail with waitTimeout', function() {
      nightmare = Nightmare({waitTimeout: 254});
      return nightmare
        .goto(fixture('navigation'))
        .wait('foobar')
        .should.be.rejected;
    });

    it('should wait and fail with waitTimeout and a ms wait time', function() {
      nightmare = Nightmare({waitTimeout: 254});
      return nightmare
        .goto(fixture('navigation'))
        .wait(1000)
        .should.be.rejected;
    });

    it('should wait and fail with waitTimeout with queued functions', function() {
      nightmare = Nightmare({waitTimeout: 254});
      return nightmare
        .goto(fixture('navigation'))
        .wait('foobar')
        .exists('baz')
        .should.be.rejected;
    });

    it('should set viewport', function*() {
      var size = { width: 400, height: 300 };

      nightmare = Nightmare(size);
      var result = yield nightmare
        .goto(fixture('options'))
        .evaluate(function () {
          return {
            width: window.innerWidth,
            height: window.innerHeight
          };
        });

      result.width.should.eql(size.width);
      result.height.should.eql(size.height);
    });

    it('should set a single header', function*() {
      nightmare = Nightmare();
      var headers = yield nightmare
        .header('X-Nightmare-Header', 'hello world')
        .goto(fixture('headers'))
        .evaluate(function () {
          return JSON.parse(document.querySelector('pre').innerHTML);
        });
      headers['x-nightmare-header'].should.equal('hello world');
    });

    it('should set all headers', function*() {
      nightmare = Nightmare();
      var headers = yield nightmare
        .header({ 'X-Foo': 'foo', 'X-Bar': 'bar'})
        .goto(fixture('headers'))
        .evaluate(function () {
          return JSON.parse(document.querySelector('pre').innerHTML);
        });
      headers['x-foo'].should.equal('foo');
      headers['x-bar'].should.equal('bar');
    });

    it('should set headers for that request', function*() {
      nightmare = Nightmare();
      var headers = yield nightmare
        .goto(fixture('headers'), { 'X-Nightmare-Header': 'hello world' })
        .evaluate(function () {
          return JSON.parse(document.querySelector('pre').innerHTML);
        });
      headers['x-nightmare-header'].should.equal('hello world');
    });

    it('should allow to use external Promise', function*() {
      nightmare = Nightmare({
        Promise: require('bluebird')
      });

      nightmare.should.be.ok;
      var thenPromise = nightmare.goto('about:blank').then();
      thenPromise.should.be.an.instanceof(require('bluebird'));
      yield thenPromise;
      var catchPromise = nightmare.goto('about:blank').catch();
      catchPromise.should.be.an.instanceof(require('bluebird'));
      yield catchPromise;
      var endPromise = nightmare.goto('about:blank').end().then();
      endPromise.constructor.should.equal(require('bluebird'));
      endPromise.should.be.an.instanceof(require('bluebird'));
      yield endPromise;
    });
  });

  describe('Nightmare.Promise', function() {
    var nightmare;
    afterEach(function*() {
      // `withDeprecationTracking()` messes w/ prototype constructor references
      Nightmare.Promise = require('..').Promise = Promise;
      yield nightmare.end();
    });

    it('should default to native Promise', function*() {
      Nightmare.Promise.should.equal(Promise);
      nightmare = Nightmare();
      nightmare.should.be.ok;
      var thenPromise = nightmare.goto('about:blank').then();
      thenPromise.should.be.an.instanceof(Promise);
      yield thenPromise;
    });

    it('should override default Promise library', function*() {
      // `withDeprecationTracking()` messes w/ prototype constructor references
      Nightmare.Promise = require('..').Promise = require('bluebird');
      Nightmare.Promise.should.equal(require('bluebird'));
      nightmare = Nightmare();
      nightmare.should.be.ok;
      var thenPromise = nightmare.goto('about:blank').then();
      thenPromise.should.be.an.instanceof(require('bluebird'));
      yield thenPromise;
    });

    it('should not override per-instance Promise library', function*() {
      Nightmare.Promise.should.equal(Promise);

      nightmare = Nightmare({ Promise: require('bluebird') });

      nightmare.should.be.ok;
      var thenPromise = nightmare.goto('about:blank').then();
      thenPromise.should.not.be.an.instanceof(Promise);
      thenPromise.should.be.an.instanceof(require('bluebird'));
      yield thenPromise;
    });
  })

  describe('Nightmare.action(name, fn)', function() {
    var nightmare;

    afterEach(function*() {
      yield nightmare.end();
    });

    it('should support custom actions', function*() {
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

      nightmare = new Nightmare();

      var size = yield nightmare
        .goto(fixture('simple'))
        .size()

      size.height.should.be.a('number')
      size.width.should.be.a('number')
    });

    it('should support custom namespaces', function*() {
      Nightmare.action('style', {
        background: function (done) {
          this.evaluate_now(function () {
            return window.getComputedStyle(document.body, null).backgroundColor;
          }, done)
        },
        color: function (done) {
          this.evaluate_now(function () {
            return window.getComputedStyle(document.body, null).color;
          }, done)
        }
      });

      nightmare = Nightmare()
      yield nightmare.goto(fixture('simple'))
      var background = yield nightmare.style.background()
      var color = yield nightmare.style.color()

      background.should.equal('rgba(0, 0, 0, 0)')
      color.should.equal('rgb(0, 0, 0)')
    })
  })

  describe('Nightmare.use', function() {
    var nightmare;

    beforeEach(function() {
      nightmare = Nightmare();
    });

    afterEach(function*() {
      yield nightmare.end();
    });

    it('should support extending nightmare', function*() {
      var tagName = yield nightmare
        .goto(fixture('simple'))
        .use(select('h1'))

      tagName.should.equal('H1')

      function select (tagname) {
        return function (nightmare) {
          nightmare.evaluate(function (tagname) {
            return document.querySelector(tagname).tagName
          }, tagname)
        }
      }
    });
  });
});

/**
 * Generate a URL to a specific fixture.
 *
 * @param {String} path
 * @returns {String}
 */

function fixture(path) {
  return url.resolve(base, path);
}

/**
 * Make plugins resettable for tests
 */
var _action = Nightmare.action;
var _pluginNames = [];
var _existingNamespaces = Nightmare.namespaces.slice();
Nightmare.action = function (name) {
  _pluginNames.push(name);
  return _action.apply(this, arguments);
};
// NOTE: this is somewhat fragile since there's no public API for removing
// plugins. If you touch `Nightmare.action`, please be sure to update this.
Nightmare.resetActions = function () {
  _pluginNames.splice(0, _pluginNames.length).forEach((name) => {
    delete this.prototype[name];
  });

  this.namespaces.splice(0, this.namespaces.length);
  this.namespaces.push.apply(this.namespaces, _existingNamespaces);
};

/**
 * Simple assertion for running processes
 */
chai.Assertion.addProperty('process', function() {
  var running = true;
  try { process.kill(this._obj, 0); } catch(e) { running = false; }
  this.assert(
    running,
    'expected process ##{this} to be running',
    'expected process ##{this} not to be running');
});
