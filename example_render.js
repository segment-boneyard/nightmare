var Nightmare = require('.');

nightmare = new Nightmare({ show: false, frame:false });
// nightmare = new Nightmare();
   nightmare
   .goto('https://github.com')
   .viewport(1200,800)
   .toPng('png_default.png')
   .toJpeg('jpeg_default.jpg')
   .toJpeg('jpeg_compress.jpg',5)
   .toJpeg('jpeg_compress_clip.jpg',5,{
     x: 50,
     y: 50,
     width: 100,
     height: 100
   })
   //string object function
   .toJpeg('jpeg_clip_default.jpg',{
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
