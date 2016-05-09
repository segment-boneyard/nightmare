"use strict";

require('mocha-generators').install();

describe('Nightmare', function () {

    describe('cookies', function () {
        let nightmare;

        beforeEach(function* () {
            nightmare = new Nightmare({
                webPreferences: { partition: 'test-partition' }
            });

            yield nightmare.chain().goto(fixture('cookie'));
        });

        afterEach(function* () {
            nightmare.end();
        });

        it('.set(name, value) & .get(name)', function* () {
            var cookies = nightmare.cookies;

            yield cookies.set('hi', 'hello');
            var cookie = yield cookies.get('hi');

            cookie.name.should.equal('hi');
            cookie.value.should.equal('hello');
            cookie.path.should.equal('/');
            cookie.secure.should.equal(false);
        });

        it('.set(obj) & .get(name)', function* () {
            var cookies = nightmare.cookies;

            yield cookies.set({
                name: 'nightmare',
                value: 'rocks',
                path: '/cookie'
            });
            var cookie = yield cookies.get('nightmare');

            cookie.name.should.equal('nightmare');
            cookie.value.should.equal('rocks');
            cookie.path.should.equal('/cookie');
            cookie.secure.should.equal(false);
        });

        it('.set([cookie1, cookie2]) & .get()', function* () {
            var cookies = nightmare.cookies;
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
            ]);

            var cookies = yield cookies.get();
            cookies.length.should.equal(2);

            // sort in case they come in a different order
            cookies = cookies.sort(function (a, b) {
                if (a.name > b.name) return 1;
                if (a.name < b.name) return -1;
                return 0;
            });

            cookies[0].name.should.equal('hi');
            cookies[0].value.should.equal('hello');
            cookies[0].path.should.equal('/');
            cookies[0].secure.should.equal(false);

            cookies[1].name.should.equal('nightmare');
            cookies[1].value.should.equal('rocks');
            cookies[1].path.should.equal('/cookie');
            cookies[1].secure.should.equal(false);
        });

        it('.set([cookie1, cookie2]) & .get(query)', function* () {
            var cookies = nightmare.cookies;

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
            ]);

            var cookies = yield cookies.get({ path: '/cookie' });
            cookies.length.should.equal(1);

            cookies[0].name.should.equal('nightmare');
            cookies[0].value.should.equal('rocks');
            cookies[0].path.should.equal('/cookie');
            cookies[0].secure.should.equal(false);
        });

        it('.set([cookie]) & .clear(name) & .get(query)', function* () {
            var cookies = nightmare.cookies;

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
            ]);

            yield cookies.clear('nightmare');

            var cookies = yield cookies.get({ path: '/cookie' });

            cookies.length.should.equal(0);
        });
    });

});