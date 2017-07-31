var bunyan = require('bunyan');
var _ = require('lodash');
var fs = require('fs');
var assert = require('assert');
var mkdirp = require('mkdirp');
var rmdir = require('rmdir');
var RotatingFileStream = require('../index');
var async = require('async');
var InitialPeriodRotateTrigger = require('../lib/initialperiodtrigger');
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
    var batch = _.extend({}, { size: 8 }, options.batch);

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

function throughput(next) {
    var name = 'testlogs/' + 'throughput';

    async.series([
        function (next) { rmdir(name, ignoreMissing(next)); },
        function (next) { mkdirp(name, next); },
        function (next) { runTest (name, {
            stream: { path: name + '/test-%Y.log', noCyclesCheck: true },
            batch: { iterations: 1000000, size: 1000 }
        }, next); },
        function (next) {
            var files = fs.readdirSync(name);
            assert.equal(1, files.length, 'Expected 1 file, found: ' + JSON.stringify(files));
            console.log(name, 'passed');
            next();
        }//,
        //function (next) { rmdir(name, ignoreMissing(next)); }
    ], next);
}


async.parallel([
    throughput
], function (err) {
    if (err) console.log(err);
    clearTimeout(totalTimeout);
});

var totalTimeout = setTimeout(function () {
    console.log('Still running: ');
    if (whyRunning) {
        whyRunning();
    }
}, 40000);
