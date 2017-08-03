// This script is used to start nightmare
// but then throw a user space error
var Nightmare = require('../..');

var nightmare = Nightmare(); // eslint-disable-line no-unused-vars
throw new Error('uncaught');
