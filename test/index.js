
/**
 * Module dependencies.
 */

var Nightmare = require('../lib');
var should = require('should');
var after = require('after');
var server = require('./server');
var url = require('url');

/**
 * Locals.
 */

var base = 'http://localhost:7500/';

describe('Nightmare', function () {
  before(function (done) {
    server.listen(7500, done);
  });

  it('should be constructable', function () {
    var nightmare = new Nightmare();
    nightmare.should.be.ok;
  });

  describe('navigation', function () {
    it('should click on a link and then go back', function (done) {
      new Nightmare()
        .goto(fixture('navigation'))
        .click('a')
        .back()
        .run(done);
    });

    it('should click on a link, go back, and then go forward', function (done) {
      new Nightmare()
        .goto(fixture('navigation'))
        .click('a')
        .back()
        .forward()
        .run(done);
    });

    it('should refresh the page', function (done) {
      new Nightmare()
        .goto(fixture('navigation'))
        .refresh()
        .run(done);
    });

    it('should wait until element is present', function (done) {
      new Nightmare()
        .goto(fixture('navigation'))
        .wait('a')
        .run(done);
    });

    it('should wait until evaluate returns the right value', function (done) {
      new Nightmare()
        .goto(fixture('navigation'))
        .wait(function () {
          return document.querySelector('a').textContent;
        }, 'A')
        .run(done);
    });

    it('should emit the timeout event if the check does not pass while waiting for selector', function (done) {
      var timeoutMessageReceived = false;

      new Nightmare({
          timeout: 1000
        })
        .on('timeout', function (msg) {
          timeoutMessageReceived = true;
        })
        .goto(fixture('navigation'))
        .wait('bbb')
        .run(function () {
          timeoutMessageReceived.should.be.true;
          done();
        });
    });

    it('should emit the timeout event if the check does not pass while waiting for fn==val', function (done) {
      var timeoutMessageReceived = false;

      new Nightmare({
          timeout: 1000
        })
        .on('timeout', function (message) {
          timeoutMessageReceived = true;
        })
        .goto(fixture('navigation'))
        .wait(function () {
          return 'abc';
        }, 1)
        .run(function () {
          timeoutMessageReceived.should.be.true;
          done();
        });
    });
  });

  describe('evaluation', function () {
    it('should get the title', function (done) {
      new Nightmare()
        .goto(fixture('evaluation'))
        .title(function (title) {
          title.should.eql('Evaluation');
        })
        .run(done);
    });

    it('should get the url', function (done) {
      new Nightmare()
        .goto(fixture('evaluation'))
        .url(function (url) {
          url.should.startWith(fixture('evaluation'));
        })
        .run(done);
    });

    it('should check if the selector exists', function (done) {
      new Nightmare()
        .goto(fixture('evaluation'))
        .exists('h1.title', function (exists) {
          exists.should.be.true;
        })
        .exists('a.blahblahblah', function (exists) {
          exists.should.be.false;
        })
        .run(done);
    });

    it('should check if an element is visible', function (done) {
      new Nightmare()
        .goto(fixture('evaluation'))
        // visible element
        .visible('h1.title', function (visible) {
          visible.should.be.true;
        })
        // hidden element
        .visible('.hidden', function (visible) {
          visible.should.be.false;
        })
        // non-existent element
        .visible('#asdfasdfasdf', function (visible) {
          visible.should.be.false;
        })
        .run(done);
    });

    it('should evaluate javascript on the page, with parameters', function (done) {
      new Nightmare()
        .goto(fixture('evaluation'))
        .evaluate(function (parameter) {
          return document.title + ' -- ' + parameter;
        }, function (title) {
          title.should.equal('Evaluation -- testparameter');
        }, 'testparameter')
        .run(done);
    });
  });

  describe('manipulation', function () {
    it('should inject javascript onto the page', function (done) {
      new Nightmare()
        .goto(fixture('manipulation'))
        .inject('js', 'test/files/jquery-2.1.1.min.js')
        .evaluate(function () {
          return $('h1').length;
        }, function (numAnchors) {
          numAnchors.should.equal(1);
        })
        .run(done);
    });

    it('should inject css onto the page', function (done) {
      new Nightmare()
      .goto(fixture('manipulation'))
        .inject('js', 'test/files/jquery-2.1.1.min.js')
        .inject('css', 'test/files/test.css')
        .evaluate(function () {
          return $('body').css('background-color');
        }, function (color) {
          color.should.equal('rgb(255, 0, 0)');
        })
        .run(done);
    });

    it('should not inject unsupported types onto the page', function (done) {
      new Nightmare()
        .goto(fixture('manipulation'))
        .inject('js', 'test/files/jquery-2.1.1.min.js')
        .inject('pdf', 'test/files/test.css')
        .evaluate(function () {
          return $('body').css('background-color');
        }, function (color) {
          color.should.not.equal('rgb(255, 0, 0)');
        })
        .run(done);
    });

    it('should type and click', function (done) {
      new Nightmare()
        .goto(fixture('manipulation'))
        .type('input[type=search]', 'nightmare')
        .click('button[type=submit]')
        .wait(1000)
        .title(function (title) {
          title.should.equal('Manipulation - Results');
        })
        .run(done);
    });

    it('should type and click several times', function (done) {
      new Nightmare()
        .goto(fixture('manipulation'))
        .type('input[type=search]', 'github nightmare')
        .click('button[type=submit]')
        .wait(1000)
        .click('a')
        .wait(1000)
        .title(function (title) {
          title.should.equal('Manipulation - Result - Nightmare');
        })
        .run(done);
    });

    it('should check', function(done){
        new Nightmare()
        .goto(fixture('manipulation'))
        .check('input[type=checkbox]')
        .evaluate(function () {
            return document.querySelector('input[type=checkbox]').checked;
          }, function (value) {
            value.should.be.true;
          })
        .run(done);
    });

    it('should select', function(done){
        new Nightmare()
        .goto(fixture('manipulation'))
        .select('select', 'b')
        .evaluate(function () {
            return document.querySelector('select').value;
          }, function (value) {
            value.should.equal('b');
          })
        .run(done);
    });

    it('should fire a keypress when typing', function(done) {
      new Nightmare()
        .goto(fixture('manipulation'))
        .evaluate(function () {
          window.keypressed = false;
          var element = document.querySelector('input[type=search]');
          element.onkeypress = function () {
            window.keypressed = true;
          };
        })
        .type('input[type=search]', 'nightmare')
        .evaluate(function () {
          return window.keypressed;
        }, function (keypressed) {
          keypressed.should.be.true;
        })
        .run(done);
    });

    it('should scroll to specified position', function(done) {
      new Nightmare()
          .viewport(320, 320)
          .goto(fixture('manipulation'))
          .evaluate(function () {
            return {
              top: document.body.scrollTop,
              left: document.body.scrollLeft
            };
          }, function (coordinates) {
            coordinates.top.should.equal(0);
            coordinates.left.should.equal(0);
          })
          .scrollTo(100, 50)
          .evaluate(function () {
            return {
              top: document.body.scrollTop,
              left: document.body.scrollLeft
            };
          }, function (coordinates) {
            coordinates.top.should.equal(100);
            // TODO: fix this in the fixture
            // coordinates.left.should.equal(50);
          })
          .run(done);
    });
  });

  describe('upload', function () {
    it('should upload a file', function (done) {
      new Nightmare()
        .goto(fixture('upload'))
        .upload('input[type=file]', 'test/files/test.css')
        .click('button[type=submit]')
        .wait(1000)
        .evaluate(function () {
          return JSON.parse(document.body.querySelector('pre').innerHTML)
        }, function (files) {
          files.file.originalname.should.equal('test.css');
        })
        .run(done);
    });

    it('should verify a file exists before upload', function (done) {
      new Nightmare()
        .goto(fixture('upload'))
        .upload('#uploaded_file', 'nope.jpg')
        .run(function (err) {
          err.should.exist;
          done();
        });
    });
  });

  describe('rendering', function () {
    it('should take a screenshot', function (done) {
      new Nightmare()
        .goto(fixture('manipulation'))
        .screenshot('/tmp/nightmare/test.png')
        .run(done);
    });

    it('should render a PDF', function (done) {
      new Nightmare()
        .pdf('/tmp/nightmare/test.pdf')
        .run(done);
    });
  });

  describe('events', function () {
    it.skip('should fire an event on initialized', function (done) {
      var fired = false;
      new Nightmare()
        .on('initialized', function () {
          fired = true;
        })
        .goto(fixture('events'))
        .wait(1000)
        .run(function () {
          fired.should.be.true;
          done();
        });
    });

    it('should fire an event on load started', function (done) {
      var fired = false;
      new Nightmare()
        .on('loadStarted', function () {
          fired = true;
        })
        .goto(fixture('events'))
        .run(function () {
          fired.should.be.true;
          done();
        });
    });

    it('should fire an event on load finished', function (done) {
      var fired = false;
      new Nightmare()
        .on('loadFinished', function (status) {
          fired = (status === 'success');
        })
        .goto(fixture('events'))
        .run(function () {
          fired.should.be.true;
          done();
        });
    });

    it('should fire an event when a resource is requested', function (done) {
      var fired = false;
      new Nightmare()
        .on('resourceRequested', function () {
          fired = true;
        })
        .goto(fixture('events'))
        .run(function () {
          fired.should.be.true;
          done();
        });
    });

    it('should fire an event when a resource is received', function (done) {
      var fired = false;
      new Nightmare()
        .on('resourceReceived', function () {
          fired = true;
        })
        .goto(fixture('events'))
        .run(function () {
          fired.should.be.true;
          done();
        });
    });

    it('should fire an event when navigation requested', function (done) {
      var fired = false;
      new Nightmare()
        .on('navigationRequested', function (url) {
          fired = true;
        })
        .goto(fixture('events'))
        .run(function () {
          fired.should.be.true;
          done();
        });
    });

    it('should fire an event when the url changes', function (done) {
      var fired = false;
      new Nightmare()
        .on('urlChanged', function (url) {
          url.should.startWith(fixture('events'));
          fired = true;
        })
        .goto(fixture('events'))
        .run(function () {
          fired.should.be.true;
          done();
        });
    });

    it.skip('should fire an event when a console message is seen', function (done) {
      var fired = false;
      new Nightmare()
        .on('consoleMessage', function () {
          fired = true;
        })
        .goto(fixture('events'))
        .evaluate(function () {
          console.log('message');
        })
        .run(function () {
          fired.should.be.true;
          done();
        });
    });

    it.skip('should fire an event when an alert is seen', function (done) {
      var fired = false;
      new Nightmare()
        .on('alert', function () {
          fired = true;
        })
        .goto(fixture('events'))
        .evaluate( function () {
          alert('ohno');
        })
        .run(function () {
          fired.should.be.true;
          done();
        });
    });

    it('should fire an event when a prompt is seen', function (done) {
      var fired = false;
      new Nightmare()
        .on('prompt', function () {
          fired = true;
        })
        .goto(fixture('events'))
        .evaluate(function () {
          prompt('whowhatwherehow???');
        })
        .run(function () {
          fired.should.be.true;
          done();
        });
    });

    it('should fire an event when an error occurs', function (done) {
      var fired = false;
      new Nightmare()
        .on('error', function () {
          fired = true;
        })
        .goto(fixture('events'))
        .evaluate(function () {
          return aaa;
        })
        .run(function () {
          fired.should.be.true;
          done();
        });
    });

    it('should fire the exit handler once the process exits', function (done) {
      new Nightmare()
        .on('exit', function (code, signal) {
          done();
        })
        .goto('http://example.com')
        .run(function (err, nightmare) {
          if (err) return done(err);
          nightmare.phantomJS.process.kill(); // force the handler above to fire
        });
    });

    it('should throw when an exit handler is not defined', function (done) {
      // we need to override mocha's listener, but not remove them forever (just for this test)
      var listeners = process.listeners('uncaughtException');
      process.removeAllListeners('uncaughtException');
      // now, we can add our own listener (as a one-time so it will be removed automatically)
      process.once('uncaughtException', function (err) {
        // re-attach the listeners we saved earlier
        listeners.forEach(function (fn) {
          process.on('uncaughtException', fn);
        });

        // now run our assertions
        checkError(err);
      });

      new Nightmare()
        .goto('http://example.com')
        .run(function (err, nightmare) {
          if (err) return done(err);
          nightmare.phantomJS.process.kill(); // force the uncaught exception
        });

      function checkError(err) {
        err.message.should.equal('the phantomjs process ended unexpectedly');
        done();
      }
    });

  });

  describe('options', function () {
    it('should set agent', function (done) {
      new Nightmare()
        .useragent('firefox')
        .goto(fixture('options'))
        .evaluate(function () {
          return window.navigator.userAgent;
        }, function (res) {
          res.should.eql('firefox');
        })
        .run(done);
    });

    it('should set authentication', function (done) {
      new Nightmare()
        .authentication('my', 'auth')
        .goto(fixture('auth'))
        .evaluate(function () {
          return JSON.parse(document.querySelector('pre').innerHTML);
        }, function (data) {
          data.should.eql({ name: 'my', pass: 'auth' });
        })
        .run(done);
    });

    it('should set viewport', function (done) {
      var size = { width: 400, height: 1000 };
      new Nightmare()
        .viewport(size.width, size.height)
        .goto(fixture('options'))
        .evaluate(function () {
          return {
            width: window.innerWidth,
            height: window.innerHeight
          };
        }, function (res) {
          res.should.eql(size);
        })
        .run(done);
    });

    it('should scale the window contents', function(done) {
      new Nightmare()
        .viewport(1600, 900)
        .goto(fixture('options'))
        .wait()
        .screenshot('/tmp/nightmare/testScaleDefault.png')
        .viewport(3200, 1800)
        .zoom(2)
        .goto(fixture('options'))
        .wait()
        .screenshot('/tmp/nightmare/testScaleIs2.png')
        .run(done);
    });

    it('should set headers', function (done) {
      new Nightmare()
        .headers({ 'X-Nightmare-Header': 'hello world' })
        .goto(fixture('headers'))
        .evaluate(function () {
          return JSON.parse(document.querySelector('pre').innerHTML);
        }, function (headers) {
          headers['x-nightmare-header'].should.equal('hello world');
        })
        .run(done);
    });
  });

  describe('multiple', function () {
    it('should run fine with two instances in parallel', function (done) {
      var partiallyDone = after(2, done);

      new Nightmare()
        .goto(fixture('simple'))
        .evaluate(function () {
          return document.documentElement.innerHTML;
        }, function (res) {
          res.length.should.be.greaterThan(1);
          partiallyDone();
        })
        .run();

      new Nightmare()
      .goto(fixture('simple'))
        .evaluate(function () {
          return document.documentElement.innerHTML;
        }, function (res) {
          res.length.should.be.greaterThan(1);
          partiallyDone();
        })
        .run();
    });

    it('should run fine with one instance in sequence', function (done) {
      new Nightmare()
        .goto(fixture('simple'))
        .evaluate(function () {
          return document.documentElement.innerHTML;
        }, function (res) {
          res.length.should.be.greaterThan(1);
        })
        .run(function (err, nightmare) {

          nightmare
            .goto(fixture('simple'))
            .evaluate(function () {
              return document.documentElement.innerHTML;
            }, function (res) {
              res.length.should.be.greaterThan(1);
            }).run(function (err, nightmare) {
              done();
            });

        });
    });
  });

  describe('queue', function () {
    it('should be ok with no callback to run', function (done) {
      var nightmare = new Nightmare()
        .goto(fixture('simple'))
        .run();

      setTimeout(done, 4000);
    });

    it('should execute the queue in order', function (done) {
      var queue = [];
      new Nightmare()
        .goto(fixture('simple'))
        .title(function (title) {
          queue.push(1);
        })
        .run(function (err, nightmare) {
          queue.push(2);
          queue.should.eql([1, 2]);
          done();
        });
    });

    it('should be pluggable with .use()', function (done) {
      function testTitle(term) {
        return function (nightmare) {
          nightmare
            .title(function (title) {
              title.should.equal(term);
            });
        };
      }

      new Nightmare()
        .goto(fixture('simple'))
        .use(testTitle('Simple'))
        .run(done);
    });

    it('should execute the plugins in order', function (done) {
      var queue = [];
      new Nightmare()
        .goto(fixture('simple'))
        .evaluate(function () {
          window.testQueue = [];
          window.testQueue.push(1);
        }, function () {
          queue.push(1);
        })
        .use(function (nightmare) {
          nightmare
            .evaluate(function () {
              window.testQueue.push(2);
            });
          queue.push(2);
        })
        .use(function (nightmare) {
          nightmare
            .evaluate(function () {
              window.testQueue.push(3);
            });
          queue.push(3);
        })
        .evaluate(function () {
          return window.testQueue;
        }, function (testQueue) {
          testQueue.should.eql([1, 2, 3]);
        })
        .run(function (err, nightmare) {
          queue.should.eql([1, 2, 3]);
          done();
        });
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
