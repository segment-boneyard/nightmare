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
const CONNECTION_RETRY_DELAY = 10; // ms
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

    process.on('exit', () => {
      debug('nightmare exited, killing chrome');
      this.proc.kill('SIGINT');
    });

    process.on('SIGINT', () => {
      debug('nightmare interrupted, killing chrome');
      this.proc.kill('SIGINT');
    });

    this.debug = debug;
  }

  init() {
    let connectionTimer;

    return new Promise((resolve, reject) => {
      const retry = () => {
        debug('checking for chrome process');

        chromeInterface(client => {
          const {Network, Page, Runtime, Input} = client;

          Network.requestWillBeSent(data => {
            const {method, url} = data.request;
            debug(method, url);
          });

          this.Network = Network;
          this.Page = Page;
          this.Runtime = Runtime;
          this.Input = Input;
          this.client = client;

          Promise
            .all([
              Network.enable(),
              Page.enable(),
              Runtime.enable()
            ])
            .then(() => {
              connectionTimer = setInterval(() => {
                if (this.proc.connected) {
                  clearInterval(connectionTimer);
                  debug('interface ready');
                  resolve();
                }
              }, CONNECTION_RETRY_DELAY);
            })
            .catch(err => {
              reject(err);
              client.close();
            });
        })
        .on('error', err => {
          debug(err);
          setTimeout(retry, CONNECTION_RETRY_DELAY);
        });
      };

      retry();
    });
  }
}

module.exports = Chrome;
