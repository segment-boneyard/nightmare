/**
 * Module Dependencies
 */

var parent = require('./ipc')(process);
var BrowserWindow = require('browser-window');
var sliced = require('sliced');
var renderer = require('ipc');
var app = require('app');
var fs = require('fs');
var defaults = require('defaults');
var join = require('path').join;

/**
 * Hide the dock
 */

// app.dock.hide();

/**
 * Listen for the app being "ready"
 */

app.on('ready', function() {

  var win;
  
  /**
   * create a browser window
   */
  
  parent.on('browser-initialize', function(options) {
    options = defaults(options, {
      'web-preferences': {
        'preload': join(__dirname, 'preload.js'),
        'node-integration': false
      },
      show: false
    });
    win = new BrowserWindow(options);

    /**
     * Window Docs:
     * https://github.com/atom/electron/blob/master/docs/api/browser-window.md
     */

    /**
     * Window options
     */

    win.webContents.setAudioMuted(true);

    /**
     * Pass along web content events
     */

    win.webContents.on('did-finish-load', forward('did-finish-load'));
    win.webContents.on('did-fail-load', forward('did-fail-load'));
    win.webContents.on('did-frame-finish-load', forward('did-frame-finish-load'));
    win.webContents.on('did-start-loading', forward('did-start-loading'));
    win.webContents.on('did-stop-loading', forward('did-stop-loading'));
    win.webContents.on('did-get-response-details', forward('did-get-response-details'));
    win.webContents.on('did-get-redirect-request', forward('did-get-redirect-request'));
    win.webContents.on('dom-ready', forward('dom-ready'));
    win.webContents.on('page-favicon-updated', forward('page-favicon-updated'));
    win.webContents.on('new-window', forward('new-window'));
    win.webContents.on('will-navigate', forward('will-navigate'));
    win.webContents.on('crashed', forward('crashed'));
    win.webContents.on('plugin-crashed', forward('plugin-crashed'));
    win.webContents.on('destroyed', forward('destroyed'));

    parent.emit('browser-initialize');
  });

  /**
   * Parent actions
   */
  
  /**
   * goto
   */

  parent.on('goto', function(url) {
    if (win.webContents.getUrl() == url) {
      parent.emit('goto');
    } else {
      win.webContents.loadUrl(url);
      win.webContents.once('did-finish-load', function() {
        parent.emit('goto');
      });
    }
  });

  /**
   * javascript
   */

  parent.on('javascript', function(src) {
    renderer.once('response', function(event, response) {
      parent.emit('javascript', null, response);
    });

    renderer.once('error', function(event, error) {
      parent.emit('javascript', error);
    });

    renderer.once('log', function(event, args) {
      parent.emit.apply(parent, ['log'].concat(args));
    });

    win.webContents.executeJavaScript(src);
  });

  /**
   * css
   */

  parent.on('css', function(css) {
    win.webContents.insertCSS(css);
  });

  /**
   * size
   */

  parent.on('size', function(width, height) {
    win.setSize(width, height);
  });

  parent.on('useragent', function(useragent) {
    win.webContents.setUserAgent(useragent);
    parent.emit('useragent');
  });

  /**
   * screenshot
   */

  parent.on('screenshot', function(path, clip) {
    // https://gist.github.com/twolfson/0d374d9d7f26eefe7d38
    var args = [function handleCapture (img) {
      parent.emit('screenshot', img.toPng());
    }];
    if (clip) args.unshift(clip);
    win.capturePage.apply(win, args);
  });

  /**
   * pdf
   */

  parent.on('pdf', function(path, options) {
    // https://github.com/fraserxu/electron-pdf/blob/master/index.js#L98
    options = defaults(options, {
      marginType: 0,
      printBackground: true,
      printSelectionOnly: false,
      landscape: false
    });
    win.printToPDF(options, function (err, data) {
      if (err) return parent.emit('pdf', arguments);
      fs.writeFile(path, data, function (err) {
        parent.emit('pdf', arguments);
      });
    });
  });

  /**
   * Continue
   */

  parent.on('continue', function() {
    if (!win.webContents.isLoading()) {
      ready();
    } else {
      parent.emit('log', 'navigating...');
      win.webContents.once('did-finish-load', function() {
        parent.emit('log', 'navigated to: ' + win.webContents.getUrl());
        ready();
      });
    }

    function ready () {
      parent.emit('continue');
    }
  });

  /**
   * Send "ready" event to the parent process
   */

  parent.emit('ready');
});

/**
 * Forward events
 */

function forward(event) {
  return function () {
    parent.emit.apply(parent, [event].concat(sliced(arguments)));
  };
}

