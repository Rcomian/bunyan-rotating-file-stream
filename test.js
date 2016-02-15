var bunyan = require('bunyan');
var RotatingFileStream = require('./index');

var log = bunyan.createLogger({
    name: 'foo',
    streams: [{
        type: 'raw',
        stream: RotatingFileStream({
            path: 'foo.log',
            period: '1h',
            threshold: '1m',
            totalFiles: 2000,
            totalSize: '10m',
            gzip: true
        })
    }]
});


var i = 0;
var imax = 100000;
var batchsize = 8;

var ia = setInterval(function () {

    for (var j = 0; j < batchsize; j += 1) {
        log.info({node: 'a', i});
        i += 1;

        if (i >= imax) {
            clearInterval(ia);
            return;
        }
    }

}, 0);
