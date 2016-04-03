"use strict";
/**
 * Module dependencies.
 */

require('mocha-generators').install();

var Nightmare = require('..');
var chai = require('chai');
var url = require('url');
var server = require('./server');
var fs = require('fs');
var mkdirp = require('mkdirp');
var path = require('path');
var rimraf = require('rimraf');
var child_process = require('child_process');
var should = chai.should();
var expect = chai.expect;

/**
 * Temporary directory
 */

var tmp_dir = path.join(__dirname, 'tmp')

/**
 * Get rid of a warning.
 */

process.setMaxListeners(0);

/**
 * Locals.
 */

var base = 'http://localhost:7500/';

describe('Nightmare', function () {
    before(function (done) {
        server.listen(7500, done);
    });

    it('should be constructable', function* () {
        var nightmare = new Nightmare();
        nightmare.should.be.ok;
        nightmare.end();
    });

    it('should kill its electron process when it is killed', function (done) {
        var child = child_process.fork(
            path.join(__dirname, 'files', 'nightmare-unended.js'));

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

    describe('navigation', function () {
        var nightmare;

        beforeEach(function* () {
            nightmare = new Nightmare();
            yield nightmare.init();
        });

        afterEach(function* () {
            nightmare.end();
        });

        it('should click on a link and then go back', function* () {

            var title = yield nightmare.chain()
                .goto(fixture('navigation'))
                .title();

            title.should.equal('Navigation');

            title = yield nightmare.chain()
                .clickAndWaitUntilFinishLoad('a')
                .title();

            title.should.equal('A')

            var title = yield nightmare.chain()
                .back()
                .title();

            title.should.equal('Navigation');
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
        })

        it('should click on a link, go back, and then go forward', function* () {
            yield nightmare.goto(fixture('navigation'));
            var title = yield nightmare.title();
            title.should.equal('Navigation')
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
            yield nightmare.expectNavigation(function() { return this.click('a') }, 2000);

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
    });

    describe('evaluation', function () {
        var nightmare;

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
    });

    describe('manipulation', function () {
        var nightmare;

        beforeEach(function* () {
            nightmare = new Nightmare();
            yield nightmare.init();
        });

        afterEach(function* () {
            nightmare.end();
        });

        it('should inject javascript onto the page', function* () {
            var globalNumber = yield nightmare.chain()
                .goto(fixture('manipulation'))
                .inject('js', 'test/files/globals.js')
                .evaluate(function () {
                    return globalNumber;
                });
            globalNumber.should.equal(7);

            var numAnchors = yield nightmare.chain()
                .goto(fixture('manipulation'))
                .inject('js', 'test/files/jquery-2.1.1.min.js')
                .evaluate(function () {
                    return $('h1').length;
                });
            numAnchors.should.equal(1);
        });

        it('should inject css onto the page', function* () {
            var color = yield nightmare.chain()
                .goto(fixture('manipulation'))
                .inject('js', 'test/files/jquery-2.1.1.min.js')
                .inject('css', 'test/files/test.css')
                .evaluate(function () {
                    return $('body').css('background-color');
                });
            color.should.equal('rgb(255, 0, 0)');
        });

        it('should not inject unsupported types onto the page', function* () {
            try {
                var color = yield nightmare.chain()
                    .goto(fixture('manipulation'))
                    .inject('js', 'test/files/jquery-2.1.1.min.js')
                    .inject('pdf', 'test/files/test.css')
                    .evaluate(function () {
                        return $('body').css('background-color');
                    });

                color.should.not.equal('rgb(255, 0, 0)');
            }
            catch (ex) {
                //naught.
            }
        });

        it('should type', function* () {
            var input = 'nightmare'
            var events = input.length * 3

            var value = yield nightmare.chain()
                .on('console', function (type, input, message) {
                    if (type === 'log') events--;
                })
                .goto(fixture('manipulation'))
                .type('input[type=search]', input)
                .evaluate(function () {
                    return document.querySelector('input[type=search]').value;
                });

            value.should.equal('nightmare');
            events.should.equal(0);
        });

        it('should emulate keystrokes', function* () {
            var input = 'nightmare';
            var events = input.length * 3;

            var value = yield nightmare.chain()
                .on('console', function (type, input, message) {
                    if (type === 'log') events--;
                })
                .goto(fixture('manipulation'))
                .emulateKeystrokes('input[type=search]', input)
                .evaluate(function () {
                    return document.querySelector('input[type=search]').value;
                });

            value.should.equal('nightmare');
            events.should.equal(0);
        });

        it('should type integer', function* () {
            var input = 10;
            var events = input.toString().length * 3;

            var value = yield nightmare.chain()
                .on('console', function (type, input, message) {
                    if (type === 'log') events--;
                })
                .goto(fixture('manipulation'))
                .type('input[type=search]', input)
                .evaluate(function () {
                    return document.querySelector('input[type=search]').value;
                });

            value.should.equal('10');
            events.should.equal(0);
        });


        it('should type object', function* () {
            var input = {
                foo: 'bar'
            };
            var events = input.toString().length * 3;

            var value = yield nightmare.chain()
                .on('console', function (type, input, message) {
                    if (type === 'log') events--;
                })
                .goto(fixture('manipulation'))
                .type('input[type=search]', input)
                .evaluate(function () {
                    return document.querySelector('input[type=search]').value;
                });

            value.should.equal('[object Object]');
            events.should.equal(0);
        });

        it('should clear inputs', function* () {
            var input = 'nightmare'
            var events = input.length * 3

            var value = yield nightmare.chain()
                .on('console', function (type, input, message) {
                    if (type === 'log') events--;
                })
                .goto(fixture('manipulation'))
                .type('input[type=search]', input)
                .type('input[type=search]')
                .evaluate(function () {
                    return document.querySelector('input[type=search]').value;
                });

            value.should.equal('');
            events.should.equal(0);
        });

        it('should support inserting text', function* () {
            var input = 'nightmare insert typing'

            var value = yield nightmare.chain()
                .goto(fixture('manipulation'))
                .insert('input[type=search]', input)
                .evaluate(function () {
                    return document.querySelector('input[type=search]').value;
                });

            value.should.equal('nightmare insert typing');
        })

        it('should support clearing inserted text', function* () {

            var value = yield nightmare.chain()
                .goto(fixture('manipulation'))
                .insert('input[type=search]')
                .evaluate(function () {
                    return document.querySelector('input[type=search]').value;
                });

            value.should.equal('');
        })

        it('should blur the active element when something is clicked', function* () {
            var isBody = yield nightmare.chain()
                .goto(fixture('manipulation'))
                .type('input[type=search]', 'test')
                .click('p')
                .evaluate(function () {
                    return document.activeElement === document.body;
                });
            isBody.should.be.true;
        });

        it('should type and click', function* () {
            var title = yield nightmare.chain()
                .goto(fixture('manipulation'))
                .type('input[type=search]', 'nightmare')
                .clickAndWaitUntilFinishLoad('button[type=submit]')
                .title();

            title.should.equal('Manipulation - Results');
        });

        it('should type and click several times', function* () {
            var title = yield nightmare.chain()
                .goto(fixture('manipulation'))
                .type('input[type=search]', 'github nightmare')
                .clickAndWaitUntilFinishLoad('button[type=submit]')
                .clickAndWaitUntilFinishLoad('a')
                .title();
            title.should.equal('Manipulation - Result - Nightmare');
        });

        it('should type and emulate a click several times', function* () {
            var title = yield nightmare.chain()
                .goto(fixture('manipulation'))
                .type('input[type=search]', 'github nightmare')
                .emulateClick('button[type=submit]')
                .waitUntilFinishLoad()
                .emulateClick('a')
                .waitUntilFinishLoad()
                .title();
            title.should.equal('Manipulation - Result - Nightmare');
        });

        it('should checkbox', function* () {
            var checkbox = yield nightmare.chain()
                .goto(fixture('manipulation'))
                .check('input[type=checkbox]')
                .evaluate(function () {
                    return document.querySelector('input[type=checkbox]').checked;
                });
            checkbox.should.be.true;
        });

        it('should uncheck', function* () {
            var checkbox = yield nightmare.chain()
                .goto(fixture('manipulation'))
                .check('input[type=checkbox]')
                .uncheck('input[type=checkbox]')
                .evaluate(function () {
                    return document.querySelector('input[type=checkbox]').checked;
                });
            checkbox.should.be.false;
        });

        it('should select', function* () {
            var select = yield nightmare.chain()
                .goto(fixture('manipulation'))
                .select('select', 'b')
                .evaluate(function () {
                    return document.querySelector('select').value;
                });
            select.should.equal('b');
        });

        it('should scroll to specified position', function* () {
            // start at the top
            var coordinates = yield nightmare.chain()
                .viewport(320, 320)
                .goto(fixture('manipulation'))
                .evaluate(function () {
                    return {
                        top: document.body.scrollTop,
                        left: document.body.scrollLeft
                    };
                });
            coordinates.top.should.equal(0);
            coordinates.left.should.equal(0);

            // scroll down a bit
            coordinates = yield nightmare.chain()
                .scrollTo(100, 50)
                .evaluate(function () {
                    return {
                        top: document.body.scrollTop,
                        left: document.body.scrollLeft
                    };
                });
            coordinates.top.should.equal(100);
            coordinates.left.should.equal(50);
        });

        it('should scroll to specified selector', function* () {
            var selector = 'input';
            // Get actual element coordinates
            var elemCoordinates = yield nightmare.chain()
                .viewport(320, 320)
                .goto(fixture('manipulation'))
                .evaluate(function (selector) {
                    var element = document.querySelector(selector);
                    var rect = element.getBoundingClientRect();
                    return {
                        top: Math.round(rect.top),
                        left: Math.round(rect.left)
                    };
                }, selector);
            elemCoordinates.should.have.property('top');
            elemCoordinates.top.should.not.be.equal(0);
            elemCoordinates.should.have.property('left');
            elemCoordinates.left.should.not.be.equal(0);

            // Scroll to the element
            var coordinates = yield nightmare.chain()
                .scrollTo(selector)
                .evaluate(function () {
                    return {
                        top: document.body.scrollTop,
                        left: document.body.scrollLeft
                    };
                });
            coordinates.top.should.equal(elemCoordinates.top);
            // TODO: fix this in the fixture
            // coordinates.left.should.equal(elemCoordinates.left);
        });

        it('should hover over an element', function* () {
            var color = yield nightmare.chain()
                .goto(fixture('manipulation'))
                .mouseover('h1')
                .evaluate(function () {
                    var element = document.querySelector('h1');
                    return element.style.background;
                });
            color.should.equal('rgb(102, 255, 102)');
        });

        it('should mousedown on an element', function* () {
            var color = yield nightmare.chain()
                .goto(fixture('manipulation'))
                .mousedown('h1')
                .evaluate(function () {
                    var element = document.querySelector('h1');
                    return element.style.background;
                });
            color.should.equal('rgb(255, 0, 0)');
        });
    });

    describe('cookies', function () {
        var nightmare;

        beforeEach(function* () {
            nightmare = new Nightmare({
                webPreferences: { partition: 'test-partition' }
            });

            yield nightmare.chain().init().goto(fixture('cookie'));
        });

        afterEach(function* () {
            nightmare.end();
        });

        it('.set(name, value) & .get(name)', function* () {
            var cookies = nightmare.cookies

            yield cookies.set('hi', 'hello')
            var cookie = yield cookies.get('hi')

            cookie.name.should.equal('hi')
            cookie.value.should.equal('hello')
            cookie.path.should.equal('/')
            cookie.secure.should.equal(false)
        })

        it('.set(obj) & .get(name)', function* () {
            var cookies = nightmare.cookies

            yield cookies.set({
                name: 'nightmare',
                value: 'rocks',
                path: '/cookie'
            })
            var cookie = yield cookies.get('nightmare')

            cookie.name.should.equal('nightmare')
            cookie.value.should.equal('rocks')
            cookie.path.should.equal('/cookie')
            cookie.secure.should.equal(false)
        })

        it('.set([cookie1, cookie2]) & .get()', function* () {
            var cookies = nightmare.cookies

            yield cookies.set([
                {
                    name: 'hi',
                    value: 'hello',
                    path: '/'
                },
                {
                    name: 'nightmare',
                    value: 'rocks',
                    path: '/cookie'
                }
            ])

            var cookies = yield cookies.get()
            cookies.length.should.equal(2)

            // sort in case they come in a different order
            cookies = cookies.sort(function (a, b) {
                if (a.name > b.name) return 1
                if (a.name < b.name) return -1
                return 0
            })

            cookies[0].name.should.equal('hi')
            cookies[0].value.should.equal('hello')
            cookies[0].path.should.equal('/')
            cookies[0].secure.should.equal(false)

            cookies[1].name.should.equal('nightmare')
            cookies[1].value.should.equal('rocks')
            cookies[1].path.should.equal('/cookie')
            cookies[1].secure.should.equal(false)
        })

        it('.set([cookie1, cookie2]) & .get(query)', function* () {
            var cookies = nightmare.cookies

            yield cookies.set([
                {
                    name: 'hi',
                    value: 'hello',
                    path: '/'
                },
                {
                    name: 'nightmare',
                    value: 'rocks',
                    path: '/cookie'
                }
            ])

            var cookies = yield cookies.get({ path: '/cookie' })
            cookies.length.should.equal(1)

            cookies[0].name.should.equal('nightmare')
            cookies[0].value.should.equal('rocks')
            cookies[0].path.should.equal('/cookie')
            cookies[0].secure.should.equal(false)
        })

        it('.set([cookie]) & .clear(name) & .get(query)', function* () {
            var cookies = nightmare.cookies

            yield cookies.set([
                {
                    name: 'hi',
                    value: 'hello',
                    path: '/'
                },
                {
                    name: 'nightmare',
                    value: 'rocks',
                    path: '/cookie'
                }
            ])

            yield cookies.clear('nightmare');

            var cookies = yield cookies.get({ path: '/cookie' });

            cookies.length.should.equal(0);
        })
    })

    describe('rendering', function () {
        var nightmare;

        before(function (done) {
            mkdirp(tmp_dir, done)
        })

        after(function (done) {
            rimraf(tmp_dir, done)
        })

        beforeEach(function* () {
            nightmare = new Nightmare();
            yield nightmare.init();
        });

        afterEach(function* () {
            nightmare.end();
        });

        it('should take a screenshot', function* () {
            yield nightmare.chain()
                .goto('https://github.com/')
                .screenshot(tmp_dir + '/test.png');
            var stats = fs.statSync(tmp_dir + '/test.png');
            stats.size.should.be.at.least(1000);
        });

        it('should buffer a screenshot', function* () {
            var image = yield nightmare.chain()
                .goto('https://github.com')
                .screenshot();
            Buffer.isBuffer(image).should.be.true;
            image.length.should.be.at.least(1000);
        });

        it('should take a clipped screenshot', function* () {
            yield nightmare.chain()
                .goto('https://github.com/')
                .screenshot(tmp_dir + '/test-clipped.png', {
                    x: 200,
                    y: 100,
                    width: 100,
                    height: 100
                });
            var statsClipped = fs.statSync(tmp_dir + '/test-clipped.png');
            statsClipped.size.should.be.at.least(300);
        });

        it('should buffer a clipped screenshot', function* () {
            var image = yield nightmare.chain()
                .goto('https://github.com')
                .screenshot({
                    x: 200,
                    y: 100,
                    width: 100,
                    height: 100
                });
            Buffer.isBuffer(image).should.be.true;
            image.length.should.be.at.least(300);
        });

        it('should load jquery correctly', function* () {
            var loaded = yield nightmare.chain()
                .goto(fixture('rendering'))
                .wait(3000)
                .evaluate(function () {
                    return !!window.jQuery;
                });
            loaded.should.be.at.least(true);
        });

        it('should render fonts correctly', function* () {
            yield nightmare.chain()
                .goto(fixture('rendering'))
                .wait(2000)
                .screenshot(tmp_dir + '/font-rendering.png');
            var stats = fs.statSync(tmp_dir + '/font-rendering.png');
            stats.size.should.be.at.least(1000);
        });

        it('should render a PDF', function* () {
            yield nightmare.chain()
                .goto(fixture('manipulation'))
                .pdf(tmp_dir + '/test.pdf');
            var stats = fs.statSync(tmp_dir + '/test.pdf');
            stats.size.should.be.at.least(1000);
        });

        it('should accept options to render a PDF', function* () {
            yield nightmare.chain()
                .goto(fixture('manipulation'))
                .pdf(tmp_dir + '/test2.pdf', { printBackground: false });
            var stats = fs.statSync(tmp_dir + '/test2.pdf');
            stats.size.should.be.at.least(1000);
        });

        it('should return a buffer from a PDF with no path', function* () {
            var buf = yield nightmare.chain()
                .goto(fixture('manipulation'))
                .pdf({ printBackground: false });

            var isBuffer = Buffer.isBuffer(buf);

            buf.length.should.be.at.least(1000);
            isBuffer.should.be.true;
        });
    });

    describe('events', function () {
        var nightmare;

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
                if (type === 'log') log = str
            });

            yield nightmare.goto(fixture('events'))

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
            var response = ''
            nightmare.on('page', function (type, message, res) {
                if (type === 'prompt') {
                    prompt = message;
                    response = res
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
            var response = ''
            nightmare.on('page', function (type, message, res) {
                if (type === 'confirm') {
                    confirm = message;
                    response = res
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

    describe('options', function () {
        var nightmare;

        afterEach(function* () {
            nightmare.end();
        });

        it('should set audio muted state', function* () {
            nightmare = new Nightmare();
            yield nightmare.init();

            var audioMuted = yield nightmare
                .setAudioMuted(false);
            
            audioMuted.should.eql(false);
        });

        it('should set useragent', function* () {
            nightmare = new Nightmare();
            yield nightmare.init();

            var useragent = yield nightmare.chain()
                .useragent('firefox')
                .goto(fixture('options'))
                .evaluate(function () {
                    return window.navigator.userAgent;
                });
            useragent.should.eql('firefox');
        });

        it('should complete setting useragent', function* () {
            nightmare = new Nightmare();
            yield nightmare.init();

            yield nightmare.useragent("firefox");
            yield nightmare.goto(fixture('options'));
            var useragent = yield nightmare.evaluate(function () {
                    return window.navigator.userAgent;
            });
            
            useragent.should.eql('firefox');
        });

        it('should wait and fail with waitTimeout', function* () {
            var didFail = false;
            try {
                nightmare = new Nightmare({ waitTimeout: 254 });
                yield nightmare.init();

                yield nightmare.chain()
                    .goto(fixture('navigation'))
                    .wait('foobar');
            } catch (e) {
                didFail = true;
            }
            didFail.should.be.true;
        });

        it('should wait and fail with waitTimeout and a ms wait time', function* () {
            var didFail = false;
            try {
                nightmare = new Nightmare({ waitTimeout: 254 });
                yield nightmare.init();

                yield nightmare.chain()
                    .goto(fixture('navigation'))
                    .wait(1000);
            } catch (e) {
                didFail = true;
            }
            didFail.should.be.true;
        });

        it('should wait and fail with waitTimeout with queued functions', function* () {
            var didFail = false;
            try {
                nightmare = new Nightmare({ waitTimeout: 254 });
                yield nightmare.init();

                yield nightmare.chain()
                    .goto(fixture('navigation'))
                    .wait('foobar')
                    .exists('baz');
            } catch (e) {
                didFail = true;
            }
            didFail.should.be.true;
        });

        it('should set authentication', function* () {
            nightmare = new Nightmare();
            yield nightmare.init();

            var data = yield nightmare.chain()
                .setAuthenticationCredentials('my', 'auth')
                .goto(fixture('auth'))
                .evaluate(function () {
                    return JSON.parse(document.querySelector('pre').innerHTML);
                });
          data.should.eql({ name: 'my', pass: 'auth' });
        });

        it('should set viewport', function* () {
            var size = { width: 400, height: 300, 'use-content-size': true };
            nightmare = new Nightmare(size);
            yield nightmare.init();

            var result = yield nightmare.chain()
                .goto(fixture('options'))
                .evaluate(function () {
                    return {
                        width: window.innerWidth,
                        height: window.innerHeight
                    };
                });
            result.width.should.eql(size.width);
            result.height.should.eql(size.height);
        });

        it('should set a single header', function* () {
            nightmare = new Nightmare();
            yield nightmare.init();

            var headers = yield nightmare.chain()
                .header('X-Nightmare-Header', 'hello world')
                .goto(fixture('headers'))
                .evaluate(function () {
                    return JSON.parse(document.querySelector('pre').innerHTML);
                });
            headers['x-nightmare-header'].should.equal('hello world');
        });

        it('should set all headers', function* () {
            nightmare = new Nightmare();
            yield nightmare.init();

            var headers = yield nightmare.chain()
                .header({ 'X-Foo': 'foo', 'X-Bar': 'bar' })
                .goto(fixture('headers'))
                .evaluate(function () {
                    return JSON.parse(document.querySelector('pre').innerHTML);
                });
            headers['x-foo'].should.equal('foo');
            headers['x-bar'].should.equal('bar');
        });

        it('should set headers for that request', function* () {
            nightmare = new Nightmare();
            yield nightmare.init();

            var headers = yield nightmare.chain()
                .goto(fixture('headers'), { 'X-Nightmare-Header': 'hello world' })
                .evaluate(function () {
                    return JSON.parse(document.querySelector('pre').innerHTML);
                });
            headers['x-nightmare-header'].should.equal('hello world');
        });

        it('should allow webPreferences settings', function* () {
            nightmare = new Nightmare({ webPreferences: { webSecurity: false } });
            yield nightmare.init();

            var result = yield nightmare.chain()
                .goto(fixture('options'))
                .evaluate(function () {
                    return document.getElementById('example-iframe').contentDocument;
                });

            result.should.be.ok;
        });

        it('should be constructable with paths', function* () {
            nightmare = new Nightmare({ paths: { userData: __dirname } });
            yield nightmare.init();
            nightmare.should.be.ok;
        });

        it('should be constructable with switches', function* () {
            nightmare = new Nightmare({ switches: {} });
            yield nightmare.init();
            nightmare.should.be.ok;
        });

        it('should allow to use external Electron', function* () {
            nightmare = new Nightmare({ electronPath: require('electron-prebuilt') });
            yield nightmare.init();
            nightmare.should.be.ok;
        })
    });

    describe('Nightmare.action(name, fn)', function () {
        var nightmare;

        beforeEach(function* () {
            nightmare = new Nightmare();
        });

        afterEach(function* () {
            nightmare.end();
        });

        it('should support custom actions that are generators', function* () {
            Nightmare.action("size", function* () {
                return yield this.evaluate_now(function () {
                    var w = Math.max(document.documentElement.clientWidth, window.innerWidth || 0)
                    var h = Math.max(document.documentElement.clientHeight, window.innerHeight || 0)
                    return {
                        height: h,
                        width: w
                    }
                })
            });

            yield nightmare.init();

            var size = yield nightmare.chain()
                .goto(fixture('simple'))
                .size();

            size.height.should.be.a('number')
            size.width.should.be.a('number')
        });

        it('should support custom actions that are promises', function* () {
            Nightmare.action("size", function () {
                return this.evaluate_now(function () {
                    var w = Math.max(document.documentElement.clientWidth, window.innerWidth || 0)
                    var h = Math.max(document.documentElement.clientHeight, window.innerHeight || 0)
                    return {
                        height: h,
                        width: w
                    }
                })
            });

            yield nightmare.init();

            var size = yield nightmare.chain()
                .goto(fixture('simple'))
                .size();

            size.height.should.be.a('number')
            size.width.should.be.a('number')
        });

        it('should support custom namespaces', function* () {
            Nightmare.action("style", {
                background: function* () {
                    return yield this.evaluate_now(function () {
                        return window.getComputedStyle(document.body, null).backgroundColor;
                    })
                },
                color: function* () {
                    return yield this.evaluate_now(function () {
                        return window.getComputedStyle(document.body, null).color;
                    })
                }
            });

            yield nightmare.init();

            yield nightmare.goto(fixture('simple'));
            var background = yield nightmare.style.background();
            var color = yield nightmare.style.color();

            background.should.equal('rgba(0, 0, 0, 0)');
            color.should.equal('rgb(0, 0, 0)');
        });

        it('should support chaining on custom namespaces', function* () {

            var backgroundCount = 0;
            var colorCount = 0;

            Nightmare.action("style", {
                background: function* () {
                    backgroundCount++;
                    return yield this.evaluate_now(function () {
                        return window.getComputedStyle(document.body, null).backgroundColor;
                    })
                },
                color: function* () {
                    colorCount++;
                    return yield this.evaluate_now(function () {
                        return window.getComputedStyle(document.body, null).color;
                    })
                }
            });

            yield nightmare.init();

            var color = yield nightmare.chain()
                .goto(fixture('simple'))
                .style.background()
                .style.color();

            color.should.equal('rgb(0, 0, 0)');
            colorCount.should.equal(1);
            backgroundCount.should.equal(1);
        });
    })

    describe('Nightmare.use', function () {
        var nightmare;
        beforeEach(function* () {
            nightmare = new Nightmare();
            yield nightmare.init();
        });

        afterEach(function* () {
            nightmare.end();
        });

        it('should support extending nightmare', function* () {
            var tagName = yield nightmare.chain()
                .goto(fixture('simple'))
                .use(select('h1'));

            tagName.should.equal('H1');

            function select(tagname) {
                return function* (nightmare) {
                    return yield this.evaluate(function (tagname) {
                        return document.querySelector(tagname).tagName
                    }, tagname)
                }
            }
        })
    })

    describe('custom preload script', function () {
        it('should support passing your own preload script in', function* () {
            var nightmare = new Nightmare({
                webPreferences: {
                    preload: path.join(__dirname, 'fixtures', 'preload', 'index.js')
                }
            })

            try {
                var value = yield nightmare.chain()
                    .init()
                    .goto(fixture('preload'))
                    .evaluate(function () {
                        return window.preload;
                    });
                value.should.equal('custom');
            } finally {
                nightmare.end();
            }
        })
    });
});

/**
 * Generate a URL to a specific fixture.
 *
 * @param {String} path
 * @returns {String}
 */

function fixture(path) {
    return url.resolve(base, path);
}

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
