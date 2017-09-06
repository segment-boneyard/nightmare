var ipc = require('electron').ipcRenderer;
var ipcSend = ipc.send;
var sliced = require('sliced');
var instanceId;

// Listen for error events
window.addEventListener('error', function(e) {
  send('page', 'error', e.message, e.error.stack);
});

(function(){
  // prevent 'unload' and 'beforeunload' from being bound
  var defaultAddEventListener = window.addEventListener;
  window.addEventListener = function (type) {
    if (type === 'unload' || type === 'beforeunload') {
      return;
    }
    defaultAddEventListener.apply(window, arguments);
  };

  // prevent 'onunload' and 'onbeforeunload' from being set
  Object.defineProperties(window, {
    onunload: {
      enumerable: true,
      writable: false,
      value: null
    },
    onbeforeunload: {
      enumerable: true,
      writable: false,
      value: null
    }
  });

  // listen for console.log
  var defaultLog = console.log;
  console.log = function() {
    send('console', 'log', sliced(arguments));
    return defaultLog.apply(this, arguments);
  };

  // listen for console.warn
  var defaultWarn = console.warn;
  console.warn = function() {
    send('console', 'warn', sliced(arguments));
    return defaultWarn.apply(this, arguments);
  };

  // listen for console.error
  var defaultError = console.error;
  console.error = function() {
    send('console', 'error', sliced(arguments));
    return defaultError.apply(this, arguments);
  };

  // overwrite the default alert
  window.alert = function(message){
    send('page', 'alert', message);
  };

  // overwrite the default prompt
  window.prompt = function(message, defaultResponse){
    send('page', 'prompt', message, defaultResponse);
  }

  // overwrite the default confirm
  window.confirm = function(message, defaultResponse){
    send('page', 'confirm', message, defaultResponse);
  }

  ipc.on('javascript',function(event,js_fn,args) {
    try
    {
      console.log('ipc:javascript',js_fn,args);
      let fn = eval('(' + js_fn + ')');
      var response;

      if(fn.length - 1 == args.length) {
        args.push(((err, v) => {
          defaultLog('callback response',err,v);
          if(err) {
            send('error', err.message || err.toString());
          }
          send('response', v);
        }));
        fn.apply(null, args);
      }
      else {
        response = fn.apply(null, args);
        if(response && response.then) {
          response.then((v) => {
            send('response', v);
          })
            .catch((err) => {
              send('error', err)
            });
        } else {
          send('response', response);
        }
      }
    }
    catch (err) {
      defaultError('error',err);
      send('error', err.message);
    }
  });

  ipc.on('init',function(event,opts)
  {
    if (opts.sendToHost)
      ipcSend = ipc.sendToHost;
    instanceId = opts.instanceId;
  });

  function send(name)
  {
    // Support multiple instances
    name = 'nightmare:' + instanceId + ':' + name;
    defaultLog('send',name,arguments);
    ipcSend(name,sliced(arguments,1));

  }

})()
