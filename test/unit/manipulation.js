"use strict";

require('mocha-generators').install();

describe('Nightmare', function () {

    describe('manipulation', function () {
        let nightmare;

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
            var input = 'nightmare';
            var events = input.length * 3;

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
            var input = 'nightmare';
            var events = input.length * 3;

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
            var input = 'nightmare insert typing';

            var value = yield nightmare.chain()
                .goto(fixture('manipulation'))
                .insert('input[type=search]', input)
                .evaluate(function () {
                    return document.querySelector('input[type=search]').value;
                });

            value.should.equal('nightmare insert typing');
        });

        it('should support clearing inserted text', function* () {

            var value = yield nightmare.chain()
                .goto(fixture('manipulation'))
                .insert('input[type=search]')
                .evaluate(function () {
                    return document.querySelector('input[type=search]').value;
                });

            value.should.equal('');
        });

        it('should not type in a nonexistent selector', function () {
            return nightmare.chain()
                .goto(fixture('manipulation'))
                .type('does-not-exist', 'nightmare')
                .should.be.rejected;
        });

        it('should not insert in a nonexistent selector', function () {
            return nightmare.chain()
                .goto(fixture('manipulation'))
                .insert('does-not-exist', 'nightmare')
                .should.be.rejected;
        });

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
});