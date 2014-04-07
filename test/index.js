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
        .done(function (nightmare) {
          nightmare.should.be.ok;
          done();
        });
    });

    it('should set viewport and agent', function(done) {
      new Nightmare()
        .viewport(400, 1000)
        .agent('firefox')
        .goto('http://www.wikipedia.org/')
        .done(function (nightmare) {
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
          .run(function () {
            return document.title;
          }, function (title) {
            title.should.equal('github nightmare - Yahoo Search Results');
          })
        .done(function (nightmare) {
          nightmare.should.be.ok;
          done();
        });
    });

    it('should allow you to extract the title', function(done) {
      new Nightmare()
        .goto('http://www.wikipedia.org/')
        .run(function (parameter) {
          return document.title + ' -- ' + parameter;
        }, function (title) {
          title.should.equal('Wikipedia -- testparameter');
        }, 'testparameter')
        .done(function (nightmare) {
          nightmare.should.be.ok;
          done();
        });
    });

    it('should take a screenshot', function(done) {
      new Nightmare()
        .viewport(400, 1200)
        .goto('http://yahoo.com')
          .type('.input-query', 'github nightmare')
          .screen('test/test.png')
        .done(function (nightmare) {
          nightmare.should.be.ok;
          done();
        });
    });

  });

});