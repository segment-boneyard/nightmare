'use strict';

const co = require('co');
const debug = require('debug')('nightmare');
const Chrome = require('./chrome');

const addAction = Symbol('addAction');

class Nightmare extends Chrome {
  constructor(options = {}) {
    super(options);

    this.url = null;
    this.actionQueue = [];
  }

  [addAction](promise) {
    this.actionQueue.push(promise);
    return this;
  }

  goto(url) {
    this[addAction]({
      type: 'goto',
      action: () => this.Page.navigate({url})
    });

    return this;
  }

  evaluate(fn) {
    const expression = `;(${fn.toString()}());`;

    debug({expression});

    this[addAction]({
      type: 'evaluate',
      action: () => this.Runtime.evaluate({expression})
    });

    return this;
  }

  end() {
    const self = this;
    let output;

    return co(function * () {
      yield self.init();

      for (const {type, action} of self.actionQueue) {
        debug(`got action "${type}"`);

        if (type === 'evaluate') {
          output = yield action();

          if (output.result.subtype === 'error') {
            throw new Error(output.result.description);
          }
        } else {
          yield action();
        }
      }

      return output;
    });
  }
}

module.exports = Nightmare;
