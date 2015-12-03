/**
 * Module dependencies.
 */

require('mocha-generators').install();

var Nightmare = require('..');
var should = require('chai').should();
var url = require('url');
var server = require('./server');
var fs = require('fs');
var mkdirp = require('mkdirp');
var path = require('path');
var rimraf = require('rimraf');

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

  describe('navigation', function () {
    var nightmare;

    beforeEach(function() {
      nightmare = Nightmare();
    });

    afterEach(function*() {
      yield nightmare.end();
    });

    it('should click on a link and then go back', function*() {
      var title = yield nightmare
        .goto(fixture('navigation'))
        .click('a')
        .title()

      title.should.equal('A')

      var title = yield nightmare
        .back()
        .title()

      title.should.equal('Navigation')
    });

    it('should work for links that dont go anywhere', function*() {
      var title = yield nightmare
        .goto(fixture('navigation'))
        .click('a')
        .title()

      title.should.equal('A')

      var title = yield nightmare
        .click('.d')
        .title()

      title.should.equal('A')
    })

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
      var value = yield nightmare
        .goto(fixture('manipulation'))
        .type('input[type=search]', 'nightmare')
        .evaluate(function() {
          return document.querySelector('input[type=search]').value;
        });

      value.should.equal('nightmare');
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

    it('should type and click several times', function*() {
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
      // TODO: fix this in the fixture
      // coordinates.left.should.equal(50);
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
      var stats = fs.statSync(tmp_dir+'/test.png');
      var statsClipped = fs.statSync(tmp_dir+'/test-clipped.png');
      statsClipped.size.should.be.at.least(300);
      stats.size.should.be.at.least(10*statsClipped.size);
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
        .pdf(tmp_dir+'/test2.pdf', {printBackground: false});
      var stats = fs.statSync(tmp_dir+'/test2.pdf');
      stats.size.should.be.at.least(1000);
    });
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
        .on('page-error', function (errorMessage, errorStack) {
          fired = true;
        });
      yield nightmare
        .goto(fixture('events'));
      fired.should.be.true;
    });

    it('should fire an event on javascript console.log', function*() {
      var log = '';
      nightmare
        .on('page-log', function (logs) {
          log = logs[0];
        });
      yield nightmare
        .goto(fixture('events'))
      log.should.equal('my log');
    });

    it('should fire an event on page load failure', function*() {
      var fired = false;
      nightmare
        .on('did-fail-load', function () {
          fired = true;
        });
      yield nightmare
        .goto('https://alskdjfasdfuuu.com');
      fired.should.be.true;
    });
  });

  describe('options', function () {
    var nightmare;

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

    /*
    PENDING FIX UPSTREAM
    https://github.com/atom/electron/issues/1362

    it('should set authentication', function*() {
      var data = yield nightmare
        .authentication('my', 'auth')
        .goto(fixture('auth'))
        .evaluate(function () {
          return JSON.parse(document.querySelector('pre').innerHTML);
        });
      data.should.eql({ name: 'my', pass: 'auth' });
    });
    */

    it('should set viewport', function*() {
      var size = { width: 400, height: 1000, 'use-content-size': true };
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

    /*
    NOT AVAILABLE UPSTREAM in electron

    it('should set headers', function*() {
      var headers = yield Nightmare()
        .headers({ 'X-Nightmare-Header': 'hello world' })
        .goto(fixture('headers'))
        .evaluate(function () {
          return JSON.parse(document.querySelector('pre').innerHTML);
        });
      headers['x-nightmare-header'].should.equal('hello world');
    });
    */

    it('should allow web-preferece settings', function*() {
      nightmare = Nightmare({'web-preferences': {'web-security': false}});
      var result = yield nightmare
        .goto(fixture('options'))
        .evaluate(function () {
          return document.getElementById('example-iframe').contentDocument;
        });

      result.should.be.ok;
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
