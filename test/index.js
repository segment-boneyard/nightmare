var Nightmare = require('../lib');

describe('Nightmare', function(){
  this.timeout(30000);

  it('should be constructable', function(){
    var nightmare = new Nightmare();
    nightmare.should.be.ok;
  });

  /**
   * navigation
   */

  describe('navigation', function(){

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

  });

  /**
   * manipulation
   */

  describe('manipulation', function(){

    var nightmare = new Nightmare().goto('http://jsfiddle.net/sperand_io/f1wa3on1/9/embedded/result/');

    it('should evaluate javascript on the page, with parameters', function(done) {
      nightmare
        .evaluate(function (parameter) {
          return document.title + ' -- ' + parameter;
        }, function (title) {
          title.should.equal(' - jsFiddle demo by sperand_io -- testparameter');
        }, 'testparameter')
        .run(done);
    });

    it('should type, check, and click', function(done) {
        nightmare
        //type
        .type('#text', 'github nightmare')
          .evaluate(function () {
            return document.querySelector('#text').value;
          }, function (text) {
            text.should.equal('github nightmare');
          })
        //check
        .check('#check')
          .evaluate(function () {
            return document.querySelector('#checked').value;
          }, function (checked) {
            checked.should.equal(true);
          })
        //click
        .click('a#btn')
          .wait()
          .evaluate(function () {
            return document.title;
          }, function (title) {
            title.should.equal('Github');
          })
        .run(function (err, nightmare) {
          nightmare.should.be.ok;
          done();
        });
    });

    it('should take a screenshot', function(done) {
      nightmare
        .screenshot('test/test.png')
        .run(done);
    });

    it('should wait until specific text is present', function(done) {
      var seconds = function () {
        var gifs = document.querySelectorAll('img');
        var split = gifs[gifs.length-2].src.split('.gif')[0];
        var seconds = split.split('.com/c')[1];
        return parseInt(seconds, 10);
      };

      nightmare = new Nightmare()
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

      nightmare = new Nightmare()
        .goto('http://www.whattimeisit.com/')
        .wait(seconds, 1, 1500)
        .run(done);
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
      var nightmare = new Nightmare().goto('http://expedia.com');
      nightmare.run();
      setTimeout(done, 4000);
    });

    it('should execute the queue in order', function(done) {
      var queue = [];
      new Nightmare()
        .goto('http://expedia.com')
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
