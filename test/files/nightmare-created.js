// This script is used to create a nightmare run but not start it.
var Nightmare = require('../..');
var nightmare = Nightmare();
nightmare
  .goto('about:blank');

process.send('ready');
