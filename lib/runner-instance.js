
var electron = require('electron');
var BrowserWindow = electron && (electron.BrowserWindow || electron.remote.BrowserWindow);
var app = electron.app || electron.remote.app;
var defaults = require('deep-defaults');
var join = require('path').join;
var sliced = require('sliced');
var renderer = require('electron').ipcMain;
var urlFormat = require('url');
var FrameManager = require('./frame-manager');


// URL protocols that don't need to be checked for validity
const KNOWN_PROTOCOLS = ['http', 'https', 'file', 'about', 'javascript'];
// Property for tracking whether a window is ready for interaction
const IS_READY = Symbol('isReady');
var instanceId = 1;

module.exports = RunnerInstance;


function RunnerInstance(parent,inProcessOptions)
{
    if (!(this instanceof RunnerInstance)) return new RunnerInstance(parent,inProcessOptions);

    var win, frameManager, windowOptions, closed,webContents,thisInstanceId = instanceId++;
    inProcessOptions = defaults(inProcessOptions || {}, {exitOnQuit:false,closeWindowOnQuit: true});
    if (inProcessOptions.window)
        win = inProcessOptions.window;

    /**
     * create a browser window if none passed in
     */

    parent.respondTo('browser-initialize', function(opts, done) {
      windowOptions = defaults(opts || {}, {
        show: false,
        alwaysOnTop: true,
        webPreferences: {
          preload: join(__dirname, 'preload.js'),
          nodeIntegration: false
        }
      })

      if (!win) {

        /**
         * Create a new Browser Window
         */

        win = new BrowserWindow(windowOptions);
        if (windowOptions.show && windowOptions.openDevTools) {
          if (typeof windowOptions.openDevTools === 'object') {
            win.openDevTools(windowOptions.openDevTools);
          } else {
            win.openDevTools();
          }
        }
      }

      initWindow();


    });

    function initWindow()
    {
        webContents = win.webContents || win.getWebContents();
        /**
         * Window Docs:
         * https://github.com/atom/electron/blob/master/docs/api/browser-window.md
         */

        frameManager = FrameManager(win);

        /**
         * Window options
         */

        webContents.setAudioMuted(true);

        /**
         * Pass along web content events
         */

        renderer.on(buildChannelName('page'), function(sender/*, arguments, ... */) {
            parent.emit.apply(parent, ['page'].concat(sliced(arguments, 1)));
        });

        renderer.on(buildChannelName('console'), function(sender, type, args) {
            parent.emit.apply(parent, ['console', type].concat(args));
        });

        webContents.on('did-finish-load', forward('did-finish-load'));
        webContents.on('did-fail-load', forward('did-fail-load'));
        webContents.on('did-fail-provisional-load', forward('did-fail-provisional-load'));
        webContents.on('did-frame-finish-load', forward('did-frame-finish-load'));
        webContents.on('did-start-loading', forward('did-start-loading'));
        webContents.on('did-stop-loading', forward('did-stop-loading'));
        webContents.on('did-get-response-details', forward('did-get-response-details'));
        webContents.on('did-get-redirect-request', forward('did-get-redirect-request'));
        webContents.on('dom-ready', forward('dom-ready'));
        webContents.on('page-favicon-updated', forward('page-favicon-updated'));
        webContents.on('new-window', forward('new-window'));
        webContents.on('will-navigate', forward('will-navigate'));
        webContents.on('crashed', forward('crashed'));
        webContents.on('plugin-crashed', forward('plugin-crashed'));
        webContents.on('destroyed', forward('destroyed'));
        webContents.on('media-started-playing', forward('media-started-playing'));
        webContents.on('media-paused', forward('media-paused'));
        webContents.on('close', (e) => {
            closed = true;
        });

        var loadwatch;
        webContents.on('did-start-loading', function() {
            if (webContents.isLoadingMainFrame()) {
                if(windowOptions.loadTimeout){
                    loadwatch = setTimeout(function(){
                        webContents.stop();
                    }, windowOptions.loadTimeout);
                }
                setIsReady(false);
            }
        });

        webContents.on('did-stop-loading', function(){
            clearTimeout(loadwatch);
            setIsReady(true);
        });

        setIsReady(true);


        done();
    };

    /**
     * Parent actions
     */

    /**
     * goto
     */

    parent.respondTo('goto', function(url, headers, timeout, done) {
        console.log('goto',arguments);
        if (!url || typeof url !== 'string') {
            return done('goto: `url` must be a non-empty string');
        }

        var httpReferrer = '';
        var extraHeaders = '';
        for (var key in headers) {
            if (key.toLowerCase() == 'referer') {
                httpReferrer = headers[key];
                continue;
            }

            extraHeaders += key + ': ' + headers[key] + '\n';
        }
        var loadUrlOptions = { extraHeaders: extraHeaders };
        httpReferrer && (loadUrlOptions.httpReferrer = httpReferrer);

        if (webContents.getURL() == url) {
            done();
        } else {
            var responseData = {};
            var domLoaded = false;

            var timer = setTimeout(function() {
                // If the DOM loaded before timing out, consider the load successful.
                var error = domLoaded ? undefined : {
                    message: 'navigation error',
                    code: -7, // chromium's generic networking timeout code
                    details: `Navigation timed out after ${timeout} ms`,
                    url: url
                };
                // Even if "successful," note that some things didn't finish.
                responseData.details = `Not all resources loaded after ${timeout} ms`;
                cleanup(error, responseData);
            }, timeout);

            function handleFailure(event, code, detail, failedUrl, isMainFrame) {
                if (isMainFrame) {
                    cleanup({
                        message: 'navigation error',
                        code: code,
                        details: detail,
                        url: failedUrl || url
                    });
                }
            }

            function handleDetails(
                event, status, newUrl, oldUrl, statusCode, method, referrer, headers, resourceType) {
                if (resourceType === 'mainFrame') {
                    responseData = {
                        url: newUrl,
                        code: statusCode,
                        method: method,
                        referrer: referrer,
                        headers: headers
                    };
                }
            }

            function handleDomReady() {
              webContents.send('init',{instanceId: thisInstanceId,sendToHost: !!webContents.hostWebContents});
              domLoaded = true;
            }

            // We will have already unsubscribed if load failed, so assume success.
            function handleFinish(event) {
                cleanup(null, responseData);
            }

            function cleanup(error, data) {
                clearTimeout(timer);
                webContents.removeListener('did-fail-load', handleFailure);
                webContents.removeListener('did-fail-provisional-load', handleFailure);
                webContents.removeListener('did-get-response-details', handleDetails);
                webContents.removeListener('dom-ready', handleDomReady);
                webContents.removeListener('did-finish-load', handleFinish);
                setIsReady(true);
                // wait a tick before notifying to resolve race conditions for events
                setImmediate(() => done(error, data));
            }

            // In most environments, loadURL handles this logic for us, but in some
            // it just hangs for unhandled protocols. Mitigate by checking ourselves.
            function canLoadProtocol(protocol, callback) {
                protocol = (protocol || '').replace(/:$/, '');
                if (!protocol || KNOWN_PROTOCOLS.includes(protocol)) {
                    return callback(true);
                }
                electron.protocol.isProtocolHandled(protocol, callback);
            }

            function startLoading() {
                // abort any pending loads first
                if (webContents.isLoading()) {
                    parent.emit('log', 'aborting pending page load');
                    webContents.once('did-stop-loading', function() {
                        startLoading(true);
                    });
                    return webContents.stop();
                }

                webContents.on('did-fail-load', handleFailure);
                webContents.on('did-fail-provisional-load', handleFailure);
                webContents.on('did-get-response-details', handleDetails);
                webContents.on('dom-ready', handleDomReady);
                webContents.on('did-finish-load', handleFinish);
                webContents.loadURL(url, loadUrlOptions);

                // javascript: URLs *may* trigger page loads; wait a bit to see
                if (protocol === 'javascript:') {
                    setTimeout(function() {
                        if (!webContents.isLoadingMainFrame()) {
                            done(null, {
                                url: url,
                                code: 200,
                                method: 'GET',
                                referrer: webContents.getURL(),
                                headers: {}
                            });
                        }
                    }, 10);
                }
            }

            var protocol = urlFormat.parse(url).protocol;
            canLoadProtocol(protocol, function startLoad(canLoad) {
                if (canLoad) {
                    parent.emit('log',
                        `Navigating: "${url}",
            headers: ${extraHeaders || '[none]'},
            timeout: ${timeout}`);
                    return startLoading();
                }

                cleanup({
                    message: 'navigation error',
                    code: -1000,
                    details: 'unhandled protocol',
                    url: url
                });
            });
        }
    });

    /**
     * javascript
     */

    parent.respondTo('javascript', function(src, args,done) {
        if (typeof args == 'function')
        {
          done = args;
          args = undefined;
        }

        var response = (event, response) => {
            renderer.removeListener(buildChannelName('error'), error);
            renderer.removeListener(buildChannelName('log'), log);
            done(null, response);
        };

        var error = (event, error) => {
            renderer.removeListener(buildChannelName('log'), log);
            renderer.removeListener(buildChannelName('response'), response);
            done(error);
        };

        var log = (event, args) => parent.emit.apply(parent, ['log'].concat(args));

        renderer.once(buildChannelName('response'), response);
        renderer.once(buildChannelName('error'), error);
        renderer.on(buildChannelName('log'), log);

        //parent.emit('log', 'about to execute javascript: ' + src);
        if (args) // execute via IPC
        {
          console.log('ipc:javascript',src,args);
          webContents.send('javascript', src, args);
        }
        else
          webContents.executeJavaScript(src);
    });

    /**
     * css
     */

    parent.respondTo('css', function(css, done) {
        webContents.insertCSS(css);
        done();
    });

    /**
     * size
     */

    parent.respondTo('size', function(width, height, done) {
        var setSize = win.setSize || webContents.setSize;
        setSize(width, height);
        done();
    });

    parent.respondTo('useragent', function(useragent, done) {
        webContents.setUserAgent(useragent);
        done();
    });

    /**
     * type
     */

    parent.respondTo('type', function (value, done) {
        var chars = String(value).split('')

        function type () {
            var ch = chars.shift()
            if (ch === undefined) {
                return done();
            }

            // keydown
            webContents.sendInputEvent({
                type: 'keyDown',
                keyCode: ch
            });

            // keypress
            webContents.sendInputEvent({
                type: 'char',
                keyCode: ch
            });

            // keyup
            webContents.sendInputEvent({
                type: 'keyUp',
                keyCode: ch
            });

            // defer function into next event loop
            setTimeout(type, windowOptions.typeInterval);
        }

        // start
        type();
    })

    /**
     * Insert
     */

    parent.respondTo('insert', function(value, done) {
        webContents.insertText(String(value))
        done();
    })

    /**
     * screenshot
     */

    parent.respondTo('screenshot', function(path, clip, done) {
        // https://gist.github.com/twolfson/0d374d9d7f26eefe7d38
        var args = [function handleCapture (img) {
            done(null, img.toPng());
        }];
        if (clip) args.unshift(clip);
        frameManager.requestFrame(function() {
            win.capturePage.apply(win, args);
        });
    });

    /**
     * html
     */

    parent.respondTo('html', function(path, saveType, done) {
        // https://github.com/atom/electron/blob/master/docs/api/web-contents.md#webcontentssavepagefullpath-savetype-callback
        saveType = saveType || 'HTMLComplete'
        webContents.savePage(path, saveType, function (error) {
            done(error);
        });
    });

    /**
     * pdf
     */

    parent.respondTo('pdf', function(path, options, done) {
        // https://github.com/fraserxu/electron-pdf/blob/master/index.js#L98
        options = defaults(options || {}, {
            marginType: 0,
            printBackground: true,
            printSelectionOnly: false,
            landscape: false
        });

        webContents.printToPDF(options, function (error, data) {
            if (error) return done(arguments);
            done(null , data);
        });
    });

    /**
     * Get cookies
     */

    parent.respondTo('cookie.get', function (query, done) {
        var details = Object.assign({
            url: webContents.getURL()
        }, query)

        parent.emit('log', 'getting cookie: ' + JSON.stringify(details))
        webContents.session.cookies.get(details, function (error, cookies) {
            if (error) return done(error);
            done(null, details.name ? cookies[0] : cookies)
        })
    })

    /**
     * Set cookies
     */

    parent.respondTo('cookie.set', function (cookies, done) {
        var pending = cookies.length

        for (var i = 0, cookie; cookie = cookies[i]; i++) {
            var details = Object.assign({
                url: webContents.getURL()
            }, cookie)

            parent.emit('log', 'setting cookie: ' + JSON.stringify(details))
            webContents.session.cookies.set(details, function (error) {
                if (error) done(error);
                else if (!--pending) done();
            })
        }
    })

    /**
     * Clear cookie
     */

    parent.respondTo('cookie.clear', function (cookies, done) {
        var url = webContents.getURL();
        var getCookies = (cb) => cb(null, cookies);

        if(cookies.length == 0){
            getCookies = (cb) => webContents.session.cookies.get({url: url}, (error, cookies) => {
                cb(error, cookies.map((cookie) => cookie.name));
            });
        }

        getCookies((error, cookies) => {
            var pending = cookies.length;
            //if no cookies, return
            if(pending == 0){
                return done();
            }
            parent.emit('log', 'listing params', cookies);

            //for each cookie name in cookies,
            for (var i = 0, cookie; cookie = cookies[i]; i++){
                //remove the cookie from the url
                webContents.session.cookies.remove(url, cookie, function (error) {
                    if (error) done(error);
                    else if (!--pending) done();
                })
            }
        });
    });

    /**
     * Clear all cookies
     */

    parent.respondTo('cookie.clearAll', function(done){
        webContents.session.clearStorageData({
            storages: ['cookies']
        }, done);
    });

    /**
     * Add custom functionality
     */

    parent.respondTo('action', function(name, fntext, done){
        var fn = new Function('with(this){ parent.emit("log", "adding action for '+ name +'"); return ' + fntext + '}')
            .call({
                require: require,
                parent: parent
            });
        fn(name, windowOptions, parent, win, renderer, function(error){
            done(error);
        });
    });

    /**
     * Continue
     */

    parent.respondTo('continue', function(done) {
        if (isReady()) {
            done();
        } else {
            parent.emit('log', 'waiting for window to load...');
            win.once('did-change-is-ready', function() {
                parent.emit('log', 'window became ready: ' + webContents.getURL());
                done();
            });
        }
    });

    /**
     * Authentication
     */

    var loginListener;
    parent.respondTo('authentication', function(login, password, done) {
        var currentUrl;
        var tries = 0;
        if(loginListener){
            webContents.removeListener('login', loginListener);
        }

        loginListener = function(webContents, request, authInfo, callback) {
            tries++;
            parent.emit('log', `authenticating against ${request.url}, try #${tries}`);
            if(currentUrl != request.url) {
                currentUrl = request.url;
                tries = 1;
            }

            if(tries >= windowOptions.maxAuthRetries){
                parent.emit('die', 'problem authenticating, check your credentials');
            } else {
                callback(login, password);
            }
        }
        webContents.on('login', loginListener);

        done();
    });

    /**
     * If launched process kill the electron app, otherwise close BrowserWindow, or ignore if webview
     */

    parent.respondTo('quit', function(done) {
        if (!inProcessOptions || inProcessOptions.exitOnQuit)
          app.quit();
        else
        {
          if (webContents.hostWebContents) //webview
          {

          }
          else // BrowserWindow
          {
            if (inProcessOptions.closeWindowOnQuit)
            {
              win.once('closed',() => {
                parent.emit('close');
              });
              win.close();
            }
          }
        }
        done();
    });

    /**
     * Send "ready" event to the parent process
     */

    parent.emit('ready', {
        electron: process.versions['electron'],
        chrome: process.versions['chrome']
    });

    /**
     * Check whether the window is ready for interaction
     */
    function isReady() {
        return win[IS_READY];
    }

    /**
     * Set whether the window is ready for interaction
     */
    function setIsReady(ready) {
        ready = !!ready;
        if (ready !== win[IS_READY]) {
            win[IS_READY] = ready;
            win.emit('did-change-is-ready', ready);
        }
    }

    /**
     * Forward events
     */

    function forward(name) {
        return function (event) {
            // NOTE: the raw Electron event used to be forwarded here, but we now send
            // an empty event in its place -- the raw event is not JSON serializable.
            if(!closed) {
                parent.emit.apply(parent, [name, {}].concat(sliced(arguments, 1)));
            }
        };
    }

    /**
     * Build a qualified ipc channel name for this instance
     * @param name
     */
  function buildChannelName(name)
    {
      return 'nightmare:' + thisInstanceId + ':' + name;
    }
}

