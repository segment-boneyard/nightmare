const parent = require('./ipc')(process);

const RENDER_ELEMENT_ID = '__NIGHTMARE_RENDER__';

// NOTE: we cannot unsubscribe from frame notifications due to:
//   https://github.com/atom/electron/issues/4441
// but in a future release of Electron, we should replace this with:
//   semver.gte(process.versions.electron, '[fixed version]')
const CAN_UNSUBSCRIBE = false;

/**
 * FrameManager is used to coordinate the rendering of a browser window.
 * Because Electron's capturePage() implementation can wind up returning an
 * out-of-date image, this API should be used when screenshotting to ensure
 * that a screenshot will be up-to-date.
 *
 * Instantiate a FrameManager with an Electron BrowserWindow instance,
 * Then call `waitForFrame(callback)` with a callback to get a frame.
 */
module.exports = function FrameManager(window) {
  var subscribed = false;
  var requestedFrame = false;
  var callbacks = [];

  function subscribe() {
    if (!subscribed) {
      window.webContents.beginFrameSubscription(receiveFrame);
    }
  }

  function unsubscribe() {
    if (CAN_UNSUBSCRIBE && !callbacks.length) {
      window.webContents.endFrameSubscription();
      subscribed = false;
    }
  }

  function receiveFrame() {
    var args = arguments;
    requestedFrame = false;
    callbacks
      .splice(0, callbacks.length)
      .forEach(function(callback) {
        callback.apply(null, args);
      });

    // unsubscribe is called last in case callbacks added new subscribers
    unsubscribe();
  }

  function requestFrame() {
    if (!requestedFrame) {
      requestedFrame = true;
      window.webContents.executeJavaScript(
        '(' + triggerRender + ')("' + RENDER_ELEMENT_ID + '")');
    }
  }

  return {
    waitForFrame: function(callback) {
      if (callbacks.indexOf(callback === -1)) {
        callbacks.push(callback);
      }
      subscribe();
      requestFrame();
    }
  }
};

// this function runs in the render process and alters the render tree, forcing
// Chromium to draw a new frame.
var triggerRender = (function (id) {
  var renderElement = document.getElementById(id);
  if (renderElement) {
    renderElement.remove();
  }
  else {
    renderElement = document.createElement('div');
    renderElement.id = id;
    renderElement.setAttribute('style',
      'position: absolute;' +
      'left: 0;' +
      'top: 0;' +
      'width: 1px;' +
      'height: 1px;');
    document.documentElement.appendChild(renderElement);
  }
}).toString();
