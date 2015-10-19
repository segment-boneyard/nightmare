window.__nightmare = {};
__nightmare.ipc = require('ipc');
__nightmare.sliced = require('sliced');

window.addEventListener('error', function(errorMsg, url, lineNumber, columnNumber, error) {
  __nightmare.ipc.send('js-error', ('Error: ' + errorMsg + ' Script: ' + url + ' Line: ' + lineNumber+':'+ columnNumber), error);
});
