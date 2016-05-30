"use strict";

require('mocha-generators').install();

describe('Nightmare', function () {

    describe('Nightmare.action(name, fn)', function () {
        let nightmare;

        beforeEach(function* () {
        });

        afterEach(function* () {
            nightmare.end();
        });

        it('should support custom actions that are generators', function* () {
            Nightmare.action("size", function* () {
                return yield this.evaluate_now(function () {
                    var w = Math.max(document.documentElement.clientWidth, window.innerWidth || 0);
                    var h = Math.max(document.documentElement.clientHeight, window.innerHeight || 0);
                    return {
                        height: h,
                        width: w
                    };
                });
            });

            nightmare = new Nightmare();
            yield nightmare.init();

            var size = yield nightmare.chain()
                .goto(fixture('simple'))
                .size();

            size.height.should.be.a('number');
            size.width.should.be.a('number');
        });
        
        it('should contain custom actions added after nightmare construction', function* () {

            nightmare = new Nightmare();
            
            Nightmare.action("size", function* () {
                return yield this.evaluate_now(function () {
                    var w = Math.max(document.documentElement.clientWidth, window.innerWidth || 0);
                    var h = Math.max(document.documentElement.clientHeight, window.innerHeight || 0);
                    return {
                        height: h,
                        width: w
                    };
                });
            });
            
            //Yay. Object.prototype works.
            expect(nightmare.size).to.be.function;
        });

        it('should support custom actions that are promises', function* () {
            Nightmare.action("size", function () {
                return this.evaluate_now(function () {
                    var w = Math.max(document.documentElement.clientWidth, window.innerWidth || 0);
                    var h = Math.max(document.documentElement.clientHeight, window.innerHeight || 0);
                    return {
                        height: h,
                        width: w
                    };
                });
            });

            nightmare = new Nightmare();
            yield nightmare.init();

            var size = yield nightmare.chain()
                .goto(fixture('simple'))
                .size();

            size.height.should.be.a('number');
            size.width.should.be.a('number');
        });

        it('should support custom actions with arguments', function* () {
            Nightmare.action("size", function (scale, offset) {
                return this.evaluate_now(function (scale, offset) {
                    var w = Math.max(document.documentElement.clientWidth, window.innerWidth || 0);
                    var h = Math.max(document.documentElement.clientHeight, window.innerHeight || 0);
                    return {
                        height: h,
                        width: w,
                        scaledHeight: h * scale + offset,
                        scaledWidth: w * scale + offset
                    };
                }, scale, offset);
            });

            nightmare = new Nightmare();
            yield nightmare.init();

            var scaleFactor = 2.0;
            var offsetFactor = 1;

            var size = yield nightmare.chain()
                .goto(fixture('simple'))
                .size(scaleFactor, offsetFactor);

            size.height.should.be.a('number');
            size.width.should.be.a('number');
            size.scaledHeight.should.be.a('number');
            size.scaledWidth.should.be.a('number');
            size.scaledHeight.should.be.equal(size.height * scaleFactor + offsetFactor);
            size.scaledWidth.should.be.equal(size.width * scaleFactor + offsetFactor);
        });

        it('should support custom namespaces', function* () {
            Nightmare.action("style", {
                background: function* () {
                    return yield this.evaluate_now(function () {
                        return window.getComputedStyle(document.body, null).backgroundColor;
                    });
                },
                color: function* () {
                    return yield this.evaluate_now(function () {
                        return window.getComputedStyle(document.body, null).color;
                    });
                }
            });

            nightmare = new Nightmare();
            yield nightmare.init();

            yield nightmare.goto(fixture('simple'));
            var background = yield nightmare.style.background();
            var color = yield nightmare.style.color();

            background.should.equal('rgba(0, 0, 0, 0)');
            color.should.equal('rgb(0, 0, 0)');
        });

        it('should support custom namespaces with arguments', function* () {
            Nightmare.action("math", {
                multiply: function* (a, b) {
                    return yield this.evaluate_now(function (a, b) {
                        return a * b;
                    }, a, b);
                }
            });

            nightmare = new Nightmare();
            yield nightmare.init();

            yield nightmare.goto(fixture('simple'));
            var answerToLifeTheUniverseAndEverything = yield nightmare.math.multiply(6, 7);

            answerToLifeTheUniverseAndEverything.should.equal(42);
        });

        it('should support chaining on custom namespaces', function* () {

            var backgroundCount = 0;
            var colorCount = 0;

            Nightmare.action("style2", {
                background: function* () {
                    backgroundCount++;
                    return yield this.evaluate_now(function () {
                        return window.getComputedStyle(document.body, null).backgroundColor;
                    });
                },
                color: function* () {
                    colorCount++;
                    return yield this.evaluate_now(function () {
                        return window.getComputedStyle(document.body, null).color;
                    });
                }
            });

            nightmare = new Nightmare();
            var color = yield nightmare.chain()
                .goto(fixture('simple'))
                .style2.background()
                .style2.color();

            color.should.equal('rgb(0, 0, 0)');
            colorCount.should.equal(1);
            backgroundCount.should.equal(1);
        });

        it('should support extending Electron', function* () {
            Nightmare.action('bind',
                function (ns, options, parent, win, renderer) {
                    parent.respondTo('bind', function (name, done) {
                        "use strict";
                        if (renderer.listeners(name).length === 0) {
                            renderer.on(name, function () {
                                parent.emit.apply(parent, [name].concat(Array.from(arguments).slice(1)));
                            });
                        }
                        done.resolve();
                    });
                },
                function (name, handler) {
                    var child = this.child;
                    if (handler) {
                        child.on(name, handler);
                    }

                    return child.call('bind', name);
                });

            var eventResults;

            nightmare = new Nightmare();
            yield nightmare.chain()
                .on('sample-event', function () {
                    eventResults = arguments;
                })
                .goto(fixture('simple'))
                .bind('sample-event')
                .evaluate(function () {
                    this.ipc.send('sample-event', 'sample', 3, {
                        sample: 'sample'
                    });
                });

            eventResults.length.should.equal(3);
            eventResults[0].should.equal('sample');
            eventResults[1].should.equal(3);
            eventResults[2].sample.should.equal('sample');
        });
    });

    describe('Nightmare.use', function () {
        let nightmare;
        beforeEach(function* () {
            nightmare = new Nightmare();
            yield nightmare.init();
        });

        afterEach(function* () {
            nightmare.end();
        });

        it('should support extending nightmare', function* () {
            let tagName = yield nightmare.chain()
                .goto(fixture('simple'))
                .use(select('h1'));

            tagName.should.equal('H1');

            function select(tagname) {
                return function* (nightmare) {
                    return yield this.evaluate(function (tagname) {
                        return document.querySelector(tagname).tagName;
                    }, tagname);
                };
            }
        });
    });

    describe('Nightmare.prototype', function () {
        let nightmare;
        beforeEach(function* () {
        });

        afterEach(function* () {
            nightmare.end();
        });

        it('should support custom behavior by simply extending the prototype', function* () {
            Nightmare.prototype.size = function (scale, offset) {
                return this.evaluate_now(function (scale, offset) {
                    var w = Math.max(document.documentElement.clientWidth, window.innerWidth || 0);
                    var h = Math.max(document.documentElement.clientHeight, window.innerHeight || 0);
                    return {
                        height: h,
                        width: w,
                        scaledHeight: h * scale + offset,
                        scaledWidth: w * scale + offset
                    };
                }, scale, offset);
            };

            var scaleFactor = 2.0;
            var offsetFactor = 1;

            nightmare = new Nightmare();
            var size = yield nightmare.chain()
                .goto(fixture('simple'))
                .size(scaleFactor, offsetFactor);

            size.height.should.be.a('number');
            size.width.should.be.a('number');
            size.scaledHeight.should.be.a('number');
            size.scaledWidth.should.be.a('number');
            size.scaledHeight.should.be.equal(size.height * scaleFactor + offsetFactor);
            size.scaledWidth.should.be.equal(size.width * scaleFactor + offsetFactor);
        });

        it('should support custom namespaces by simply extending the prototype', function* () {

            var backgroundCount = 0;
            var colorCount = 0;

            Nightmare.prototype.MyStyle = class {
                *background() {
                    backgroundCount++;
                    return yield this.evaluate_now(function () {
                        return window.getComputedStyle(document.body, null).backgroundColor;
                    });
                }
                *color() {
                    colorCount++;
                    return yield this.evaluate_now(function () {
                        return window.getComputedStyle(document.body, null).color;
                    });
                }
            };

            Nightmare.registerNamespace("MyStyle");

            nightmare = new Nightmare();
            var color = yield nightmare.chain()
                .goto(fixture('simple'))
                .MyStyle.background()
                .MyStyle.color();

            color.should.equal('rgb(0, 0, 0)');
            colorCount.should.equal(1);
            backgroundCount.should.equal(1);
        });
        
        it('should support namespaces added after nightmare object construction', function* () {

            let backgroundCount = 0;
            let colorCount = 0;
            
            nightmare = new Nightmare();
            yield nightmare.init();
                        
            Nightmare.prototype.MyStyle1 = class {
                *background() {
                    backgroundCount++;
                    return yield this.evaluate_now(function () {
                        return window.getComputedStyle(document.body, null).backgroundColor;
                    });
                }
                *color() {
                    colorCount++;
                    return yield this.evaluate_now(function () {
                        return window.getComputedStyle(document.body, null).color;
                    });
                }
            };
            
            Nightmare.registerNamespace("MyStyle1");
            
            yield nightmare.goto(fixture('simple'));
            let color = yield nightmare.MyStyle1.color();
            color.should.equal('rgb(0, 0, 0)');
            colorCount.should.equal(1);
            backgroundCount.should.equal(0);
        });

        it('should support custom namespaces by simply extending the prototype with deep this support', function* () {

            Nightmare.prototype.MyStyle2 = class {
                inner() {
                    return this.evaluate_now(function () {
                        return window.getComputedStyle(document.body, null).backgroundColor;
                    });
                }
                outer() {
                    return this.MyStyle2.inner();
                }
            };

            Nightmare.registerNamespace("MyStyle2");

            nightmare = new Nightmare();
            let color = yield nightmare.chain()
                .goto(fixture('simple'))
                .MyStyle2.outer();

            color.should.equal('rgba(0, 0, 0, 0)');
        });

        it('should support custom combinations of electron actions and nightmare actions by extending the prototype with arrays', function* () {

            Nightmare.prototype.getTitle = [
                function (ns, options, parent, win, renderer) {
                    parent.respondTo('getTitle', function (done) {
                        done.resolve(win.webContents.getTitle());
                    });
                },
                function () {
                    return this._invokeRunnerOperation("getTitle");
                }
            ];

            nightmare = new Nightmare();
            yield nightmare.init();
            yield nightmare.goto(fixture('simple'));
            let title = yield nightmare.getTitle();
            title.should.equal('Simple');
        });

        it('should support custom combinations of electron actions and nightmare actions by extending the prototype with arrays and be chainable', function* () {

            Nightmare.prototype.getTitle = [
                function (ns, options, parent, win, renderer) {
                    parent.respondTo('getTitle', function (done) {
                        done.resolve(win.webContents.getTitle());
                    });
                },
                function () {
                    return this._invokeRunnerOperation("getTitle");
                }
            ];

            nightmare = new Nightmare();
            let title = yield nightmare.chain()
                .goto(fixture('simple'))
                .getTitle();

            title.should.equal('Simple');
        });

        it('should support custom combinations of electron actions and nightmare actions within namespaces', function* () {

            Nightmare.prototype.MyTitle = (function () { });
            Nightmare.prototype.MyTitle.prototype.getTitle = [
                function (ns, options, parent, win, renderer) {
                    parent.respondTo('getTitle', function (done) {
                        done.resolve(win.webContents.getTitle());
                    });
                },
                function () {
                    return this._invokeRunnerOperation("getTitle");
                }
            ];

            Nightmare.registerNamespace("MyTitle");

            nightmare = new Nightmare();
            yield nightmare.init();
            yield nightmare.goto(fixture('simple'));
            let title = yield nightmare.MyTitle.getTitle();
            title.should.equal('Simple');
        });

        it('should support custom combinations of electron actions and nightmare actions within namespaces and be chainable', function* () {

            Nightmare.prototype.MyTitle = (function () { });
            Nightmare.prototype.MyTitle.prototype.getTitle = [
                function (ns, options, parent, win, renderer) {
                    parent.respondTo('getTitle', function (done) {
                        done.resolve(win.webContents.getTitle());
                    });
                },
                function () {
                    return this._invokeRunnerOperation("getTitle");
                }
            ];

            Nightmare.registerNamespace("Mytitle");

            nightmare = new Nightmare();
            var title = yield nightmare.chain()
                .goto(fixture('simple'))
                .MyTitle.getTitle();

            title.should.equal('Simple');
        });

        it('should fail if  a namespace is registered twice.', function* () {

            Nightmare.prototype.MyTitle = class {
                getTitle() {
                    return this.evaluate_now(function () {
                        return document.title;
                    });
                }
            };

            var thrown = false;
            try {
                Nightmare.action("Mytitle", {
                    getTitle: function () {
                        return this.evaluate_now(function () {
                            return document.title;
                        });
                    }
                });

                Nightmare.registerNamespace("Mytitle");
            }
            catch (ex) {
                thrown = true;
            }

            thrown.should.equal(true);
        });

        it('should support namespaces that do not want this binding', function* () {
            Nightmare.prototype.maths = class {
                constructor(nm) {
                    this._nightmare = nm;
                }
                get a() {
                    return this._a;
                }
                set a(value) {
                    this._a = value;
                }
                *getMeaningOfTitle() {
                    var title = yield this.getTitle();
                    return title + " " + (this.a + this.b);
                }
                getTitle() {
                    return this._nightmare.evaluate_now(function () {
                        return document.title;
                    });
                }
            };

            Nightmare.registerNamespace("maths", false);
            
            nightmare = new Nightmare();
            yield nightmare.init();

            nightmare.maths.a = 40;
            nightmare.maths.b = 2;

            yield nightmare.goto(fixture('simple'));
            var result = yield nightmare.maths.getMeaningOfTitle();
            result.should.equal("Simple 42");
            nightmare.maths._nightmare.should.equal(nightmare);
        });

        it('should support chaining namespaces that do not want this binding', function* () {
            Nightmare.prototype.moreMaths = class {
                constructor(nm) {
                    this._nightmare = nm;
                }
                *getMeaningOfTitle() {
                    var title = yield this.getTitle();
                    return title + " " + 42;
                }
                getTitle() {
                    return this._nightmare.evaluate_now(function () {
                        return document.title;
                    });
                }
            };

            Nightmare.registerNamespace("moreMaths", false);
            
            nightmare = new Nightmare();
            var result = yield nightmare.chain()
                .goto(fixture('simple'))
                .moreMaths.getMeaningOfTitle();
            result.should.equal("Simple 42");
        });
    });

});