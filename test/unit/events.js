"use strict";

require('mocha-generators').install();

describe('Nightmare', function () {

    describe('events', function () {
        let nightmare;

        beforeEach(function* () {
            nightmare = new Nightmare();
            yield nightmare.init();
        });

        afterEach(function* () {
            nightmare.end();
        });

        it('should fire an event on page load complete', function* () {
            var fired = false;
            nightmare
                .on('did-finish-load', function () {
                    fired = true;
                });
            yield nightmare
                .goto(fixture('events'));
            fired.should.be.true;
        });

        it('should fire an event on javascript error', function* () {
            var fired = false;
            nightmare
                .on('page', function (type, errorMessage, errorStack) {
                    if (type === 'error') {
                        fired = true;
                    }
                });
            yield nightmare
                .goto(fixture('events'));
            fired.should.be.true;
        });

        it('should fire an event on javascript console.log', function* () {
            var log = '';

            nightmare.on('console', function (type, str) {
                if (type === 'log') log = str;
            });

            yield nightmare.goto(fixture('events'));

            log.should.equal('my log');
        });

        it('should fire an event on page load failure', function* () {
            var fired = false;
            nightmare
                .on('did-fail-load', function () {
                    fired = true;
                });

            try {
                yield nightmare
                    .goto('http://example:port');

            }
            catch (ex) {
                //Do Nothing.
            }

            fired.should.be.true;
        });

        it('should fire an event on javascript window.alert', function* () {
            var alert = '';
            nightmare.on('page', function (type, message) {
                if (type === 'alert') {
                    alert = message;
                }
            });

            yield nightmare.chain()
                .goto(fixture('events'))
                .evaluate(function () {
                    alert('my alert');
                });
            alert.should.equal('my alert');
        });

        it('should fire an event on javascript window.prompt', function* () {
            var prompt = '';
            var response = '';
            nightmare.on('page', function (type, message, res) {
                if (type === 'prompt') {
                    prompt = message;
                    response = res;
                }
            });

            yield nightmare.chain()
                .goto(fixture('events'))
                .evaluate(function () {
                    prompt('my prompt', 'hello!');
                });
            prompt.should.equal('my prompt');
            response.should.equal('hello!');
        });

        it('should fire an event on javascript window.confirm', function* () {
            var confirm = '';
            var response = '';
            nightmare.on('page', function (type, message, res) {
                if (type === 'confirm') {
                    confirm = message;
                    response = res;
                }
            });

            yield nightmare.chain()
                .goto(fixture('events'))
                .evaluate(function () {
                    confirm('my confirm', 'hello!');
                });
            confirm.should.equal('my confirm');
            response.should.equal('hello!');
        });
    });

});