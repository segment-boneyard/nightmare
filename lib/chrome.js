'use strict';

const {spawn} = require('child_process');
const os = require('os');
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
const CONNECTION_RETRY_DELAY_MULTIPLIER = 10; // ms
const CONNECTION_RETRY_COUNT = 20;
const defaultChromePath = chromeFinder[os.platform]();

class Chrome {
  constructor(options) {
    options = options || {};

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

    this.proc.on('close', () => {
      debug('closed');
    });

    this.debug = debug;
  }

  init() {
    let connectionTimer;
    let retries = 1;

    return new Promise((resolve, reject) => {
      const retry = () => {
        if (retries >= CONNECTION_RETRY_COUNT) {
          return reject(new Error('Couldn\'t connect to Chrome process'));
        }

        retries++;
        debug('checking for chrome process');

        chromeInterface(client => {
          const {
            Network,
            Page,
            Runtime,
            Input,
            Browser,
            Target
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
          this.client = client;

          Promise
            .all([
              Network.enable(),
              Page.enable(),
              Runtime.enable(),
              Target.setDiscoverTargets({discover: true})
            ])
            .then(() => {
              connectionTimer = setInterval(() => {
                if (this.proc.connected) {
                  clearInterval(connectionTimer);
                  debug('interface ready');
                  resolve();
                }
              }, CONNECTION_RETRY_DELAY_MULTIPLIER * CONNECTION_RETRY_COUNT);
            })
            .catch(err => {
              client.close();
              reject(err);
            });
        })
        .on('error', err => {
          debug(err);
          setTimeout(retry, CONNECTION_RETRY_DELAY_MULTIPLIER *
            CONNECTION_RETRY_COUNT);
        });
      };

      retry();
    });
  }
}

module.exports = Chrome;
