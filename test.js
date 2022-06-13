var bunyan = require('bunyan');
var RotatingFileStream = require('./index');
var _ = require('lodash');

options = { stream: { path: 'testlogs/bar-%y-%m-%d-%H-%M-%S-%N.log', totalFiles: 10, threshold: '1m', fieldOrder: ['pid', 'time'] } }

var rfs = RotatingFileStream(_.extend({}, { path: 'foo.log' }, options.stream));

var log = bunyan.createLogger({
    name: 'foo',
    level: 'info',
    streams: [{
        type: 'raw',
        stream: rfs
    }]
});

var infotimer = null

rfs.on('error', function (err) {
  if (infotimer) clearTimeout(infotimer);
  console.log('err', err, name);
  process.exit(1)
});

rfs.on('losingdata', function () {
  if (infotimer) clearTimeout(infotimer);
  console.log('Losing data - abandon test: ' + name);
  process.exit(1)
});

var i = 0
var offset = 1

function infohandler() {
    log.info({node: 'a', i: i + offset}, `${Math.random().toString().slice(2)}`);
    i += offset
    if (i+offset == i) { offset++ }
    infotimer = setTimeout(infohandler, 100 + (Math.random() * 100))
}  

setTimeout(infohandler, 0)

function debughandler() {
  log.debug({node: 'a', i: i + offset});
  i += offset
  setTimeout(debughandler, 10 + (Math.random() * 10)).unref()
}  

setTimeout(debughandler, 0)

function tracehandler() {
  log.trace({node: 'a', i: i + offset});
  i += offset
  setTimeout(tracehandler, 0 + (Math.random() * 1)).unref()
}  

setTimeout(tracehandler, 0)


function warnhandler() {
  log.warn({node: 'a', i: i + offset});
  i += offset
  setTimeout(warnhandler, 1000 + (Math.random() * 1000)).unref()
}  

setTimeout(warnhandler, 0)

function errorhandler() {
  log.error({node: 'a', i: i + offset});
  i += offset
  setTimeout(errorhandler, 10000 + (Math.random() * 10000)).unref()
}  

setTimeout(errorhandler, 0)
