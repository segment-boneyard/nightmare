var Stellar = require('./');
var vo = require('vo')

vo(run)(function(err, result) {
  if (err) throw err;
  console.log(result);
})

function *run() {
  var first;
  var second;
  var stellar = Stellar();

  yield stellar
    .goto('http://google.com')
    .evaluate(function() {
      return document.title;
    }, function(title) {
      first = title;
    })
    .goto('http://facebook.com')
    .evaluate(function() {
      return document.title;
    }, function(title) {
      second = title;
    })

  stellar.end();

  return first + ' | ' + second;
}

  // .run(function(err, value) {
  //   if (err) throw err;
  //   console.log(value);
  // })
  // .end();
