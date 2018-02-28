const parent = require('./ipc')(process)
const EventEmitter = require('events')
const util = require('util')

const HIGHLIGHT_STYLE = {
  x: 0,
  y: 0,
  width: 1,
  height: 1,
  color: { r: 0, g: 0, b: 0, a: 0.1 }
}

module.exports = FrameManager

/**
 * FrameManager is an event emitter that produces a 'data' event each time the
 * browser window draws to the screen.
 * The primary use for this is to ensure that calling `capturePage()` on a
 * window will produce an image that is up-to-date with the state of the page.
 */
function FrameManager(window) {
  if (!(this instanceof FrameManager)) return new FrameManager(window)

  EventEmitter.call(this)
  var requestedFrame = false
  var frameRequestTimeout
  var self = this

  this.on('newListener', subscribe)
  this.on('removeListener', unsubscribe)

  function subscribe(eventName) {
    if (!self.listenerCount('data') && eventName === 'data') {
      parent.emit('log', 'subscribing to browser window frames')
      window.webContents.beginFrameSubscription(receiveFrame)
    }
  }

  function unsubscribe() {
    if (!self.listenerCount('data')) {
      parent.emit('log', 'unsubscribing from browser window frames')
      window.webContents.endFrameSubscription()
    }
  }

  function cancelFrame() {
    requestedFrame = false
    clearTimeout(frameRequestTimeout)
    self.emit('data', null)
  }

  function receiveFrame(buffer) {
    requestedFrame = false
    clearTimeout(frameRequestTimeout)
    self.emit('data', buffer)
  }

  /**
   * In addition to listening for events, calling `requestFrame` will ensure
   * that a frame is queued up to render (instead of just waiting for the next
   * time the browser chooses to draw a frame).
   * @param {Function} [callback] Called when the frame is rendered.
   * @param {Number} [timeout=1000] If no frame has been rendered after this
       many milliseconds, run the callback anyway. In this case, The
       callback's first argument, an image buffer, will be `null`.
   */
  this.requestFrame = function(callback, timeout) {
    timeout = timeout == undefined ? 1000 : timeout

    if (callback) {
      this.once('data', callback)
    }

    if (!requestedFrame) {
      requestedFrame = true

      // Force the browser to render new content by using the debugger to
      // highlight a portion of the page. This way, we can guarantee a change
      // that both requires rendering a frame and does not actually affect
      // the content of the page.
      if (!window.webContents.debugger.isAttached()) {
        try {
          window.webContents.debugger.attach()
        } catch (error) {
          parent.emit(
            'log',
            `Failed to attach to debugger for frame subscriptions: ${error}`
          )
          cancelFrame()
          return
        }
      }

      if (timeout) {
        frameRequestTimeout = setTimeout(function() {
          parent.emit(
            'log',
            `FrameManager timing out after ${timeout} ms with no new rendered frames`
          )
          cancelFrame()
        }, timeout)
      }

      parent.emit('log', 'Highlighting page to trigger rendering.')
      window.webContents.debugger.sendCommand('DOM.enable')
      window.webContents.debugger.sendCommand(
        'DOM.highlightRect',
        HIGHLIGHT_STYLE,
        function(_error) {
          window.webContents.debugger.sendCommand('DOM.hideHighlight')
          window.webContents.debugger.detach()
        }
      )
    }
  }
}

util.inherits(FrameManager, EventEmitter)
