window.__nightmare = {};
__nightmare.ipc = require('ipc');
__nightmare.sliced = require('sliced');

window.addEventListener('error', function(e) {
  __nightmare.ipc.send('js-error', e.message, e.error.stack);
});

defautlLog = console.log;
console.log = function() {
  __nightmare.ipc.send('js-log', arguments);
  return defautlLog.apply(this, arguments);
};
