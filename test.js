var Nightmare = require('./lib/index');
var nightmare = new Nightmare();

nightmare
  .goto('http://kayak.com')
  .run(function( err, nightmare){
    console.log('all done');
  });