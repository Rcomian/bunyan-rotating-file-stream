var bunyan = require('bunyan');
var _ = require('lodash');
var fs = require('fs');
var assert = require('assert');
var fx = require('mkdir-recursive');
var rmdir = require('rmdir');
var RotatingFileStream = require('./index');
var async = require('async');
var InitialPeriodRotateTrigger = require('./lib/initialperiodtrigger');
var whyRunning;

try {
    var whyRunning = require('why-is-node-running');
} catch (e) {
    console.log('"Why is node running" disabled');
}

function runTest(name, options, next) {
    var rfs = RotatingFileStream(_.extend({}, { path: 'foo.log' }, options.stream));

    var log = bunyan.createLogger({
        name: 'foo',
        streams: [{
            stream: rfs
        }]
    });

    rfs.on('losingdata', function () {
        if (ia) clearInterval(ia);
        if (maintimer) clearTimeout(maintimer);

        next('Losing data - abandon test: ' + name);
    });

    var i = 0;
    var batch = _.extend({}, { size: 10 }, options.batch);

    var ia = setInterval(function () {
        for (var j = 0; j < batch.size; j += 1) {
            log.info({node: 'a', i});
            i += 1;

            if (typeof (batch.iterations) !== 'undefined' && i >= batch.iterations) {
                clearInterval(ia);
                ia = null;
                rfs.join(function () {
                    rfs.destroy();
                    next();
                });
                return;
            }
        }
    }, 0);

    var maintimer = null;

    if (typeof (batch.duration) !== 'undefined') {
        maintimer = setTimeout(function ()
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
        function (next) { runTest (name, {
            stream: { path: name + '/test.log', threshold: '1m' },
            batch: { iterations: 100000 }
        }, next); },
        function (next) {
            var files = fs.readdirSync(name);
            assert.equal(13, files.length);
            console.log(name, 'passed');
            next();
        },
        function (next) { rmdir(name, ignoreMissing(next)); }
    ], next);
}

function timerotation(next) {
    var name = 'testlogs/' + 'timerotation';

    async.series([
        function (next) { rmdir(name, ignoreMissing(next)); },
        function (next) { fx.mkdir(name, next); },
        function (next) { runTest (name, {
            stream: { path: name + '/test.log', period: '1000ms' },
            batch: { duration: 9500 }
        }, next); },
        function (next) {
            var files = fs.readdirSync(name);
            assert.equal(10, files.length);
            console.log(name, 'passed');
            next();
        },
        function (next) { rmdir(name, ignoreMissing(next)); }
    ], next);
}

function gzippedfiles(next) {
    var name = 'testlogs/' + 'gzippedfiles';

    async.series([
        function (next) { rmdir(name, ignoreMissing(next)); },
        function (next) { fx.mkdir(name, next); },
        function (next) { runTest (name, {
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
        function (next) { rmdir(name, ignoreMissing(next)); }
    ], next);
}

function totalsize(next) {
    var name = 'testlogs/' + 'totalsize';

    async.series([
        function (next) { rmdir(name, ignoreMissing(next)); },
        function (next) { fx.mkdir(name, next); },
        function (next) { runTest (name, {
            stream: { path: name + '/test.log', threshold: '1m', totalSize: '10m' },
            batch: { iterations: 100000 }
        }, next); },
        function (next) {
            var files = fs.readdirSync(name);
            assert.equal(10, files.length);
            console.log(name, 'passed');
            next();
        },
        function (next) { rmdir(name, ignoreMissing(next)); }
    ], next);
}

function totalfiles(next) {
    var name = 'testlogs/' + 'totalfiles';

    async.series([
        function (next) { rmdir(name, ignoreMissing(next)); },
        function (next) { fx.mkdir(name, next); },
        function (next) { runTest (name, {
            stream: { path: name + '/test.log', threshold: '1m', totalFiles: 5 },
            batch: { iterations: 100000 }
        }, next); },
        function (next) {
            var files = fs.readdirSync(name);
            assert.equal(6, files.length);
            console.log(name, 'passed');
            next();
        },
        function (next) { rmdir(name, ignoreMissing(next)); }
    ], next);
}

function shorthandperiod(next) {
    var name = 'testlogs/' + 'shorthandperiod';

    async.series([
        function (next) { rmdir(name, ignoreMissing(next)); },
        function (next) { fx.mkdir(name, next); },
        function (next) { runTest (name, {
            stream: { path: name + '/test.log', period: 'hourly'},
            batch: { iterations: 100 }
        }, next); },
        function (next) {
            var files = fs.readdirSync(name);
            assert.equal(1, files.length);
            console.log(name, 'passed');
            next();
        },
        function (next) { rmdir(name, ignoreMissing(next)); }
    ], next);
}

function checkrotationofoldfile(next) {
    var name = 'testlogs/' + 'checkrotationofoldfile';

    var periodtrigger = InitialPeriodRotateTrigger({ period: '1h' });

    var rotations = 0;
    periodtrigger.on('rotate', function () {
        rotations += 1;
    });

    periodtrigger.checkIfRotationNeeded(Date.now() - (10000 * 60 * 60 * 3));

    setTimeout(function () {
        assert.equal(1, rotations);
        console.log(name, 'passed');
        next();
    }, 1000);
}

function checkrotationofnewfile(next) {
    var name = 'testlogs/' + 'checkrotationofnewfile';

    var periodtrigger = InitialPeriodRotateTrigger({ period: '1h' });

    var rotations = 0;
    periodtrigger.on('rotate', function () {
        rotations += 1;
    });

    periodtrigger.checkIfRotationNeeded(Date.now() - (3));

    setTimeout(function () {
        assert.equal(0, rotations);
        console.log(name, 'passed');
        next();
    }, 1000);
}

async.parallel([
    basicthreshold,
    timerotation,
    gzippedfiles,
    totalsize,
    totalfiles,
    shorthandperiod,
    checkrotationofoldfile,
    checkrotationofnewfile
], function (err) {
    if (err) console.log(err);

    clearTimeout(totalTimeout);
});

var totalTimeout = setTimeout(function () {
    console.log('Still running: ');
    if (whyRunning) {
        whyRunning();
    }
}, 20000);
