"use strict";

require('mocha-generators').install();

describe('Nightmare', function () {

    describe('navigation', function () {
        let nightmare;

        beforeEach(function* () {
            nightmare = new Nightmare({
                webPreferences: { partition: 'test-partition' + Math.random() }
            });
            yield nightmare.init();
        });

        afterEach(function* () {
            nightmare.end();
        });

        it('should return data about the response', function* () {
            let data = yield nightmare.goto(fixture('navigation'));

            data.should.contain.keys('url', 'code', 'method', 'referrer', 'headers');
        });

        it('should reject with a useful message when no URL', function () {
            return nightmare.goto(undefined).then(
                function () { throw new Error('goto(undefined) didn’t cause an error'); },
                function (error) {
                    error.should.include('url');
                }
            );
        });

        it('should reject with a useful message for an empty URL', function () {
            return nightmare.goto('').then(
                function () { throw new Error('goto(undefined) didn’t cause an error'); },
                function (error) {
                    error.should.include('url');
                }
            );
        });

        it('should click on a link and then go back', function* () {

            var title = yield nightmare.chain()
                .goto(fixture('navigation'))
                .title();

            title.should.equal('Navigation');

            title = yield nightmare.chain()
                .clickAndWaitUntilFinishLoad('a')
                .title();

            title.should.equal('A');

            var title = yield nightmare.chain()
                .back()
                .title();

            title.should.equal('Navigation');
        });

        it('should fail if navigation target is invalid', function* () {
            let error = {};

            try {
                yield nightmare.goto('http://this-is-not-a-real-domain.com');
            }
            catch (ex) {
                error = ex;
            }

            error.should.contain.keys('message', 'code', 'url');
            error.code.should.be.a('number');
        });

        it('should fail if navigation target is a malformed URL', function* () {
            let error = {};

            try {
                yield nightmare.goto('somewhere out there');
            }
            catch (ex) {
                error = ex;
            }

            error.details.should.equal('ERR_INVALID_URL');
        });

        it('should fail if navigating to an unknown protocol', function* () {
            let error = {};

            try {
                yield nightmare.goto('fake-protocol://blahblahblah');
            }
            catch (ex) {
                error = ex;
            }
            error.details.should.equal('ERR_INVALID_URL');
        });

        it('should not fail if the URL loads but a resource fails', function* () {
            yield nightmare.goto(fixture('navigation/invalid-image'));
        });

        it('should not fail if a child frame fails', function* () {
            yield nightmare.goto(fixture('navigation/invalid-frame'));
        });

        it('should return correct data when child frames are present', function* () {
            let data = yield nightmare.goto(fixture('navigation/valid-frame'));

            data.should.have.property('url');
            data.url.should.equal(fixture('navigation/valid-frame'));
        });

        it('should not fail if response was a valid error (e.g. 404)', function* () {
            yield nightmare.goto(fixture('navigation/not-a-real-page'));
        });

        it('should fail if the response dies in flight', function* () {
            let error = {};

            try {
                yield nightmare.goto(fixture('do-not-respond'));
            }
            catch (ex) {
                error = ex;
            }

            error.code.should.equal(-324);
        });

        it('should not fail for a redirect', function* () {
            yield nightmare.goto(fixture('redirect?url=%2Fnavigation'));
        });

        it('should fail for a redirect to an invalid URL', function* () {
            var error = {};

            try {
                yield nightmare.goto(
                    fixture('redirect?url=http%3A%2F%2Fthis-is-not-a-real-domain.com'));
            }
            catch (ex) {
                error = ex;
            }

            error.code.should.equal(-105);
        });

        it('should succeed properly if request handler is present', function* () {
            Nightmare.action('monitorRequest',
                function (name, options, parent, win, renderer) {
                    win.webContents.session.webRequest.onBeforeRequest(['*://localhost:*'],
                        function (details, callback) {
                            callback({ cancel: false });
                        }
                    );
                },
                function () {
                }
            );

            let nm = new Nightmare({ webPreferences: { partition: 'test-partition' } });
            yield nm.chain()
                .goto(fixture('navigation'))
                .end();

        });

        it('should fail properly if request handler is present', function* () {
            let error = {};
            Nightmare.action('monitorRequest',
                function (name, options, parent, win, renderer) {
                    win.webContents.session.webRequest.onBeforeRequest(['*://localhost:*'],
                        function (details, callback) {
                            callback({ cancel: false });
                        }
                    );
                },
                function () {
                }
            );

            let nm = new Nightmare({ webPreferences: { partition: 'test-partition' } });
            yield nm.init();

            try {
                yield nm.chain()
                    .goto('http://this-is-not-a-real-domain.com');

            }
            catch (ex) {
                error = ex;
            }

            error.code.should.equal(-105);
        });

        it('should work for links that dont go anywhere', function* () {
            var title = yield Promise.all([
                yield nightmare.goto(fixture('navigation')),
                yield nightmare.clickAndWaitUntilFinishLoad('a'),
                yield nightmare.title()
            ]);

            title[2].should.equal('A');

            title = yield Promise.all([
                yield nightmare.click('.d'),
                yield nightmare.title()
            ]);

            title[1].should.equal('A');
        });

        it('should click on a link, go back, and then go forward', function* () {
            yield nightmare.goto(fixture('navigation'));
            var title = yield nightmare.title();
            title.should.equal('Navigation');
            yield nightmare.clickAndWaitUntilFinishLoad('a');

            yield nightmare.back();
            yield nightmare.forward();

            var title = yield nightmare.title();
            title.should.equal('A');
        });

        it('should perform an action that expects navigation', function* () {
            yield nightmare.goto(fixture('navigation'));
            var title = yield nightmare.title();
            title.should.equal('Navigation');
            yield nightmare.expectNavigation(function () { return this.click('a'); }, 2000);

            var title = yield nightmare.title();
            title.should.equal('A');
        });

        it('should fail when an action that expects navigation exceeds the timeout', function* () {
            var didFail = false;
            try {
                yield nightmare.goto(fixture('navigation'));
                var title = yield nightmare.title();
                title.should.equal('Navigation');
                yield nightmare.expectNavigation(function () { return; }, 1000);
            }
            catch (ex) {
                didFail = true;
            }

            didFail.should.be.true;
        });

        it('should refresh the page', function* () {
            yield nightmare.chain()
                .goto(fixture('navigation'))
                .refresh();
        });

        it('should wait until element is present', function* () {
            yield nightmare.chain()
                .goto(fixture('navigation'))
                .wait('a');
        });

        it('should escape the css selector correctly when waiting for an element', function* () {
            yield nightmare.chain()
                .goto(fixture('navigation'))
                .wait('#escaping\\:test');
        });

        it('should wait until the evaluate fn returns true', function* () {
            yield nightmare.chain()
                .goto(fixture('navigation'))
                .wait(function () {
                    var text = document.querySelector('a').textContent;
                    return (text === 'A');
                });
        });

        it('should wait until the evaluate fn with arguments returns true', function* () {
            yield nightmare.chain()
                .goto(fixture('navigation'))
                .wait(function (expectedA, expectedB) {
                    var textA = document.querySelector('a.a').textContent;
                    var textB = document.querySelector('a.b').textContent;
                    return (expectedA === textA && expectedB === textB);
                }, 'A', 'B');
        });

        it('should support javascript URLs', function* () {
            var gotoResult = yield nightmare.chain()
                .goto(fixture('navigation'))
                .goto('javascript:void(document.querySelector(".a").textContent="LINK");');
            gotoResult.should.be.an('object');

            var linkText = yield nightmare
                .evaluate(function () {
                    return document.querySelector('.a').textContent;
                });
            linkText.should.equal('LINK');
        });

        it('should support javascript URLs that load pages', function* () {
            var data = yield nightmare.chain()
                .goto(fixture('navigation'))
                .goto(`javascript:window.location='${fixture('navigation/a.html')}'`);
            data.should.contain.keys('url', 'code', 'method', 'referrer', 'headers');
            data.url.should.equal(fixture('navigation/a.html'));

            var linkText = yield nightmare
                .evaluate(function () {
                    return document.querySelector('.d').textContent;
                });
            linkText.should.equal('D');
        });
    });
});