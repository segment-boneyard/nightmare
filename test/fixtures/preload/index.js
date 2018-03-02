/* eslint-disable no-console */

var ipc = require('electron').ipcRenderer
var sliced = require('sliced')

function send(_event) {
  ipc.send.apply(ipc, arguments)
}

// offer limited access to allow
// .evaluate() and .inject()
// to continue to work as expected.
//
// TODO: this could be avoided by
// rewriting the evaluate to
// use promises instead. But
// for now this fixes the security
// issue in: segmentio/nightmare/#1358
window.__nightmare = {
  resolve: function(value) {
    send('response', value)
  },
  reject: function(message) {
    send('error', message)
  }
}

// Listen for error events
window.addEventListener(
  'error',
  function(e) {
    send('page', 'error', e.message, (e.error || {}).stack || '')
  },
  true
)

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
  send('console', 'log', sliced(arguments))
  return defaultLog.apply(this, arguments)
}

// listen for console.warn
var defaultWarn = console.warn
console.warn = function() {
  send('console', 'warn', sliced(arguments))
  return defaultWarn.apply(this, arguments)
}

// listen for console.error
var defaultError = console.error
console.error = function() {
  send('console', 'error', sliced(arguments))
  return defaultError.apply(this, arguments)
}

// overwrite the default alert
window.alert = function(message) {
  send('page', 'alert', message)
}

// overwrite the default prompt
window.prompt = function(message, defaultResponse) {
  send('page', 'prompt', message, defaultResponse)
}

// overwrite the default confirm
window.confirm = function(message, defaultResponse) {
  send('page', 'confirm', message, defaultResponse)
}

window.preload = 'custom'
