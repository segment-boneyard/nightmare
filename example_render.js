var Nightmare = require('.');
nightmare = new Nightmare({
    show: false,
    frame: false
});
nightmare
    .goto('https://github.com')
    .viewport(1200, 800)
    .screenshot('png_default.png')
    .screenshot('png_clip.png', {
        x: 50,
        y: 50,
        width: 100,
        height: 100
    })
    .screenshot('jpeg_default.jpg')
    .screenshot('jpeg_compress.jpg', 5)
    .screenshot('jpeg_compress_clip.jpg', 5, {
        x: 50,
        y: 50,
        width: 100,
        height: 100
    })
    .run(function(err, nightmare) {
        console.log('and we are done!');
        // run() appropriately tears down the nightmare instance
    })
    .end();
