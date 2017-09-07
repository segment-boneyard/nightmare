/**
 * Module Dependencies
 */

var parent = require('./ipc')(process);
var electron = require('electron');
var app = electron.app;
var runnerInstance = require('./runner-instance');

/**
 * Handle uncaught exceptions in the main electron process
 */

process.on('uncaughtException', function(e) {
  parent.emit('uncaughtException', e.stack)
})

/**
 * Update the app paths
 */

if (process.argv.length < 3) {
  throw new Error(`Too few runner arguments: ${JSON.stringify(process.argv)}`);
}

var processArgs = JSON.parse(process.argv[2]);
var paths = processArgs.paths;
if (paths) {
  for (var i in paths) {
    app.setPath(i, paths[i]);
  }
}
var switches = processArgs.switches;
if (switches) {
  for (var i in switches) {
    app.commandLine.appendSwitch(i, switches[i]);
  }
}

/**
 * Hide the dock
 */

// app.dock is not defined when running
// electron in a platform other than OS X
if (!processArgs.dock && app.dock) {
  app.dock.hide();
}

/**
 * Listen for the app being "ready"
 */

app.on('ready', function() {
  runnerInstance(parent)
});
