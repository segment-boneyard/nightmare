// This script is used to start a nightmare run but not end it. It reports its
// Electron process's pid, then we kill it and test to see whether that pid is
// still running.
var Nightmare = require('../..');
var nightmare = new Nightmare();
nightmare.init()
    .then(function () {
        return nightmare.goto('about:blank');
    })
    .then(function () {
        process.send(nightmare.proc.pid);
    });