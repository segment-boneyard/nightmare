var Nightmare = require('../lib');
var should = require('should');
var after = require('after');

describe('Nightmare', function () {
  this.timeout(40000);

  it('should be constructable', function () {
    var nightmare = new Nightmare();
    nightmare.should.be.ok;
  });

  /**
   * navigation
   */

  describe('navigation', function () {

    it('should click on a link and then go back', function (done) {
      new Nightmare()
        .goto('http://www.nightmarejs.org/')
        .click('a')
        .back()
        .run(done);
    });

    it('should click on a link, go back, and then go forward', function (done) {
      new Nightmare()
        .goto('http://www.google.com/')
        .click('a')
        .back()
        .forward()
        .run(done);
    });

    it('should goto wikipedia.org', function (done) {
      new Nightmare()
        .goto('http://www.wikipedia.org/')
        .run(done);
    });

    it('should refresh the page', function (done) {
      new Nightmare()
        .goto('http://www.wikipedia.org/')
        .refresh()
        .run(done);
    });

    it('should get the url', function (done) {
      new Nightmare()
        .goto('http://www.wikipedia.org/')
        .url(function (url) {
          url.should.eql('http://www.wikipedia.org/');
        })
        .run(done);
    });

    it('should check if the selector exists', function (done) {
      new Nightmare()
        .goto('http://www.wikipedia.org/')
        .exists('a.link-box', function (exists) {
          exists.should.be.true;
        })
        .exists('a.blahblahblah', function (exists) {
          exists.should.be.false;
        })
        .run(done);
    });

    it('should get the title', function (done) {
      new Nightmare()
        .goto('http://www.wikipedia.org/')
        .title(function (title) {
          title.should.eql('Wikipedia');
        })
        .run(done);
    });

    it('should check if an element is visible', function (done) {
      new Nightmare()
        .goto('http://www.wikipedia.org/')
        // hidden element
        .visible('input[type="hidden"]', function (visible) {
          visible.should.be.false;
        })
        // non-existent element
        .visible('#asdfasdfasdf', function (visible) {
          visible.should.be.false;
        })
        // visible element
        .visible('#searchInput', function (visible) {
          visible.should.be.true;
        })
        .run(done);
    });

  });

  /**
   * manipulation
   */

  describe('manipulation', function () {

    it('should evaluate javascript on the page, with parameters', function (done) {
      new Nightmare()
        .goto('http://yahoo.com')
        .evaluate(function (parameter) {
          return document.title + ' -- ' + parameter;
        }, function (title) {
          title.should.equal('Yahoo -- testparameter');
        }, 'testparameter')
        .run(done);
    });

    it('should inject javascript onto the page', function (done) {
      new Nightmare()
        .goto('http://google.com')
        .inject('js', 'test/files/jquery-2.1.1.min.js')
        .evaluate(function () {
          return $('a').length;
        }, function (numAnchors) {
          numAnchors.should.be.greaterThan(0);
        })
        .run(done);
    });

    it('should inject css onto the page', function (done) {
      new Nightmare()
        .goto('http://google.com')
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
        .goto('http://google.com')
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
        .goto('http://yahoo.com')
        .type('input[title="Search"]', 'github nightmare')
        .click('.searchsubmit')
        .wait()
        .evaluate(function () {
          return document.title;
        }, function (title) {
          title.should.equal('github nightmare - Yahoo Search Results');
        })
        .run(function (err, nightmare) {
          nightmare.should.be.ok;
          done();
        });
    });

    it('should type and click several times', function (done) {
      new Nightmare()
        .goto('http://yahoo.com')
        .type('input[title="Search"]', 'github nightmare')
        .click('.searchsubmit')
        .wait()
        .click('.breadcrumb_link')
        .wait()
        .evaluate(function () {
          return document.title;
        }, function (title) {
          title.should.equal('Segment · GitHub');
        })
        .run(function (err, nightmare) {
          nightmare.should.be.ok;
          done();
        });
    });

    it('should check and select', function(done){
        new Nightmare()
        .goto('https://twitter.com/search-advanced')
        .type('input[name="to"]', "@segment")
        .check('input[name="attd"][value=":)"]')
        .select('#lang', 'en')
        .click('button[value="go"]')
        .wait()
        .evaluate(function () {
            return document.title;
          }, function (title) {
            title.should.equal('lang:en to:segment :) - Twitter Search');
          })
        .run(done);
    });

    it('should fire a keypress when typing', function(done) {
      new Nightmare()
        .goto('http://www.yahoo.com')
        .evaluate(function () {
          window.keypressed = false;
          var element = document.querySelector('input[title="Search"]');
          element.onkeypress = function () {
            window.keypressed = true;
          };
        })
        .type('input[title="Search"]', 'github')
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
          .goto('http://www.yahoo.com')
          .wait()
          .evaluate(function () {
            return {
              top: document.body.scrollTop,
              left: document.body.scrollLeft
            };
          }, function (coordinates) {
            coordinates.top.should.equal(0);
            coordinates.left.should.equal(0);
          })
          .scrollTo(100,50)
          .evaluate(function () {
            return {
              top: document.body.scrollTop,
              left: document.body.scrollLeft
            };
          }, function (coordinates) {
            coordinates.top.should.equal(100);
            coordinates.left.should.equal(50);
          })
          .run(done);
    });

    it('should upload a file', function (done) {
      new Nightmare()
        .goto('http://validator.w3.org/#validate_by_upload')
        .upload('#uploaded_file', 'test/files/jquery-2.1.1.min.js')
        .evaluate(function () {
          return document.getElementById('uploaded_file').value;
        }, function (value) {
          // For a 'C:\fakepath\' explanation, see:
          // http://davidwalsh.name/fakepath
          value.should.equal('C:\\fakepath\\jquery-2.1.1.min.js')
        })
        .run(done);
    });

    it('should verify a file exists before upload', function (done) {
      new Nightmare()
          .goto('http://validator.w3.org/#validate_by_upload')
          .upload('#uploaded_file', 'nope.jpg')
          .run(function (err) {
            err.should.exist;
            done();
          });
    });

    it('should take a screenshot', function (done) {
      new Nightmare()
        .goto('http://yahoo.com')
        .screenshot('test/test.png')
        .run(done);
    });

    it('should render a PDF', function (done) {
      new Nightmare()
        .goto('http://yahoo.com')
        .pdf('test/test.pdf')
        .run(done);
    });

    it('should wait until element is present', function (done) {
      new Nightmare()
        .goto('http://www.google.com/')
        .wait('input')
        .run(done);
    });

    it('should wait until specific text is present', function (done) {
      var seconds = function () {
        var gifs = document.querySelectorAll('img');
        var split = gifs[gifs.length-2].src.split('.gif')[0];
        var seconds = split.split('.com/c')[1];
        return parseInt(seconds, 10);
      };

      new Nightmare()
        .goto('http://onlineclock.net/')
        .wait(seconds, 1)
        .run(done);
    });

    it('should refresh the page until specific text is present', function (done) {
      var seconds = function () {
        var text = document.querySelectorAll('b')[0].textContent;
        var splits = text.split(/\s/);
        var seconds = splits[splits.length-2].split(':')[2];
        return parseInt(seconds, 10)%10;
      };

      new Nightmare()
        .goto('http://www.whattimeisit.com/')
        .wait(seconds, 1, 1500)
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
        .goto('http://www.google.com/')
        .wait('bbb')
        .run(function () {
          timeoutMessageReceived.should.be.true;
          done();
        });
    });

    it('should emit the timeout event if the check does not pass while waiting for fn==val', function (done) {
      var seconds = function () {
        var gifs = document.querySelectorAll('img');
        var split = gifs[gifs.length-2].src.split('.gif')[0];
        var seconds = split.split('als/c')[1]
        return parseInt(seconds, 10);
      };

      var timeoutMessageReceived = false;
      new Nightmare({
          timeout: 1000
        })
        .on('timeout', function (message) {
          timeoutMessageReceived = true;
        })
        .goto('http://onlineclock.net/')
        .wait(seconds, 1)
        .run(function () {
          timeoutMessageReceived.should.be.true;
          done();
        });
    });

  });

  /**
   * events
   */

  describe('events', function () {
    var step1url = 'http://en.wikipedia.org/wiki/DOM_events';
    var step2url = 'http://en.wikipedia.org/wiki/DOM_events#Event_flow';

    it('should fire an event on initialized', function (done) {
      var fired = false;
      new Nightmare()
        .on('initialized', function () {
          fired = true;
        })
        .goto('http://www.yahoo.com')
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
        .goto('http://www.yahoo.com')
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
        .goto('http://www.yahoo.com')
        .run(function () {
          fired.should.be.true;
          done();
        });
    });

    it('should fire an event when a resource request is started', function (done) {
      var fired = false;
      new Nightmare()
        .on('resourceRequestStarted', function (requestData, networkRequest) {          
          if (requestData.url.indexOf('yui') !== 0) {
            networkRequest.abort();
          }
        })
        .goto('http://www.yahoo.com')
        .evaluate(function () {
          return window.YUI;
        }, function (yui) {
          fired = !yui;
        })
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
        .goto('http://www.yahoo.com')
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
        .goto('http://www.yahoo.com')
        .run(function () {
          fired.should.be.true;
          done();
        });
    });

    it('should fire an event when navigation requested', function (done) {
      var fired = false;
      new Nightmare()
        .on('navigationRequested', function (url) {
          fired = (url === 'https://www.yahoo.com/');
        })
        .goto('https://www.yahoo.com')
        .run(function () {
          fired.should.be.true;
          done();
        });
    });

    it('should fire an event when the url changes', function (done) {
      var fired = false;
      new Nightmare()
        .on('urlChanged', function (url) {
          fired = (url === 'https://www.yahoo.com/');
        })
        .goto('https://www.yahoo.com')
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
        .goto('http://www.yahoo.com')
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
        .goto('http://www.yahoo.com')
        .evaluate( function () {
          alert('ohno');
        })
        .run(function () {
          fired.should.be.true;
          done();
        });
    });

    it.skip('should fire an event when a prompt is seen', function (done) {
      var fired = false;
      new Nightmare()
        .on('prompt', function () {
          fired = true;
        })
        .goto('http://www.yahoo.com')
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
        .goto('http://www.google.com')
        .evaluate(function () {
          return aaa;
        })
        .run(function () {
          fired.should.be.true;
          done();
        });
    });
  });

  /**
   * options
   */

  describe('options', function () {

    it('should set agent', function (done) {
      new Nightmare()
        .useragent('firefox')
        .goto('http://www.wikipedia.org/')
        .evaluate(function () {
          return window.navigator.userAgent;
        }, function (res) {
          res.should.eql('firefox');
        })
        .run(done);
    });

    it('should set authentication', function (done) {
      new Nightmare()
        .authentication('my','auth')
        .goto('http://httpbin.org/basic-auth/my/auth')
        .evaluate(function () {
          return document.body.innerHTML;
        }, function (data){
          data.length.should.be.above(0);
        })
        .run(done);
    });

    it('should set viewport', function (done) {
      var size = { width : 400, height: 1000 };
      new Nightmare()
        .viewport(size.width, size.height)
        .goto('http://www.wikipedia.org/')
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
          .goto('http://www.wikipedia.org')
          .wait()
          .screenshot('test/testScaleDefault.png')
          .viewport(3200, 1800)
          .zoom(2)
          .goto('http://www.wikipedia.org')
          .wait()
          .screenshot('test/testScaleIs2.png')
          .run(done);
    });

    it('should set headers', function (done) {
      var headers = {
        'X-Nightmare-Header': 'hello world'
      };
      new Nightmare()
        .headers(headers)
        .goto('http://httpbin.org/headers')
        .evaluate(function () {
          return document.body.children[0].innerHTML;
        }, function (data) {
          var json = null;
          (function () {
            json = JSON.parse(data);
          }).should.not.throw();
          json.should.have.property('headers');
          json.headers.should.have.property('X-Nightmare-Header');
          json.headers['X-Nightmare-Header'].should.equal('hello world');
        })
        .run(done);
    });

  });

  /**
   * multiple
   */
  
  describe('multiple', function () {

    it('should run fine with two instances in parallel', function (done) {
      var partiallyDone = after(2, done);
      new Nightmare()
        .goto('http://www.nytimes.com/')
        .evaluate(function () {
          return document.documentElement.innerHTML;
        }, function (res) {
          res.length.should.be.greaterThan(1);
          partiallyDone();
        })
        .run();
      new Nightmare()
        .goto('http://www.gnu.org/')
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
        .goto('http://www.nytimes.com/')
        .evaluate(function () {
          return document.documentElement.innerHTML;
        }, function (res) {
          res.length.should.be.greaterThan(1);
        })
        .run(function (err, nightmare) {

          nightmare.goto('http://www.yahoo.com/')
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

  /**
   * queue
   */

 describe('queue', function () {

    it('should be ok with no callback to run', function (done) {
      var nightmare = new Nightmare().goto('http://yahoo.com');
      nightmare.run();
      setTimeout(done, 4000);
    });

    it('should execute the queue in order', function (done) {
      var queue = [];
      new Nightmare()
        .goto('http://www.kayak.com/')
        .evaluate(function () {
          return document.title;
        }, function (title) {
          queue.push(1);
        })
        .run(function (err, nightmare) {
          queue.push(2);
          queue.should.eql([1, 2]);
          done();
        });
    });

    it('should be pluggable with .use()', function (done) {
      function search(term) {
        return function (nightmare) {
          nightmare
            .goto('http://yahoo.com')
              .type('.input-query', term)
              .click('.searchsubmit')
            .wait();
        };
      }
      function testTitle(term) {
        return function (nightmare) {
          nightmare
            .evaluate(function () {
              return document.title;
            }, function (title) {
              title.should.equal(term + ' - Yahoo Search Results');
            });
        };
      }
      new Nightmare()
        .use(search('test term'))
        .use(testTitle('test term'))
        .run(done);
    });

    it('should execute the plugins in order', function (done) {
      var queue = [];
      new Nightmare()
        .goto('http://yahoo.com')
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
        .type('.input-query', 'github nightmare')
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
