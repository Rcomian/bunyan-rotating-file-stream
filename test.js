var bunyan = require('bunyan');
var _ = require('lodash');
var fs = require('fs');
var assert = require('assert');
var fx = require('mkdir-recursive');
var rmdir = require('rmdir');
var RotatingFileStream = require('./index');
var async = require('async');
var InitialPeriodRotateTrigger = require('./lib/initialperiodtrigger');
var setLongTimeout = require('./lib/setlongtimeout');

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
            type: 'raw',
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
            stream: { path: name + '/test.log', threshold: '1m', fieldOrder: ['pid', 'time'] },
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

function toosmallthresholdstillgetswrites(next) {
    var name = 'testlogs/' + 'toosmallthresholdstillgetswrites';

    async.series([
        function (next) { rmdir(name, ignoreMissing(next)); },
        function (next) { fx.mkdir(name, next); },
        function (next) { runTest (name, {
            stream: { path: name + '/test.log', threshold: 1, totalFiles: 502 },
            batch: { iterations: 500 }
        }, next); },
        function (next) {
            var files = fs.readdirSync(name);
            assert.equal(501, files.length);
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

function timerotationnologging(next) {
    var name = 'testlogs/' + 'timerotationnologging';

    async.series([
        function (next) { rmdir(name, ignoreMissing(next)); },
        function (next) { fx.mkdir(name, next); },
        function (next) { runTest (name, {
            stream: { path: name + '/test.log', period: '1000ms' },
            batch: { size: 0, duration: 9500 }
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
            assert.equal(11, files.length);
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

function multiplerotatorsonsamefile(next) {
    var name = 'testlogs/' + 'multiplerotatorsonsamefile';

    async.series([
        function (next) { rmdir(name, ignoreMissing(next)); },
        function (next) { fx.mkdir(name, next); },
        function (next) {
            runTest (name, {
                stream: { path: name + '/test.log', period: '1000ms', shared: true },
                batch: { duration: 9500 }
            }, next);

            // Setup the second rotator
            RotatingFileStream({ path: name + '/test.log', period: '1000ms', shared: true });
        },
        function (next) {
            var files = fs.readdirSync(name);
            assert.equal(10, files.length);
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

function checksetlongtimeout(next) {
    var name = 'testlogs/' + 'checksetlongtimeout';

    var d = new Date();
    d.setSeconds(d.getSeconds() + 10);

    var calls = 0;
    var longtimeout = setLongTimeout(d.getTime(), true, function () {
        clearTimeout(catchall);
        calls += 1;

        if (calls > 1) {
            console.log('Called multiple times when expecting one!', calls);
        } else {
            console.log(name, 'passed');
            next();
        }
    }, 100);

    var catchall = setTimeout(function () {
        console.log(name, 'FAILED: Timer did not fire');
        next('FAILED: Timer did not fire');
        if (longtimeout) {
            longtimeout.clear();
        }
    }, 15000);
}

function checksetlongtimeoutclear(next) {
    var name = 'testlogs/' + 'checksetlongtimeoutclear';

    var d = new Date();
    d.setSeconds(d.getSeconds() + 10);

    var calls = 0;
    var longtimeout = setLongTimeout(d.getTime(), true, function () {
        calls += 1;
    }, 100);

    setTimeout(function () {
        longtimeout.clear();
    }, 5000);

    setTimeout(function () {
        if (calls === 0) {
            console.log(name, 'passed');
            next();
        } else {
            console.log(name, 'FAILED: Timer fired even when it was cleared');
        }
    }, 11000);
}

function checksetlongtimeoutclearnormalperiods(next) {
    var name = 'testlogs/' + 'checksetlongtimeoutclearnormalperiods';

    var d = new Date();
    d.setSeconds(d.getSeconds() + 10);

    var calls = 0;
    var longtimeout = setLongTimeout(d.getTime(), true, function () {
        calls += 1;
    });

    setTimeout(function () {
        longtimeout.clear();
    }, 5000);

    setTimeout(function () {
        if (calls === 0) {
            next();
            console.log(name, 'passed');
        } else {
            console.log(name, 'FAILED: Timer fired even when it was cleared');
        }
    }, 11000);
}

async.parallel([
    basicthreshold,
    timerotation,
    timerotationnologging,
    gzippedfiles,
    totalsize,
    totalfiles,
    shorthandperiod,
    checkrotationofoldfile,
    checkrotationofnewfile,
    checksetlongtimeout,
    checksetlongtimeoutclear,
    checksetlongtimeoutclearnormalperiods,
    multiplerotatorsonsamefile,
    toosmallthresholdstillgetswrites
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
