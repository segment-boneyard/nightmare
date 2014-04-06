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

    it('should goto wikipedia.org correctly', function(done) {
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

  });

});