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
    return defaultLog.apply(this, arguments);
  };

  var defaultAlert = window.alert;
  window.alert = function(message){
    __nightmare.ipc.send('page-alert', message);
  };
})()
