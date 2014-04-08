var Nightmare = require('../lib');

describe('Nightmare', function(){
  this.timeout(11000);

  it('should be constructable', function(){
    var nightmare = new Nightmare();
    nightmare.should.be.ok;
  });

  /**
   * methods
   */

  describe('methods', function(){

    it('should goto wikipedia.org', function(done) {
      new Nightmare()
        .goto('http://www.wikipedia.org/')
        .run(done);
    });

    it('should set viewport and agent', function(done) {
      var size = { width : 400, height: 1000 };
      new Nightmare()
        .viewport(size.width, size.height)
        .agent('firefox')
        .goto('http://www.wikipedia.org/')
        .evaluate(function () {
          return {
            width: window.innerWidth,
            height: window.innerHeight
          };
        }, function (res) {
          res.should.eql(size);
        })
        .evaluate(function () {
          return window.navigator.userAgent;
        }, function (res) {
          res.should.eql('firefox');
        })
        .run(function (err, nightmare) {
          nightmare.should.be.ok;
          done();
        });
    });

    it('should goto yahoo.com and type and click', function(done) {
      new Nightmare()
        .goto('http://yahoo.com')
          .type('.input-query', 'github nightmare')
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

    it('should allow you to extract the title with evaluate', function(done) {
      new Nightmare()
        .goto('http://www.wikipedia.org/')
        .evaluate(function (parameter) {
          return document.title + ' -- ' + parameter;
        }, function (title) {
          title.should.equal('Wikipedia -- testparameter');
        }, 'testparameter')
        .run(done);
    });

    it('should take a screenshot', function(done) {
      new Nightmare()
        .viewport(400, 1200)
        .goto('http://yahoo.com')
          .type('.input-query', 'github nightmare')
          .screen('test/test.png')
        .run(done);
    });

    it ('should be pluggable with .use()', function(done) {
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

  });

});