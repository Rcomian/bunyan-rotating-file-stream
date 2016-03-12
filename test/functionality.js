var bunyan = require('bunyan');
var _ = require('lodash');
var fs = require('fs');
var path = require('path');
var readline = require('readline');
var assert = require('assert');
var mkdirp = require('mkdirp');
var rmdir = require('rmdir');
var RotatingFileStream = require('../index');
var async = require('async');
var InitialPeriodRotateTrigger = require('../lib/initialperiodtrigger');
var zlib = require('zlib');
var setLongTimeout = require('../lib/setlongtimeout');
var semver = require('semver');

var whyRunning;

try {
    var whyRunning = require('why-is-node-running');
} catch (e) {
    console.log('"Why is node running" disabled');
}

function fixpid(log) {
    log.hostname = 'test01';
    log.pid = 1;
    return log;
}

// Prior to node v4, high load scenarios (like these tests) can starve timer events
var logdelay = semver.lt(process.version, '4.0.0') ? 20 : 0;

function runTest(name, options, next) {
    var rfs = RotatingFileStream(_.extend({}, { path: 'foo.log', map: fixpid }, options.stream));

    var log = bunyan.createLogger({
        name: 'foo',
        streams: [{
            type: 'raw',
            stream: rfs
        }]
    });

    rfs.on('error', function (err) {
        console.log('err', err);
        throw err;
    });

    rfs.on('losingdata', function () {
        if (ia) clearInterval(ia);
        if (maintimer) clearTimeout(maintimer);

        next('Losing data - abandon test: ' + name);
    });

    var i = 1;
    var batch = _.extend({}, { size: 10 }, options.batch);

    var ia = setInterval(function () {
        for (var j = 0; j < batch.size; j += 1) {
            log.info({node: 'a', i: i});
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
    }, logdelay);

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

function checkFileConsistency(directory, opts, next) {

    if (typeof (opts) === 'function') {
        next = opts;
        opts = {};
    }

    fs.readdir(directory, function (err, files) {
        async.sortBy(files, function (file, callback) {
            fs.stat(path.join(directory, file), function (err, stats) {
                callback(err, stats.mtime);
            });
        }, function (err, results){
            var nextExpectedId = opts.first || null;

            async.forEachSeries(results, function (file, next) {
                var fullpath = path.join(directory, file);

                var parsed = path.parse(fullpath);

                var inputStream = fs.createReadStream(fullpath);
                if (parsed.ext === '.gz') {
                    var gz = inputStream.pipe(zlib.createGunzip());
                } else {
                    var ext = parsed.ext.slice(1);
                    if (!isNaN(parseInt(ext))) {
                        ext = parsed.name.split('.').slice(-1)[0];
                    }

                    assert.equal('log', ext, 'incorrect file extension for file: ' + ext + '|' + fullpath);
                }

                const rl = readline.createInterface({
                    input: gz || inputStream
                });

                rl.on('line', function (line) {
                    var log = JSON.parse(line);
                    if (nextExpectedId === null) {
                        nextExpectedId = log.i + 1;
                    } else {
                        assert.equal(nextExpectedId, log.i, fullpath + ' - expected: ' + nextExpectedId + ', got: ' + log.i);
                        nextExpectedId += 1;
                    }
                });

                rl.once('close', function () {
                    next();
                });
            }, function done(err) {

                if (opts.last) {
                    assert.equal(opts.last, nextExpectedId, 'last expected: ' + opts.last + ', got: ' + nextExpectedId);
                }

                next(err);
            });
        });
    });
}

function ignoreMissing(next) {
    return function (err) {
        if (!err || err.code === 'ENOENT' || err.code === 'EEXIST') {
            next();
        } else {
            next(err);
        }
    }
}

function basicthreshold(template) {
    return function (next) {
        var name = 'testlogs/' + 'basicthreshold-' + template;

        async.series([
            function (next) { rmdir(name, ignoreMissing(next)); },
            function (next) { mkdirp(name, next); },
            function (next) { runTest (name, {
                stream: { path: name + '/' + template + '.log', threshold: '1m', fieldOrder: ['pid', 'time'] },
                batch: { iterations: 50000 }
            }, next); },
            function (next) {
                checkFileConsistency(name, {first: 1, last: 50000}, next);
            },
            function (next) {
                var files = fs.readdirSync(name);
                assert.equal(6, files.length);
                console.log(name.replace('%d', '%%d'), 'passed');
                next();
            },
            function (next) { rmdir(name, ignoreMissing(next)); }
        ], next);
    }
}

function forcenewfile(template, forcenew) {
    return function (next) {
        var name = 'testlogs/' + 'forcenewfile-' + template + (forcenew ? '-newfile' : '-reused');

        async.series([
            function (next) { rmdir(name, ignoreMissing(next)); },
            function (next) { mkdirp(name, next); },
            function (next) { runTest (name, {
                stream: { path: name + '/' + template + '.log', startNewFile: forcenew, threshold: 800 },
                batch: { iterations: 10 }
            }, next); },
            function (next) {
                checkFileConsistency(name, {first: 1, last: 10}, next);
            },
            function (next) {
                setTimeout(next, 2000);
            },
            function (next) { runTest (name, {
                stream: { path: name + '/' + template + '.log', startNewFile: forcenew, threshold: 800 },
                batch: { iterations: 1 }
            }, next); },
            function (next) {
                var files = fs.readdirSync(name);
                var expectedfiles = forcenew ? 3 : 2
                assert.equal(expectedfiles, files.length, 'Wrong number of files for ' + name.replace('%d', '%%d') + ' expected: ' + expectedfiles + ' got: ' + JSON.stringify(files));
                console.log(name.replace('%d', '%%d'), 'passed');
                next();
            },
            function (next) { rmdir(name, ignoreMissing(next)); }
        ], next);
    }
}

function toosmallthresholdstillgetswrites(template) {
    return function (next) {
        var name = 'testlogs/' + 'toosmallthresholdstillgetswrites-' + template;

        async.series([
            function (next) { rmdir(name, ignoreMissing(next)); },
            function (next) { mkdirp(name, next); },
            function (next) { runTest (name, {
                stream: { path: name + '/' + template + '.log', threshold: 1, totalFiles: 502 },
                batch: { iterations: 100 }
            }, next); },
            function (next) {
                checkFileConsistency(name, {first: 1, last: 100}, next);
            },
            function (next) {
                var files = fs.readdirSync(name);
                assert.equal(99, files.length);
                console.log(name.replace('%d', '%%d'), 'passed');
                next();
            },
            function (next) { rmdir(name, ignoreMissing(next)); }
        ], next);
    }
}

function timerotation(template) {
    return function (next) {
        var name = 'testlogs/' + 'timerotation-' + template;

        async.series([
            function (next) { rmdir(name, ignoreMissing(next)); },
            function (next) { mkdirp(name, next); },
            function (next) { runTest (name, {
                stream: { path: name + '/' + template + '.log', period: '1000ms' },
                batch: { duration: 9500 }
            }, next); },
            function (next) {
                checkFileConsistency(name, {first: 1}, next);
            },
            function (next) {
                var files = fs.readdirSync(name);
                assert.equal(10, files.length);
                console.log(name.replace('%d', '%%d'), 'passed');
                next();
            },
            function (next) { rmdir(name, ignoreMissing(next)); }
        ], next);
    }
}

function timerotationnologging(template) {
    return function (next) {
        var name = 'testlogs/' + 'timerotationnologging-' + template;

        async.series([
            function (next) { rmdir(name, ignoreMissing(next)); },
            function (next) { mkdirp(name, next); },
            function (next) { runTest (name, {
                stream: { path: name + '/' + template + '.log', period: '1000ms' },
                batch: { size: 0, duration: 9500 }
            }, next); },
            function (next) {
                checkFileConsistency(name, next);
            },
            function (next) {
                var files = fs.readdirSync(name);
                assert.equal(10, files.length);
                console.log(name.replace('%d', '%%d'), 'passed');
                next();
            },
            function (next) { rmdir(name, ignoreMissing(next)); }
        ], next);
    }
}

function gzippedfiles(template) {
    return function (next) {
        var name = 'testlogs/' + 'gzippedfiles-' + template;

        async.series([
            function (next) { rmdir(name, ignoreMissing(next)); },
            function (next) { mkdirp(name, next); },
            function (next) { runTest (name, {
                stream: { path: name + '/' + template + '.log', threshold: '1m', gzip: true },
                batch: { iterations: 50000 }
            }, next); },
            function (next) {
                checkFileConsistency(name, {first: 1, last: 50000}, next);
            },
            function (next) {
                var files = fs.readdirSync(name);
                assert.equal(6, files.length);
                assert.equal(5, _(files).filter( function (f) { return f.slice(-3) === '.gz'; }).value().length);
                console.log(name.replace('%d', '%%d'), 'passed');
                next();
            },
            function (next) { rmdir(name, ignoreMissing(next)); }
        ], next);
    }
}

function totalsize(template) {
    return function (next) {
        var name = 'testlogs/' + 'totalsize-' + template;

        async.series([
            function (next) { rmdir(name, ignoreMissing(next)); },
            function (next) { mkdirp(name, next); },
            function (next) { runTest (name, {
                stream: { path: name + '/' + template + '.log', threshold: '1m', totalSize: '3m' },
                batch: { iterations: 50000 }
            }, next); },
            function (next) {
                checkFileConsistency(name, {first: 17003, last: 50000}, next);
            },
            function (next) {
                var files = fs.readdirSync(name);
                assert.equal(4, files.length);
                console.log(name.replace('%d', '%%d'), 'passed');
                next();
            },
            function (next) { rmdir(name, ignoreMissing(next)); }
        ], next);
    }
}

function totalfiles(template) {
    return function (next) {
        var name = 'testlogs/' + 'totalfiles-' + template;

        async.series([
            function (next) { rmdir(name, ignoreMissing(next)); },
            function (next) { mkdirp(name, next); },
            function (next) { runTest (name, {
                stream: { path: name + '/' + template + '.log', threshold: '1m', totalFiles: 3 },
                batch: { iterations: 50000 }
            }, next); },
            function (next) {
                checkFileConsistency(name, {first: 17003, last: 50000}, next);
            },
            function (next) {
                var files = fs.readdirSync(name);
                assert.equal(4, files.length);
                console.log(name.replace('%d', '%%d'), 'passed');
                next();
            },
            function (next) { rmdir(name, ignoreMissing(next)); }
        ], next);
    }
}

function shorthandperiod(template) {
    return function (next) {
        var name = 'testlogs/' + 'shorthandperiod-' + template;

        async.series([
            function (next) { rmdir(name, ignoreMissing(next)); },
            function (next) { mkdirp(name, next); },
            function (next) { runTest (name, {
                stream: { path: name + '/' + template + '.log', period: 'hourly'},
                batch: { iterations: 100 }
            }, next); },
            function (next) {
                checkFileConsistency(name, {first: 1, last: 100}, next);
            },
            function (next) {
                var files = fs.readdirSync(name);
                assert.equal(1, files.length);
                console.log(name.replace('%d', '%%d'), 'passed');
                next();
            },
            function (next) { rmdir(name, ignoreMissing(next)); }
        ], next);
    }
}

function multiplerotatorsonsamefile(template) {
    return function (next) {
        var name = 'testlogs/' + 'multiplerotatorsonsamefile-' + template;

        async.series([
            function (next) { rmdir(name, ignoreMissing(next)); },
            function (next) { mkdirp(name, next); },
            function (next) {
                runTest (name, {
                    stream: { path: name + '/' + template + '.log', period: '1000ms', shared: true },
                    batch: { duration: 9500 }
                }, next);

                // Setup the second rotator
                RotatingFileStream({ path: name + '/' + template + '.log', period: '1000ms', shared: true });
            },
            function (next) {
                checkFileConsistency(name, {first: 1}, next);
            },
            function (next) {
                var files = fs.readdirSync(name);
                assert.equal(10, files.length);
                console.log(name.replace('%d', '%%d'), 'passed');
                next();
            },
            function (next) { rmdir(name, ignoreMissing(next)); }
        ], next);
    }
}

function checkrotationofoldfile(next) {
    var name = 'testlogs/' + 'checkrotationofoldfile';

    var periodtrigger = InitialPeriodRotateTrigger({ period: '1h' });

    var now = Date.parse('2016-02-14 15:06');
    var oldfiletime = Date.parse('2016-02-14 10:45')

    var result = periodtrigger.checkIfRotationNeeded(oldfiletime, now);

    assert.equal(true, result.needsRotation);
    assert.equal(Date.parse('2016-02-14 14:45'), result.rotateTo);
    console.log(name, 'passed');
    next();
}

function checkrotationofnewfile(next) {
    var name = 'testlogs/' + 'checkrotationofnewfile';

    var periodtrigger = InitialPeriodRotateTrigger({ period: '1h' });

    var now = Date.parse('2016-02-14 15:06');
    var oldfiletime = Date.parse('2016-02-14 15:04')

    var result = periodtrigger.checkIfRotationNeeded(oldfiletime, now);

    assert.equal(false, result.needsRotation);
    console.log(name, 'passed');
    next();
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

mkdirp('testlogs', function () {

    async.parallel([
        basicthreshold('test'),
        basicthreshold('test-%N'),
        basicthreshold('test-%Y-%m-%d'),
        basicthreshold('test-%Y-%m-%d-%H-%M-%S'),
        basicthreshold('test-%N-%Y-%m-%d'),
        forcenewfile('test', true),
        forcenewfile('test-%N', true),
        forcenewfile('test', false),
        forcenewfile('test-%N', false),
        forcenewfile('test-%Y-%m-%d', true),
        forcenewfile('test-%Y-%m-%d-%H-%M-%S', true),
        forcenewfile('test-%Y-%m-%d', false),
        forcenewfile('test-%Y-%m-%d-%H-%M-%S', false),
        forcenewfile('test-%N-%Y-%m-%d', false),
        timerotation('test'),
        timerotation('test-%N'),
        timerotation('test-%Y-%m-%d'),
        timerotation('test-%Y-%m-%d-%H-%M-%S'),
        timerotation('test-%N-%Y-%m-%d-%H-%M-%S'),
        timerotationnologging('test'),
        timerotationnologging('test-%N'),
        timerotationnologging('test-%Y-%m-%d'),
        timerotationnologging('test-%Y-%m-%d-%H-%M-%S'),
        timerotationnologging('test-%N-%Y-%m-%d'),
        gzippedfiles('test'),
        gzippedfiles('test-%N'),
        gzippedfiles('test-%Y-%m-%d'),
        gzippedfiles('test-%Y-%m-%d-%H-%M-%S'),
        gzippedfiles('test-%N-%Y-%m-%d'),
        totalsize('test'),
        totalsize('test-%N'),
        totalsize('test-%Y-%m-%d'),
        totalsize('test-%Y-%m-%d-%H-%M-%S'),
        totalsize('test-%N-%Y-%m-%d'),
        totalfiles('test'),
        totalfiles('test-%N'),
        totalfiles('test-%Y-%m-%d'),
        totalfiles('test-%Y-%m-%d-%H-%M-%S'),
        totalfiles('test-%N-%Y-%m-%d'),
        shorthandperiod('test'),
        shorthandperiod('test-%N'),
        shorthandperiod('test-%Y-%m-%d'),
        shorthandperiod('test-%Y-%m-%d-%H-%M-%S'),
        shorthandperiod('test-%N-%Y-%m-%d'),
        multiplerotatorsonsamefile('test'),
        multiplerotatorsonsamefile('test-%N'),
        multiplerotatorsonsamefile('test-%Y-%m-%d'),
        multiplerotatorsonsamefile('test-%Y-%m-%d-%H-%M-%S'),
        multiplerotatorsonsamefile('test-%N-%Y-%m-%d'),
        toosmallthresholdstillgetswrites('test'),
        toosmallthresholdstillgetswrites('test-%N'),
        toosmallthresholdstillgetswrites('test-%Y-%m-%d'),
        toosmallthresholdstillgetswrites('test-%Y-%m-%d-%H-%M-%S'),
        toosmallthresholdstillgetswrites('test-%N-%Y-%m-%d'),

        checkrotationofoldfile,
        checkrotationofnewfile,
        checksetlongtimeout,
        checksetlongtimeoutclear,
        checksetlongtimeoutclearnormalperiods
    ], function (err) {
        if (err) console.log(err);

        clearTimeout(totalTimeout);
    });
});

var totalTimeout = setTimeout(function () {
    console.log('Still running: ');
    if (whyRunning) {
        whyRunning();
    }
}, 1200000);
