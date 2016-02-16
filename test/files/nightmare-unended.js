// This script is used to start a nightmare run but not end it. It reports its
// Electron process's pid, then we kill it and test to see whether that pid is
// still running.
var Nightmare = require('../..');
var nightmare = Nightmare();
nightmare
  .goto('about:blank')
  .run(function() {
    process.send(nightmare.proc.pid);
  });
