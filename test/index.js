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

    it('should goto yahoo.com and type and click', function(done) {
      new Nightmare()
        .goto('http://yahoo.com')
          .type('.input-query', 'github nightmare')
          .click('.searchsubmit')
        .wait()
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
        }, function (err, title) {
          title.should.equal('Wikipedia -- testparameter');
          done();
        }, 'testparameter');
    });

    it('should set the viewport', function (done) {
      var size = { width: 500, height: 400 };

      new Nightmare()
        .goto('http://www.wikipedia.org/')
          .viewport(size.width, size.height)
        .run(function () {
          return {
            width: window.innerWidth,
            height: window.innerHeight
          };
        }, function (err, res) {
          if (err) throw err;
          res.should.eql(size);
          done();
        });
    });

    it('should take a screenshot', function(done) {
      new Nightmare()
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