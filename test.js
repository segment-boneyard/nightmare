var Nightmare = require('nightmare')
var Stellar = require('./');
var vo = require('vo')

vo(run)(function(err, result) {
  if (err) throw err;
  console.log(result);
})

function *run() {
  var stellar = Stellar();

  var first = yield stellar
    .goto('http://cnn.com')
    .evaluate(function() {
      return document.title;
    })

  var second = yield stellar
    .goto('http://facebook.com')
    .evaluate(function() {
      return document.title;
    })

  // disconnect
  yield stellar.end()

  return first + ' | ' + second;
}

// var nightmare = new Nightmare();

// console.time('nightmare');
// nightmare
//   .goto('http://cnn.com')
//   .evaluate(function() {
//     return document.title;
//   })
//   .run(function(err, value) {
//     console.timeEnd('nightmare');
//   })

// function *run() {
//   var title = yield Stellar()
//     .goto('http://yahoo.com')
//     .type('input[title="Search"]', 'github nightmare')
//     .click('.searchsubmit')

//   yield stellar.end();

//   return title;
// }
