"use strict";

require('mocha-generators').install();
let path = require('path');
let child_process = require('child_process');

describe('Nightmare', function () {

    it('should be constructable', function* () {
        let nightmare = new Nightmare();
        nightmare.should.be.ok;
        nightmare.end();
    });

    it('should have version information', function* () {
        let nightmare = new Nightmare();
        let versions = yield nightmare.init();
        versions.electron.should.be.ok;
        versions.chrome.should.be.ok;

        nightmare.engineVersions.electron.should.be.ok;
        nightmare.engineVersions.chrome.should.be.ok;

        Nightmare.version.should.be.ok;
        nightmare.end();
    });

    it('should kill its electron process when it is killed', function (done) {
        var child = child_process.fork(
            path.join(__dirname, '..', 'files', 'nightmare-unended.js'));

        child.once('message', function (electronPid) {
            child.once('exit', function () {
                try {
                    electronPid.should.not.be.a.process;
                }
                catch (error) {
                    // if the test failed, clean up the still-running process
                    process.kill(electronPid, 'SIGINT');
                    throw error;
                }
                done();
            });
            child.kill();
        });
    });

    it('should exit with a non-zero code on uncaughtExecption', function (done) {
        var child = child_process.fork(
            path.join(__dirname, 'files', 'nightmare-error.js'), [], { silent: true });

        child.once('exit', function (code) {
            code.should.not.equal(0);
            done();
        });
    });

    it('should allow ending more than once', function* () {
         let nightmare = new Nightmare();
        nightmare.chain()
            .goto(fixture('navigation'))
            .end()
            .then(() => nightmare.end());
    });
});