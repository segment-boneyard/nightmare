let Nightmare = require('./');
let nightmare = Nightmare({ show: true });

nightmare.chain()
  .goto('http://yahoo.com')
  .type('input[title="Search"]', 'github nightmare')
  .click('#UHSearchWeb')
  .wait('#main')
  .evaluate(function () {
    return document.querySelector('#main .searchCenterMiddle li a').href;
  })
  .then(function (result) {
    console.log(result);
  });

nightmare.end();
