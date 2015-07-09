/**
 * Module Dependencies
 */

var emitter = new (require('events').EventEmitter)();
var electron = require('electron-prebuilt');
var debug = require('debug')('stellar');
var source = require('function-source');
var proc = require('child_process')
var join = require('path').join;
var sliced = require('sliced');

/**
 * Runner script
 */

var runner = join(__dirname, 'runner.js');

/**
 * Spawn the child process
 */

var child = proc.spawn(electron, [join(__dirname, 'runner.js')], { stdio: [null, null, null, 'ipc'] });

child.on('message', function(arr) {
  emitter.emit.apply(emitter, arr);
})

child.stdout.on('data', function(data) {
  console.error(data.toString());
})

child.on('error', function(err) {
  console.log(err);
})

child.on('close', function(code) {
  console.log(code);
})

emitter.on('ready', function(value) {
  console.log('ready');
  send('load url', 'https://google.com');
})

emitter.on('did-finish-load', function() {
  debug('loaded url', arguments);
  console.log('loaded');
  send('execute javascript', source(function() {
    return document.title;
    // var element = document.querySelector('.Header-list-item a');
    // var event = document.createEvent('MouseEvent');
    // event.initEvent('click', true, true);
    // element.dispatchEvent(event);
  }).trim());
})

// emitter.on('dom-ready', function() {
//   console.log('dom ready');
//   send('execute javascript', source(function() {
//     return 'wtf';
//     console.log('working?');
//     window.addEventListener('loaded', function() {
//       console.log('LOADED');
//     });
//   }));
// })

emitter.on('crashed', function() {
  console.log('crash');
})

emitter.on('did-get-response-details', function() {
  // console.log('response', arguments);
})

emitter.on('did-frame-finish-load', function() {
  // console.log('did-frame-finish-load');
})

emitter.on('did-fail-load', function() {
  // console.log('failed to loading');
})

emitter.on('did-stop-loading', function() {
  console.log('stoped loading');
})

emitter.on('javascript result', function(result) {
  console.log('result!', result);
})

emitter.on('javascript log', function(log) {
  console.error.apply(console, log);
})

emitter.on('javascript error', function(err) {
  console.error('error', err);
})

function send(event) {
  child.send(sliced(arguments));
}

// var BrowserWindow = require('browser-window');
// var clean = require('electron-clean-logging');
// var app = require('app');

// app.on('ready', function() {
//   var win = new BrowserWindow({ show: false });
//   win.loadUrl('http://facebook.com');
//   win.webContents.on('did-finish-load', function() {
//     win.webContents.executeJavaScript('console.log("hi")');
//   })
// })


// var webdriver = require('selenium-webdriver');
// var which = require('which').sync;
// console.log(which('electron'));
// var driver = new webdriver.Builder()
//   // The "9515" is the port opened by chrome driver.
//   .usingServer('http://localhost:9515')
//   .withCapabilities({chromeOptions: {
//     // Here is the path to your Electron binary.
//     binary: which('electron')}})
//   .forBrowser('electron')
//   .build();

// driver.get('http://www.google.com');
// driver.findElement(webdriver.By.name('q')).sendKeys('webdriver');
// driver.findElement(webdriver.By.name('btnG')).click();
// driver.wait(function() {
//  return driver.getTitle().then(function(title) {
//    return title === 'webdriver - Google Search';
//  });
// }, 1000);

// driver.quit();
