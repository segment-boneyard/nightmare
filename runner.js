/**
 * Module Dependencies
 */

var emitter = new (require('events').EventEmitter)();
var BrowserWindow = require('browser-window');
var sliced = require('sliced');
var app = require('app');
var ipc = require('ipc');

/**
 * Template
 */

var template = require('./execute');

// hide the dock
app.dock.hide();

// fetch the contents
app.on('ready', function() {
  var win = new BrowserWindow({
    show: false
  });

  send('ready');

  process.on('message', function(arr) {
    emitter.emit.apply(emitter, arr);
  })

  win.webContents.on('did-frame-finish-load', forward('did-frame-finish-load'));
  win.webContents.on('did-get-response-details', forward('did-get-response-details'));
  win.webContents.on('did-finish-load', forward('did-finish-load'));
  win.webContents.on('did-stop-load', forward('did-stop-loading'));
  win.webContents.on('did-fail-load', forward('did-fail-load'));
  win.webContents.on('dom-ready', forward('dom-ready'));
  win.webContents.on('crashed', forward('crashed'));

  emitter.on('load url', function(url) {
    win.loadUrl(url);
  })

  ipc.on('result', function(event, arg) {
    send('javascript result', arg);
  });

  ipc.on('error', function(event, arg) {
    send('javascript error', arg);
  });

  ipc.on('log', function(event, arg) {
    send('javascript log', arg);
  })

  emitter.on('execute javascript', function(src) {
    win.webContents.executeJavaScript(wrap(src));
  })

  emitter.on('close', function() {
    win.close();
  })
})

function send(event) {
  process.send(sliced(arguments));
}

/**
 * Forward events
 */

function forward(event) {
  return function () {
    return process.send([event].concat(arguments));
  }
}

function wrap(src) {
  return template({ src: src });
}
