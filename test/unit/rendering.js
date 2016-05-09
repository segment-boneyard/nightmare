"use strict";

require('mocha-generators').install();
var rimraf = require('rimraf');
var mkdirp = require('mkdirp');
var fs = require('fs');
var PNG = require('pngjs').PNG;

describe('Nightmare', function () {

    describe('rendering', function () {
        let nightmare;

        before(function (done) {
            mkdirp(tmp_dir, done);
        });

        after(function (done) {
            rimraf(tmp_dir, done);
        });

        beforeEach(function* () {
            nightmare = new Nightmare();
            yield nightmare.init();
        });

        afterEach(function* () {
            nightmare.end();
        });

        it('should take a screenshot', function* () {
            yield nightmare.chain()
                .goto(fixture('screenshot'))
                .screenshot(tmp_dir + '/test.png');
            var stats = fs.statSync(tmp_dir + '/test.png');
            stats.size.should.be.at.least(1000);
        });

        it('should buffer a screenshot', function* () {
            var image = yield nightmare.chain()
                .goto(fixture('screenshot'))
                .screenshot();
            Buffer.isBuffer(image).should.be.true;
            image.length.should.be.at.least(1000);
        });

        it('should take a clipped screenshot', function* () {
            yield nightmare.chain()
                .goto(fixture('screenshot'))
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
                .goto(fixture('screenshot'))
                .screenshot({
                    x: 200,
                    y: 100,
                    width: 100,
                    height: 100
                });
            Buffer.isBuffer(image).should.be.true;
            image.length.should.be.at.least(300);
        });

        // repeat this test 3 times, since the concern here is non-determinism in
        // the timing accuracy of screenshots -- it might pass once, but likely not
        // several times in a row.
        for (var i = 0; i < 3; i++) {
            it('should screenshot an up-to-date image of the page (' + i + ')', function* () {
                var image = yield nightmare.chain()
                    .goto('about:blank')
                    .viewport(100, 100)
                    .evaluate(function () { document.body.style.background = '#900'; })
                    .evaluate(function () { document.body.style.background = '#090'; })
                    .screenshot();

                var png = new PNG();
                var imageData = yield png.parse.bind(png, image);
                var firstPixel = Array.from(imageData.data.slice(0, 3));
                firstPixel.should.deep.equal([0, 153, 0]);
            });
        }

        it('should screenshot an idle page', function* () {
            var image = yield nightmare.chain()
                .goto('about:blank')
                .viewport(100, 100)
                .evaluate(function () { document.body.style.background = '#900'; })
                .evaluate(function () { document.body.style.background = '#090'; })
                .wait(1000)
                .screenshot();

            var png = new PNG();
            var imageData = yield png.parse.bind(png, image);
            var firstPixel = Array.from(imageData.data.slice(0, 3));
            firstPixel.should.deep.equal([0, 153, 0]);
        });

        it('should not subscribe to frames until necessary', function () {
            var didSubscribe = false;
            var FrameManager = require('../../lib/frame-manager.js');
            var manager = FrameManager({
                webContents: {
                    beginFrameSubscription: function () { didSubscribe = true; },
                    endFrameSubscription: function () { },
                    executeJavaScript: function () { }
                }
            });
            didSubscribe.should.be.false;
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

        it('should save as html', function* () {
            yield nightmare.chain()
                .goto(fixture('manipulation'))
                .html(tmp_dir + '/test.html');
            var stats = fs.statSync(tmp_dir + '/test.html');
            stats.should.be.ok;
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

});