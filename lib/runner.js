/**
 * Module Dependencies
 */

var parent = require('./ipc')(process);
var BrowserWindow = require('electron').BrowserWindow;
var defaults = require('deep-defaults');
var assign = require('object-assign');
var join = require('path').join;
var sliced = require('sliced');
var renderer = require('electron').ipcMain;
var app = require('electron').app;
var fs = require('fs');
var FrameManager = require('./frame-manager');

/**
 * Handle uncaught exceptions in the main electron process
 */

process.on('uncaughtException', function(e) {
  parent.emit('uncaughtException', e.stack)
})

/**
 * Update the app paths
 */

if (process.argv.length > 2) {
  var processArgs = JSON.parse(process.argv[2]);
  var paths = processArgs.paths;
  if (paths) {
    for (var i in paths) {
      app.setPath(i, paths[i]);
    }
  }
  var switches = processArgs.switches;
  if (switches) {
    for (var i in switches) {
      app.commandLine.appendSwitch(i, switches[i]);
    }
  }
}

/**
 * Hide the dock
 */

// app.dock is not defined when running
// electron in a platform other than OS X
if (!processArgs.dock && app.dock) {
  app.dock.hide();
}

/**
 * Listen for the app being "ready"
 */

app.on('ready', function() {
  var win, frameManager, options;

  /**
   * create a browser window
   */

  parent.on('browser-initialize', function(opts) {
    options = defaults(opts || {}, {
      show: false,
      alwaysOnTop: true,
      webPreferences: {
        preload: join(__dirname, 'preload.js'),
        nodeIntegration: false
      }
    })

    /**
     * Create a new Browser Window
     */

    win = new BrowserWindow(options);
    if(options.show && options.openDevTools){
      if(typeof options.openDevTools === 'object') {
        win.openDevTools(options.openDevTools);
      } else {
        win.openDevTools();
      }
    }

    /**
     * Window Docs:
     * https://github.com/atom/electron/blob/master/docs/api/browser-window.md
     */

    frameManager = FrameManager(win);

    /**
     * Window options
     */

    win.webContents.setAudioMuted(true);

    /**
     * Pass along web content events
     */

    renderer.on('page', function(sender/*, arguments, ... */) {
      parent.emit.apply(parent, ['page'].concat(sliced(arguments, 1)));
    });

    renderer.on('console', function(sender, type, args) {
      parent.emit.apply(parent, ['console', type].concat(args));
    });

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

  parent.on('goto', function(url, headers) {
    var extraHeaders = '';
    for (var key in headers) {
      extraHeaders += key + ': ' + headers[key] + '\n';
    }

    if (win.webContents.getURL() == url) {
      parent.emit('goto');
    } else {
      win.webContents.loadURL(url, {
        extraHeaders: extraHeaders
      });
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
   * type
   */

  parent.on('type', function (value) {
    var chars = String(value).split('')

    function type () {
      var ch = chars.shift()
      if (ch === undefined) {
        parent.emit('type');
        return;
      }

      // keydown
      win.webContents.sendInputEvent({
        type: 'keyDown',
        keyCode: ch
      });

      // keypress
      win.webContents.sendInputEvent({
        type: 'char',
        keyCode: ch
      });

      // keyup
      win.webContents.sendInputEvent({
        type: 'keyUp',
        keyCode: ch
      });

      // HACK to prevent async keyboard events from
      // being played out of order. The timeout is
      // somewhat arbitrary. I want to achieve a
      // nice balance between speed and correctness
      // if you find that this value it too low,
      // please open an issue.
      setTimeout(type, 100);
    }

    // start
    type();
  })

  /**
   * Insert
   */

  parent.on('insert', function(value) {
    win.webContents.insertText(String(value))
    parent.emit('insert')
  })

  /**
   * screenshot
   */

  parent.on('screenshot', function(path, clip) {
    // https://gist.github.com/twolfson/0d374d9d7f26eefe7d38
    var args = [function handleCapture (img) {
      parent.emit('screenshot', img.toPng());
    }];
    if (clip) args.unshift(clip);
    frameManager.requestFrame(function() {
      win.capturePage.apply(win, args);
    });
  });

  /**
   * html
   */

  parent.on('html', function(path, saveType) {
    // https://github.com/atom/electron/blob/master/docs/api/web-contents.md#webcontentssavepagefullpath-savetype-callback
    saveType = saveType || 'HTMLComplete'
    win.webContents.savePage(path, saveType, function (err) {
      parent.emit('html', err);
    });
  });

  /**
   * pdf
   */

  parent.on('pdf', function(path, options) {
    // https://github.com/fraserxu/electron-pdf/blob/master/index.js#L98
    options = defaults(options || {}, {
      marginType: 0,
      printBackground: true,
      printSelectionOnly: false,
      landscape: false
    });

    win.printToPDF(options, function (err, data) {
      if (err) return parent.emit('pdf', arguments);
      parent.emit('pdf', null , data);
    });
  });

  /**
   * Get cookies
   */

  parent.on('cookie.get', function (query) {
    var details = assign({}, {
      url: win.webContents.getURL(),
    }, query)

    parent.emit('log', 'getting cookie: ' + JSON.stringify(details))
    win.webContents.session.cookies.get(details, function (err, cookies) {
      if (err) return parent.emit('cookie.get', err);
      parent.emit('cookie.get', null, details.name ? cookies[0] : cookies)
    })
  })

  /**
   * Set cookies
   */

  parent.on('cookie.set', function (cookies) {
    var pending = cookies.length

    for (var i = 0, cookie; cookie = cookies[i]; i++) {
      var details = assign({}, {
        url: win.webContents.getURL()
      }, cookie)

      parent.emit('log', 'setting cookie: ' + JSON.stringify(details))
      win.webContents.session.cookies.set(details, function (err) {
        if (err) parent.emit('cookie.set', err);
        else if (!--pending) parent.emit('cookie.set')
      })
    }
  })

  /**
   * Clear cookie
   */

  parent.on('cookie.clear', function (cookies) {
    var url = win.webContents.getURL()
    var pending = cookies.length

    parent.emit('log', 'listing params', cookies);

    for (var i = 0, cookie; cookie = cookies[i]; i++){
      parent.emit('log', 'clearing cookie: ' + JSON.stringify(cookie))
      win.webContents.session.cookies.remove(url, cookie, function (err) {
          if (err) parent.emit('cookie.clear', err);
          else if (!--pending) parent.emit('cookie.clear')
      })
    }
  });

  /**
   * Add custom functionality
   */

  parent.on('action', function(name, fntext){
    var fn = new Function('with(this){ parent.emit("log", "adding action for '+ name +'"); return ' + fntext + '}')
      .call({ 
        require: require, 
        parent: parent 
      });
    fn(name, options, parent, win, renderer, function(err){
      parent.emit('action', err);
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
      win.webContents.once('did-stop-loading', function() {
        parent.emit('log', 'navigated to: ' + win.webContents.getURL());
        ready();
      });
    }

    function ready () {
      parent.emit('continue');
    }
  });

  /**
   * Authentication
   */

  parent.on('authentication', function(login, password) {
    win.webContents.on('login', function(webContents, request, authInfo, callback) {
        callback(login, password);
    });
    parent.emit('authentication');
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
