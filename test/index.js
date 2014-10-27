var Nightmare = require('../lib');
var should = require('should');
var express = require('express');
var path = require('path');

describe('Nightmare', function(){
  this.timeout(20000);

  var app, server, serverUrl;

  before(function(done){
    app = express();
    var port = process.env.PORT || 4567;
    app.use(express.static(path.join(__dirname, 'files')));
    server = app.listen(port, function() {
      serverUrl = 'http://localhost:' + port + '/';
      console.log('test server listening on port %s', port);
      done();
    });
  });

  after(function(done){
    server.close(done);
  });

  it('should be constructable', function(){
    var nightmare = new Nightmare();
    nightmare.should.be.ok;
  });

  /**
   * navigation
   */

  describe('navigation', function(){

    it('should click on a link and then go back', function(done) {
      new Nightmare()
        .goto('http://www.nightmarejs.org/')
        .click('a')
        .back()
        .run(done);
    });

    it('should click on a link, go back, and then go forward', function(done) {
      new Nightmare()
        .goto('http://www.google.com/')
        .click('a')
        .back()
        .forward()
        .run(done);
    });

    it('should goto wikipedia.org', function(done) {
      new Nightmare()
        .goto('http://www.wikipedia.org/')
        .run(done);
    });

    it('should refresh the page', function(done) {
      new Nightmare()
        .goto('http://www.wikipedia.org/')
        .refresh()
        .run(done);
    });

    it('should get the url', function(done) {
      new Nightmare()
        .goto('http://www.wikipedia.org/')
        .url(function (url) {
          url.should.eql('http://www.wikipedia.org/');
        })
        .run(done);
    });

    it('should check if the selector exists', function(done) {
      new Nightmare()
        .goto('http://www.wikipedia.org/')
        .exists("a.link-box", function (exists) {
          exists.should.be.true;
        })
        .exists("a.blahblahblah", function (exists) {
          exists.should.be.false;
        })
        .run(done);
    });

    it('should get the title', function(done) {
      new Nightmare()
        .goto('http://www.wikipedia.org/')
        .title(function (title) {
          title.should.eql('Wikipedia');
        })
        .run(done);
    });

    it('should check if an element is visible', function(done) {
      new Nightmare()
        .goto('http://www.wikipedia.org/')
        .visible("input[type='hidden']",function(visible) {
          visible.should.be.false;
        })
        .visible("#searchInput",function(visible) {
          visible.should.be.true;
        })
        .run(done);
    });

  });

  /**
   * manipulation
   */

  describe('manipulation', function(){

    it('should evaluate javascript on the page, with parameters', function(done) {
      new Nightmare()
        .goto('http://yahoo.com')
        .evaluate(function (parameter) {
          return document.title + ' -- ' + parameter;
        }, function (title) {
          title.should.equal('Yahoo -- testparameter');
        }, 'testparameter')
        .run(done);
    });

    it('should inject javascript onto the page', function( done ){
      new Nightmare()
        .goto('http://google.com')
        .inject('js', 'test/files/jquery-2.1.1.min.js')
        .evaluate( function(){
          return $("a").length;
        }, function( numAnchors ){
          numAnchors.should.be.greaterThan( 0 );
        })
        .run(done);
    });

    it('should inject css onto the page', function( done ){
      new Nightmare()
        .goto('http://google.com')
        .inject('js', 'test/files/jquery-2.1.1.min.js')
        .inject('css', 'test/files/test.css')
        .evaluate( function(){          
          return $("body").css("background-color");
        }, function( color ){
          color.should.equal("rgb(255, 0, 0)");
        })
        .run(done);
    });

    it('should not inject unsupported types onto the page', function( done ){
      new Nightmare()
        .goto('http://google.com')
        .inject('js', 'test/files/jquery-2.1.1.min.js')
        .inject('pdf', 'test/files/test.css')
        .evaluate( function(){          
          return $("body").css("background-color");
        }, function( color ){
          color.should.not.equal("rgb(255, 0, 0)");
        })
        .run(done);
    });
  
    it('should type and click', function(done) {
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

    it('should take a screenshot', function(done) {
      new Nightmare()
        .goto('http://yahoo.com')
        .screenshot('test/test.png')
        .run(done);
    });

    it('should wait until element is present', function(done) {
      new Nightmare()
        .goto('http://www.google.com/')
        .wait('input')
        .run(done);
    });

    it('should wait until specific text is present', function(done) {
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

    it('should wait until specific text is present', function(done) {
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

  });

  /**
   * events
   */

  describe('events', function(){
    var step1url = "http://en.wikipedia.org/wiki/DOM_events",
        step2url = "http://en.wikipedia.org/wiki/DOM_events#Event_flow";
    
    it('should fire an event on initialized', function(done) {
      var fired = false;
      new Nightmare()
        .on("initialized", function(){
          fired = true;          
        })
        .goto("http://www.yahoo.com")
        .run(function(){
          fired.should.be.true;
          done();
        });
    });

    it('should fire an event on load started', function(done) {
      var fired = false;
      new Nightmare()
        .on("loadStarted", function(){          
          fired = true;
        })
        .goto("http://www.yahoo.com")
        .run(function(){
          fired.should.be.true;
          done();
        });
    });

    it('should fire an event on load finished', function(done) {
      var fired = false;
      new Nightmare()
        .on("loadFinished", function(status){
          fired = (status === "success");
        })
        .goto("http://www.yahoo.com")
        .run(function(){
          fired.should.be.true;
          done();
        });
    });

    it('should fire an event when a resource is requested', function(done) {
      var fired = false;
      new Nightmare()
        .on("resourceRequested", function(){          
          fired = true;
        })
        .goto("http://www.yahoo.com")
        .run(function(){
          fired.should.be.true;
          done();
        });
    });

    it('should fire an event when a resource is received', function(done) {
      var fired = false;
      new Nightmare()
        .on("resourceReceived", function(){          
          fired = true;
        })
        .goto("http://www.yahoo.com")
        .run(function(){
          fired.should.be.true;
          done();
        });
    });

    it('should fire an event when navigation requested', function(done) {
      var fired = false;
      new Nightmare()
        .on("navigationRequested", function(url){
          fired = (url==="https://www.yahoo.com/");
        })
        .goto("https://www.yahoo.com")
        .run(function(){
          fired.should.be.true;
          done();
        });
    });

    it('should fire an event when the url changes', function(done) {
      var fired = false;
      new Nightmare()
        .on("urlChanged", function(url){
          fired = (url==="https://www.yahoo.com/");
        })
        .goto("https://www.yahoo.com")
        .run(function(){
          fired.should.be.true;
          done();
        });
    });

    it.skip('should fire an event when a console message is seen', function(done) {
      var fired = false;
      new Nightmare()
        .on("consoleMessage", function(){
          console.log("output")
          fired = true;
        })
        .goto("http://www.yahoo.com")
        .evaluate( function(){
          console.log("message");
        })
        .run(function(){
          fired.should.be.true;
          done();
        });
    });

    it.skip('should fire an event when an alert is seen', function(done) {
      var fired = false;
      new Nightmare()
        .on("alert", function(){
          fired = true;
        })
        .goto("http://www.yahoo.com")
        .evaluate( function(){
          alert("onno");
        })
        .run(function(){
          fired.should.be.true;
          done();
        });
    });

    it.skip('should fire an event when a prompt is seen', function(done) {
      var fired = false;
      new Nightmare()
        .on("prompt", function(){          
          fired = true;
        })
        .goto("http://www.yahoo.com")
        .evaluate( function(){
          prompt("onno");
        })
        .run(function(){
          fired.should.be.true;
          done();
        });
    });
  });

  /**
   * options
   */

  describe('options', function(){

    it('should set agent', function(done) {
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

    it('should set authentication', function(done) {
      new Nightmare()
        .authentication('my','auth')
        .goto('http://httpbin.org/basic-auth/my/auth')
        .evaluate(function(){
          return document.body.innerHTML;
        }, function (data){
          data.length.should.be.above(0);
        })
        .run(done);
    });

    it('should set viewport', function(done) {
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

  });

  /**
   * queue
   */

 describe('queue', function(){

    it('should be ok with no callback to run', function(done){
      var nightmare = new Nightmare().goto('http://yahoo.com');
      nightmare.run();
      setTimeout(done, 4000);
    });

    it('should execute the queue in order', function(done) {
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

    it('should be pluggable with .use()', function(done) {
      function search(term) {
        return function(nightmare) {
          nightmare
            .goto('http://yahoo.com')
              .type('.input-query', term)
              .click('.searchsubmit')
            .wait();
        };
      }
      function testTitle(term) {
        return function(nightmare) {
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