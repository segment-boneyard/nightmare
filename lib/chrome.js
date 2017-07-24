'use strict';

const {spawn} = require('child_process');
const os = require('os');
const EventEmitter = require('events');
const split2 = require('split2');
const debug = require('debug')('chrome');
const defaults = require('defaults');
const chromeFinder = require('chrome-launcher/chrome-finder');
const chromeInterface = require('chrome-remote-interface');

const chromeLog = {
  stdout: require('debug')('chrome:stdout'),
  stderr: require('debug')('chrome:stderr'),
  interface: require('debug')('chrome:interface')
};

const DEFAULT_PORT = 9222;
const defaultChromePath = chromeFinder[os.platform]();

class Chrome extends EventEmitter {
  constructor(options = {}) {
    super();

    this.chromeArgs = {
      '--remote-debugging-port': options.port || DEFAULT_PORT,
      '--disable-gpu': true
    };

    if (!options.show) {
      this.chromeArgs['--headless'] = true;
    }

    const chromePath = options.chromePath ||
      defaultChromePath[0];

    const args = Object
      .keys(this.chromeArgs)
      .map(key => {
        const value = this.chromeArgs[key];

        if (value) {
          if (
            typeof value === 'string' ||
            typeof value === 'number'
          ) {
            return `${key}=${value}`;
          }

          return key;
        }

        return null;
      })
      .filter(arg => arg);

    debug([chromePath].concat(args));

    this.proc = spawn(chromePath, args, {
      stdio: [null, null, null, 'ipc'],
      env: defaults(options.env || {}, process.env)
    });

    this.proc.stdout.pipe(split2())
      .on('data', data => chromeLog.stdout(data));

    this.proc.stderr.pipe(split2())
      .on('data', data => chromeLog.stderr(data));
  }

  init() {
    return new Promise((resolve, reject) => {
      chromeInterface(client => {
        const {Network, Page, Runtime} = client;

        this.Network = Network;
        this.Page = Page;
        this.Runtime = Runtime;
        this.client = client;

        Promise
          .all([
            Network.enable(),
            Page.enable(),
            Runtime.enable()
          ])
          .then(() => {
            debug('interface ready');
            resolve();
          })
          .catch(err => {
            reject(err);
            client.close();
          });
      })
      .on('error', err => {
        reject(err);
      });
    });
  }
}

module.exports = Chrome;
