window.__nightmare = {};
__nightmare.ipc = require('ipc');
__nightmare.sliced = require('sliced');

window.addEventListener('error', function(e) {
  __nightmare.ipc.send('page-error', e.message, e.error.stack);
});

(function(){

  var defaultLog = console.log;
  console.log = function() {
    __nightmare.ipc.send('page-log', arguments);
    __nightmare.ipc.send('page-console-log', arguments);
    return defaultLog.apply(this, arguments);
  };

  var defaultWarn = console.warn;
  console.warn = function() {
    __nightmare.ipc.send('page-console-warn', arguments);
    return defaultWarn.apply(this, arguments);
  };

  var defaultError = console.error;
  console.error = function() {
    __nightmare.ipc.send('page-console-error', arguments);
    return defaultError.apply(this, arguments);
  };
})()
