'use strict';

const minstache = require('minstache');

const execute = `;(function () {
  {{src}}
}());`;

exports.execute = minstache.compile(execute);
