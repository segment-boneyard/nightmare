// This script is used to start nightmare 
// but then throw a user space error
var Nightmare = require('../..');
var nightmare = Nightmare();
throw new Error("uncaught");
