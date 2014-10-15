var Nightmare = require("./lib/index");

var selector="#gs_st0"

new Nightmare()
	.goto("http://www.wikipedia.org")
	.visible("input[type='hidden']",function (visible) {
		console.log(visible);
	})
	.visible("#searchInput",function (visible) {
		console.log(visible);
	})
	.run();