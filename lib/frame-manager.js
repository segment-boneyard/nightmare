const parent = require('./ipc')(process);
const EventEmitter = require('events');
const util = require('util');

const RENDER_ELEMENT_ID = '__NIGHTMARE_RENDER__';

module.exports = FrameManager;

/**
 * FrameManager is an event emitter that produces a 'data' event each time the
 * browser window draws to the screen.
 * The primary use for this is to ensure that calling `capturePage()` on a
 * window will produce an image that is up-to-date with the state of the page.
 */
function FrameManager(window) {
  if (!(this instanceof FrameManager)) return new FrameManager(window);

  EventEmitter.call(this);
  var subscribed = false;
  var requestedFrame = false;
  var self = this;

  this.on('newListener', subscribe);
  this.on('removeListener', unsubscribe);

  function subscribe(eventName) {
    if (!subscribed && eventName === 'data') {
      parent.emit('log', 'subscribing to browser window frames');
      window.webContents.beginFrameSubscription(receiveFrame);
    }
  }

  function unsubscribe() {
    if (!self.listenerCount('data')) {
      parent.emit('log', 'unsubscribing from browser window frames')
      window.webContents.endFrameSubscription();
      subscribed = false;
    }
  }

  function receiveFrame(buffer) {
    requestedFrame = false;
    self.emit('data', buffer);
  }

  /**
   * In addition to listening for events, calling `requestFrame` will ensure
   * that a frame is queued up to render (instead of just waiting for the next
   * time the browser chooses to draw a frame).
   * @param  {Function} [callback] Called when the frame is rendered.
   */
  this.requestFrame = function(callback) {
    if (callback) {
      this.once('data', callback);
    }
    if (!requestedFrame) {
      parent.emit('log', 'altering page to force rendering');
      requestedFrame = true;
      window.webContents.executeJavaScript(
        '(' + triggerRender + ')("' + RENDER_ELEMENT_ID + '")');
    }
  };
};

util.inherits(FrameManager, EventEmitter);

// this runs in the render process and alters the render tree, forcing Chromium
// to draw a new frame.
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
