/* eslint-disable no-console */

window.window.__nightmare = {}
window.__nightmare.ipc = require('electron').ipcRenderer
window.__nightmare.sliced = require('sliced')

// Listen for error events
window.addEventListener('error', function(e) {
  window.__nightmare.ipc.send(
    'page',
    'error',
    e.message,
    (e.error || {}).stack || ''
  )
})
;(function() {
  // prevent 'unload' and 'beforeunload' from being bound
  var defaultAddEventListener = window.addEventListener
  window.addEventListener = function(type) {
    if (type === 'unload' || type === 'beforeunload') {
      return
    }
    defaultAddEventListener.apply(window, arguments)
  }

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
  })

  // listen for console.log
  var defaultLog = console.log
  console.log = function() {
    window.__nightmare.ipc.send(
      'console',
      'log',
      window.__nightmare.sliced(arguments)
    )
    return defaultLog.apply(this, arguments)
  }

  // listen for console.warn
  var defaultWarn = console.warn
  console.warn = function() {
    window.__nightmare.ipc.send(
      'console',
      'warn',
      window.__nightmare.sliced(arguments)
    )
    return defaultWarn.apply(this, arguments)
  }

  // listen for console.error
  var defaultError = console.error
  console.error = function() {
    window.__nightmare.ipc.send(
      'console',
      'error',
      window.__nightmare.sliced(arguments)
    )
    return defaultError.apply(this, arguments)
  }

  // overwrite the default alert
  window.alert = function(message) {
    window.__nightmare.ipc.send('page', 'alert', message)
  }

  // overwrite the default prompt
  window.prompt = function(message, defaultResponse) {
    window.__nightmare.ipc.send('page', 'prompt', message, defaultResponse)
  }

  // overwrite the default confirm
  window.confirm = function(message, defaultResponse) {
    window.__nightmare.ipc.send('page', 'confirm', message, defaultResponse)
  }
})()
