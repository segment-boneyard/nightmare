'use strict';

const debug = require('debug')('chrome');
const chromeInterface = require('chrome-remote-interface');

class Chrome {
  constructor(options) {
    this.options = options || {};
  }

  init() {
    return chromeInterface(this.options)
      .then(client => {
        const Network = client.Network;
        const Page = client.Page;
        const Runtime = client.Runtime;
        const Input = client.Input;
        const Browser = client.Browser;
        const Target = client.Target;
        const Emulation = client.Emulation;

        Network.requestWillBeSent(data => {
          debug('Network.requestWillBeSent', data.request.method, data.request.url);
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
