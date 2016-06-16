"use strict";
/**
 * Module dependencies.
 */

require('mocha-generators').install();

var chai = require('chai');
var asPromised = require('chai-as-promised');

var should = chai.should();
var expect = chai.expect;

var Nightmare = require('..');
var url = require('url');
var server = require('./server');
var path = require('path');
var split2 = require("split2");

/**
 * Temporary directory
 */

global.tmp_dir = path.join(__dirname, 'tmp');

/**
 * Get rid of a warning.
 */

process.setMaxListeners(0);

/**
 * Locals.
 */

let base = 'http://localhost:7500/';

before(function (done) {
    server.listen(7500, done);

    chai.use(asPromised);

    /**
     * Simple assertion for running processes
     */
    chai.Assertion.addProperty('process', function () {
        var running = true;
        try { process.kill(this._obj, 0); } catch (e) { running = false; }
        this.assert(
            running,
            'expected process ##{this} to be running',
            'expected process ##{this} not to be running');
    });

    global.should = chai.should();
    global.expect = chai.expect;

    global.Nightmare = withDeprecationTracking(Nightmare);

    /**
     * Generate a URL to a specific fixture.
     *
     * @param {String} path
     * @returns {String}
     */

    global.fixture = function (path) {
        return url.resolve(base, path);
    };
});

after(function () {
    global.Nightmare.assertNoDeprecations();
});

/**
 * Track deprecation warnings.
 */
function withDeprecationTracking(cls) {

    Nightmare.__deprecations = [];

    cls.prototype.childReady = function () {
        var self = this;

        self.proc.stderr.pipe(split2()).on('data', function (line) {
            if (line.indexOf('deprecated') > -1) {
                Nightmare.__deprecations.unshift(line);
            }
        });
    };

    cls.assertNoDeprecations = function () {
        var deprecations = Nightmare.__deprecations;
        if (deprecations.length) {
            var plural = deprecations.length === 1 ? '' : 's';
            throw new Error(
                `Used ${deprecations.length} deprecated Electron API${plural}:
        ${Array.from(deprecations).join('\n        ')}`);
        }
    };

    return cls;
};
