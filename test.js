var bunyan = require('bunyan');
var _ = require('lodash');
var fs = require('fs');
var assert = require('assert');
var fx = require('mkdir-recursive');
var rmdir = require('rmdir');
var RotatingFileStream = require('./index');
var async = require('async');

function runTest(options, next) {
    var rfs = RotatingFileStream(_.extend({}, { path: 'foo.log' }, options.stream));

    var log = bunyan.createLogger({
        name: 'foo',
        streams: [{
            type: 'raw',
            stream: rfs
        }]
    });


    var i = 0;
    var batch = _.extend({}, { size: 8 }, options.batch);

    var ia = setInterval(function () {
        for (var j = 0; j < batch.size; j += 1) {
            log.info({node: 'a', i});
            i += 1;

            if (typeof (batch.iterations) !== 'undefined' && i >= batch.iterations) {
                clearInterval(ia);
                rfs.destroy();
                next();
                return;
            }
        }
    }, 0);

    if (typeof (batch.duration) !== 'undefined') {
        setTimeout(function ()
        {
            clearInterval(ia);
            rfs.destroy();
            next();
            return;
        }, batch.duration);
    }
}

function ignoreMissing(next) {
    return function (err) {
        if (!err || err.code === 'ENOENT') {
            next();
        } else {
            next(err);
        }
    }
}

function basicthreshold(next) {
    var name = 'testlogs/' + 'basicthreshold';

    async.series([
        function (next) { rmdir(name, ignoreMissing(next)); },
        function (next) { fx.mkdir(name, next); },
        function (next) { runTest ({
            stream: { path: name + '/test.log', threshold: '1m' },
            batch: { iterations: 100000 }
        }, next); },
        function (next) {
            var files = fs.readdirSync(name);
            assert.equal(13, files.length);
            console.log(name, 'passed');
            next();
        },
        function (next) { rmdir(name, next); }
    ], next);
}

function timerotation(next) {
    var name = 'testlogs/' + 'timerotation';

    async.series([
        function (next) { rmdir(name, ignoreMissing(next)); },
        function (next) { fx.mkdir(name, next); },
        function (next) { runTest ({
            stream: { path: name + '/test.log', period: '1000ms' },
            batch: { duration: 9500 }
        }, next); },
        function (next) {
            var files = fs.readdirSync(name);
            assert.equal(10, files.length);
            console.log(name, 'passed');
            next();
        },
        function (next) { rmdir(name, next); }
    ], next);
}

function gzippedfiles(next) {
    var name = 'testlogs/' + 'gzippedfiles';

    async.series([
        function (next) { rmdir(name, ignoreMissing(next)); },
        function (next) { fx.mkdir(name, next); },
        function (next) { runTest ({
            stream: { path: name + '/test.log', threshold: '1m', gzip: true },
            batch: { iterations: 100000 }
        }, next); },
        function (next) {
            var files = fs.readdirSync(name);
            assert.equal(13, files.length);
            assert.equal(12, _(files).filter( (f) => { return f.endsWith('.gz'); }).value().length);
            console.log(name, 'passed');
            next();
        },
        function (next) { rmdir(name, next); }
    ], next);
}

function totalsize(next) {
    var name = 'testlogs/' + 'totalsize';

    async.series([
        function (next) { rmdir(name, ignoreMissing(next)); },
        function (next) { fx.mkdir(name, next); },
        function (next) { runTest ({
            stream: { path: name + '/test.log', threshold: '1m', totalSize: '10m' },
            batch: { iterations: 100000 }
        }, next); },
        function (next) {
            var files = fs.readdirSync(name);
            assert.equal(10, files.length);
            console.log(name, 'passed');
            next();
        },
        function (next) { rmdir(name, next); }
    ], next);
}

function totalfiles(next) {
    var name = 'testlogs/' + 'totalfiles';

    async.series([
        function (next) { rmdir(name, ignoreMissing(next)); },
        function (next) { fx.mkdir(name, next); },
        function (next) { runTest ({
            stream: { path: name + '/test.log', threshold: '1m', totalFiles: 5 },
            batch: { iterations: 100000 }
        }, next); },
        function (next) {
            var files = fs.readdirSync(name);
            assert.equal(6, files.length);
            console.log(name, 'passed');
            next();
        },
        function (next) { rmdir(name, next); }
    ], next);
}


async.parallel([
    basicthreshold,
    timerotation,
    gzippedfiles,
    totalsize,
    totalfiles,
], function (err) {
    if (err) console.log(err);
});
