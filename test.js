var Nightmare = require('./');
var vo = require('vo')

vo(run)(function(err, result) {
  if (err) throw err;
  console.log(result);
})

function *run() {
  var nightmare = Nightmare();

  var first = yield nightmare
    .goto('http://cnn.com')
    .evaluate(function() {
      return document.title;
    })

  var second = yield nightmare
    .goto('http://facebook.com')
    .evaluate(function() {
      return document.title;
    })

  // disconnect
  yield nightmare.end()

  return first + ' | ' + second;
}
