"use strict";

require('mocha-generators').install();

describe('Nightmare', function () {

    describe('evaluation', function () {
        let nightmare;

        beforeEach(function* () {
            nightmare = new Nightmare();
            yield nightmare.init();
        });

        afterEach(function* () {
            nightmare.end();
        });

        it('should get the title', function* () {
            var title = yield nightmare.chain()
                .goto(fixture('evaluation'))
                .title();
            title.should.eql('Evaluation');
        });

        it('should get the url', function* () {
            var url = yield nightmare.chain()
                .goto(fixture('evaluation'))
                .url();
            url.should.have.string(fixture('evaluation'));
        });

        it('should check if the selector exists', function* () {
            // existent element
            var exists = yield nightmare.chain()
                .goto(fixture('evaluation'))
                .exists('h1.title');

            exists.should.be.true;

            // non-existent element
            exists = yield nightmare.exists('a.blahblahblah');
            exists.should.be.false;
        });

        it('should check if an element is visible', function* () {
            // visible element
            var visible = yield nightmare.chain()
                .goto(fixture('evaluation'))
                .visible('h1.title');
            visible.should.be.true;

            // hidden element
            visible = yield nightmare
                .visible('.hidden');
            visible.should.be.false;

            // non-existent element
            visible = yield nightmare
                .visible('#asdfasdfasdf');
            visible.should.be.false;
        });

        it('should evaluate javascript on the page, with parameters', function* () {
            var title = yield nightmare.chain()
                .goto(fixture('evaluation'))
                .evaluate(function (parameter) {
                    return document.title + ' -- ' + parameter;
                }, 'testparameter');
            title.should.equal('Evaluation -- testparameter');
        });

        it('should capture invalid evaluate fn', function () {
            return nightmare.chain()
                .goto(fixture('evaluation'))
                .evaluate('not_a_function')
                .should.be.rejected;
        });

        it('should evaluate javascript and return undefined', function* () {
            var result = yield nightmare.chain()
                .goto(fixture('evaluation'))
                .evaluate(function () {
                    return undefined;
                });
            expect(result).to.be.undefined;
        });

        it('should evaluate javascript and reject the promise on errors', function* () {
            try {
                var result = yield nightmare.chain()
                    .goto(fixture('evaluation'))
                    .evaluate(function () {
                        throw new Error("Catastrophic Error!");
                    });
            }
            catch (ex) {
                expect(ex).to.equal("Catastrophic Error!");
            }
        });

        it('should evaluate async javascript by waiting for promises', function* () {
            var timeStart = new Date();

            var title = yield nightmare.chain()
                .goto(fixture('evaluation'))
                .evaluateAsync(function (parameter) {
                    var p = new Promise(function (resolve, reject) {
                        setTimeout(function () {
                            resolve(document.title + ' -- ' + parameter);
                        }, 2000);
                    });
                    return p;
                }, 'testparameter');

            title.should.equal('Evaluation -- testparameter');
            var diff = new Date() - timeStart;
            diff.should.be.at.least(2000);
        });

        it('should evaluate async javascript promise rejections', function* () {
            var timeStart = new Date();

            var failed = "";
            try {
                var title = yield nightmare.chain()
                    .goto(fixture('evaluation'))
                    .evaluateAsync(function (parameter) {
                        var p = new Promise(function (resolve, reject) {
                            setTimeout(function () {
                                reject("Catastrophic Error");
                            }, 2000);
                        });
                        return p;
                    }, 'testparameter');
            } catch (ex) {
                failed = ex;
            }

            failed.should.equal('Catastrophic Error');
            var diff = new Date() - timeStart;
            diff.should.be.at.least(2000);
        });

        it('should evaluate multiple async calls and return proper results', function* () {
            var timeStart = new Date();

            yield nightmare.chain()
                .goto(fixture('evaluation'));

            var queue = [];
            for (let i = 0; i < 3; i++) {
                var p = nightmare.evaluate(function (ix) {
                    return ix;
                }, i);
                queue.push(p);
            }

            var result = yield Promise.all(queue);

            result.should.deep.equal([0, 1, 2]);
        });
    });
});