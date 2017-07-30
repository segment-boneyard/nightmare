'use strict';

const debug = require('debug')('chrome');
const chromeInterface = require('chrome-remote-interface');

class Chrome {
  constructor(options) {
    options = options || {};
    this.options = options;
  }

  init() {
    return chromeInterface()
      .then(client => {
        const {
          Network,
          Page,
          Runtime,
          Input,
          Browser,
          Target,
          Emulation
        } = client;

        Network.requestWillBeSent(data => {
          const {method, url} = data.request;
          debug('Network.requestWillBeSent', method, url);
        });

        this.Network = Network;
        this.Page = Page;
        this.Runtime = Runtime;
        this.Input = Input;
        this.Browser = Browser;
        this.Target = Target;
        this.Emulation = Emulation;
        this.client = client;
        this.debug = debug;

        return Promise.all([
          Network.enable(),
          Page.enable(),
          Runtime.enable()
        ]);
      });
  }
}

module.exports = Chrome;
