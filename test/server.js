
/**
 * Module dependencies.
 */

var auth = require('basic-auth');
var basicAuth = require('basic-auth-connect');
var express = require('express');
var multer = require('multer');
var path = require('path');
var serve = require('serve-static');
var cookieParser = require('cookie-parser');

/**
 * Locals.
 */

var app = module.exports = express();

/**
 * Accept file uploads.
 */

app.use(multer({ inMemory: true }));

/**
 * Parse cookies.
 */

app.use(cookieParser());

/**
 * Echo uploaded files for testing assertions.
 */

app.post('/upload', function (req, res) {
  res.send(req.files);
});

/**
 * Echo HTTP Basic Auth for testing assertions.
 */

app.get('/auth', basicAuth('my', 'auth'), function (req, res) {
  res.send(auth(req));
});

/**
 * Echo HTTP Headers for testing assertions.
 */

app.get('/headers', function (req, res) {
  res.send(req.headers);
});

/**
 * Serve the fixtures directory as static files.
 */

app.use(serve(path.resolve(__dirname, 'fixtures')));

/**
 * Serve the test files so they can be accessed via HTML as well.
 */

app.use('/files', serve(path.resolve(__dirname, 'files')));

/**
 * Set cookie for testing assertions.
 */

app.get('/cookie', function (req, res) {
  res.cookie('test', '', { expires: new Date(Date.now() + 900000), httpOnly: true });
  res.end();
});

/**
 * Echo cookies for testing assertions.
 */

app.get('/cookies', function (req, res) {
  res.json(req.cookies);
});

/**
 * Start if not required.
 */

if (!module.parent) app.listen(7500);
