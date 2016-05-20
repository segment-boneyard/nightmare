var Nightmare = require('./');
var nightmare = Nightmare({ show: true })

nightmare
  .goto('http://yahoo.com')
  .type('input[id="UHSearchBox"]', 'github nightmare')
  .click('#UHSearchWeb')
  .wait('#main')
  .evaluate(function () {
    return document.querySelector('#main .searchCenterMiddle li a').href
  })
  .then(function (result) {
    console.log(result)
  })

nightmare.end()
