"use strict";

require('mocha-generators').install();
const _ = require("lodash");

describe('Nightmare', function () {

    describe('Nightmare.promise', function () {
        var nightmare;

        beforeEach(function* () {
            nightmare = new Nightmare();
        });

        afterEach(function* () {
            nightmare.end();
        });

        it('should support getting a NightmarePromise that extends Promise and has Nightmare functions', function* () {

            let NightmarePromise = nightmare._initializeNightmarePromise();
            Promise.prototype.isPrototypeOf(NightmarePromise.prototype).should.be.true;
            expect(NightmarePromise.prototype.goto).to.be.a('function');

        });

        it('should support instantianting a NightmarePromise', function* () {

            let NightmarePromise = nightmare._initializeNightmarePromise();
            let promise = new NightmarePromise(function (resolve, reject) {
                resolve("foo");
            });

            var result = yield promise;
            result.should.equal("foo");
        });

        it('should support invoking Nightmare methods on a NightmarePromise', function* () {

            yield nightmare.init();

            let NightmarePromise = nightmare._initializeNightmarePromise();
            let promise = new NightmarePromise(function (resolve, reject) {
                resolve("foo");
            });

            var result = yield promise
                .goto(fixture('simple'));

            expect(result.code).to.equal(200);
        });

        it('should support queuing multiple methods on a NightmarePromise', function* () {

            yield nightmare.init();

            let NightmarePromise = nightmare._initializeNightmarePromise();
            let promise = new NightmarePromise(function (resolve, reject) {
                resolve("foo");
            });

            var result = yield promise
                .goto(fixture('simple'))
                .title();

            expect(result).to.equal("Simple");
        });

        it('should contain the then function', function* () {

            yield nightmare.init();

            let NightmarePromise = nightmare._initializeNightmarePromise();
            let promise = new NightmarePromise(function (resolve, reject) {
                resolve("foo");
            });

            var result = yield promise
                .goto(fixture('simple'))
                .title()
                .then(function (value) {
                    return `${value} 42`;
                });

            expect(result).to.equal("Simple 42");
        });

        it('should support continuing after the then function', function* () {

            yield nightmare.init();

            let NightmarePromise = nightmare._initializeNightmarePromise();
            let promise = new NightmarePromise(function (resolve, reject) {
                resolve("foo");
            });

            var result = yield promise
                .goto(fixture('simple'))
                .title()
                .then(function (value) {
                    expect(value).to.equal("Simple");
                })
                .goto(fixture("navigation"))
                .title();

            expect(result).to.equal("Navigation");
        });

        it('should contain the catch function', function* () {

            yield nightmare.init();

            let NightmarePromise = nightmare._initializeNightmarePromise();
            let promise = new NightmarePromise(function (resolve, reject) {
                throw "foo!!";
            });

            var caught = false;
            var result = yield promise
                .catch(function (err) {
                    caught = true;
                    return "nifty";
                });

            expect(caught).to.equal(true);
            expect(result).to.equal("nifty");
        });
        
        it('should support continuing after a catch function', function* () {

            yield nightmare.init();

            let NightmarePromise = nightmare._initializeNightmarePromise();
            let promise = new NightmarePromise(function (resolve, reject) {
                throw "foo!!";
            });

            var caught = false;
            var result = yield promise
                .catch(function (err) {
                    caught = true;
                })
                .goto(fixture("simple"))
                .title();

            expect(caught).to.equal(true);
            expect(result).to.equal("Simple");
        });
        
        it('should be provided via a nightmarePromise getter', function* () {

            yield nightmare.init();

            let NightmarePromise = nightmare.nightmarePromise;
            Promise.prototype.isPrototypeOf(NightmarePromise.prototype).should.be.true;
        });
        
        it('should be unique per instance', function* () {

            yield nightmare.init();

            let NightmarePromise1 = nightmare.nightmarePromise;
            let NightmarePromise2 = nightmare.nightmarePromise;

            expect(NightmarePromise1).to.not.equal(NightmarePromise2);
        });
        
        it('should contain all prototype functions without init()', function* () {

            let NightmarePromise = nightmare.nightmarePromise;
            
            let nightmarePropertyNames = Object.getOwnPropertyNames(Object.getPrototypeOf(nightmare));
            let promisePropertyNames = Object.getOwnPropertyNames(NightmarePromise.prototype);
            
            let diff = _.difference(nightmarePropertyNames, promisePropertyNames);
            _.remove(diff, function(key) {
                return key.startsWith("_");
            });
            
            diff = _.without(diff, "engineVersions", "nightmarePromise", "chain" );            
            expect(diff.length).to.equal(0);
        });
        
        it('should contain all defined namespaces without init()', function* () {

            let NightmarePromise = nightmare.nightmarePromise;
            let namespaces = _.map(Nightmare._namespaces, 'name');
            
             let promisePropertyNames = Object.getOwnPropertyNames(NightmarePromise.prototype);
             let result = _.intersection(namespaces, promisePropertyNames);
             
            expect(result.length).to.equal(namespaces.length);
        });
    });
});