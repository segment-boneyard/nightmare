var Nightmare = require("./lib/index");

new Nightmare()
	.agent("firefox")
	.goto("https://www.google.com")
	.visible("#gs_sc0", function( exists){
		console.log( "vis? " + exists);
	})
	.run();