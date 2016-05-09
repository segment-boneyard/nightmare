"use strict";

require('mocha-generators').install();

describe('Nightmare', function () {

    describe('devtools', function () {
        let nightmare;

        beforeEach(function () {
            Nightmare.action('waitForDevTools',
                function (ns, options, parent, win, renderer) {
                    parent.respondTo('waitForDevTools', function (done) {
                        done.resolve(win.webContents.isDevToolsOpened());
                    });
                },
                function () {
                    return this._invokeRunnerOperation("waitForDevTools");
                });
            nightmare = new Nightmare({ show: true, openDevTools: true });

        });

        afterEach(function* () {
            nightmare.end();
        });

        it('should open devtools', function* () {
            var devToolsOpen = yield nightmare.chain()
                .goto(fixture('simple'))
                .wait(1000)
                .waitForDevTools();

            devToolsOpen.should.be.true;
        });
    });
});