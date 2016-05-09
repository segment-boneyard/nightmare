"use strict";

require('mocha-generators').install();
let IPC = require('../../lib/ipc');

describe('Nightmare', function () {

    describe('ipc', function () {
        let nightmare;
        beforeEach(function* () {
            Nightmare.action('test',
                function (_, __, parent, ___, ____) {
                    parent.respondTo('test', function (arg1, done) {
                        done.progress('one');
                        done.progress('two');
                        if (arg1 === 'error') {
                            done.reject('Error!');
                        }
                        else {
                            done.resolve(`Got ${arg1}`);
                        }
                    });
                },
                function (options) {

                    var promise = this.child.call('test', options.arg || options);
                    if (options.onData) {
                        promise.progress.on('data', options.onData);
                    }

                    if (options.onEnd) {
                        promise.progress.on('end', options.onEnd);
                    }

                    return promise;
                });
            Nightmare.action('noImplementation',
                function () {
                    return this.child.call('noImplementation');
                });
            nightmare = new Nightmare();
            yield nightmare.init();
        });

        afterEach(function () {
            nightmare.end();
        });

        it('should only make one IPC instance per process', function () {
            var processStub = { send: function () { }, on: function () { } };
            var ipc1 = IPC(processStub);
            var ipc2 = IPC(processStub);
            ipc1.should.equal(ipc2);
        });

        it('should support basic call-response', function* () {
            var result = yield nightmare.test('x');
            result.should.equal('Got x');
        });

        it('should support errors across IPC', function (done) {
            nightmare.test('error').then(
                function () {
                    done.reject(new Error('Action succeeded when it should have errored!'));
                },
                function () {
                    done();
                });
        });

        it('should stream progress', function* () {
            var progress = [];
            yield nightmare.test({
                arg: 'x',
                onData: (data) => progress.push(data),
                onEnd: (data) => progress.push(data)
            });
            progress.should.deep.equal(['one', 'two', 'Got x']);
        });

        it('should trigger error if no responder is registered', function (done) {
            nightmare.noImplementation().then(
                function () {
                    done(new Error('Action succeeded when it should have errored!'));
                },
                function () {
                    done();
                });
        });

        it('should log a warning when replacing a responder', function* () {
            Nightmare.action('uhoh',
                function (_, __, parent, ___, ____) {
                    parent.respondTo('test', function (done) {
                        done.resolve();
                    });
                },
                function () {
                    return this.child.call('test');
                });

            let logged = false;
            let nightmare = new Nightmare();

            var result = yield nightmare.chain({
                onChildReady: function () {
                    nightmare.on('nightmare:ipc:debug', function (message) {
                        if (message.toLowerCase().indexOf('replacing') > -1) {
                            logged = true;
                        }
                    });
                }
            })
                .goto('about:blank')
                .end();

            logged.should.be.true;
        });
    });
});