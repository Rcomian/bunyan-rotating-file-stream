var RotatingFileStream = require('../index');
var bunyan = require('bunyan');
var uuid = require('uuid');
var mkdirp = require('mkdirp');
var EventEmitter = require('events').EventEmitter;
var fs = require('fs');
var async = require('async');
var path = require('path');

var extend = require('lodash/extend');
var Combinatorics = require('js-combinatorics');

function validConfig(config) {
    var valid =
        (config.totalFiles != 0 || config.totalSize != 0) &&
        (config.threshold != 1 || config.totalFiles != 0) &&
        (config.period != 0 || config.threshold != 0);

    return valid;
}

function PerfStats() {
    var queuelength = 0, byteswritten = 0, logswritten = 0, rotations = 0, rotationtime = 0;

    function queued(new_queuelength) {
        queuelength = new_queuelength;
    }

    function writebatch(batch_byteswritten, batch_logswritten, batch_queuelength) {
        queuelength = batch_queuelength;
        byteswritten += batch_byteswritten;
        logswritten += batch_logswritten;
    }

    function rotation(duration) {
        rotations += 1;
        rotationtime += duration;
    }

    function report(report) {
        report.streams += 1;
        report.queued += queuelength;
        report.written += logswritten;
        report.max_queued = queuelength > report.max_queued || report.max_queued === null ? queuelength : report.max_queued;
        report.min_queued = queuelength < report.min_queued || report.min_queued === null ? queuelength : report.min_queued;
        report.rotations += rotations;
        report.rotationtime += rotationtime;
    }

    return {
        queued: queued,
        writebatch: writebatch,
        rotation: rotation,
        report: report
    };
}

function PerfMon() {
    var base = new EventEmitter();

    var stats = [];

    function addStream(stream) {
        var stat = PerfStats();

        stream.on('perf-queued', stat.queued);
        stream.on('perf-writebatch', stat.writebatch);
        stream.on('perf-rotation', stat.rotation);

        stats.push(stat);
    }

    var lastqueued = 0;
    var lastrotations = 0;
    var lastrotationtime = 0;
    var lastwritten = 0;
    var lastrecordtime = Date.now();

    setInterval(function () {
        var report = {
            streams: 0,
            written: 0,
            queued: 0,
            max_queued: null,
            min_queued: null,
            rotations: 0,
            rotationtime:0
        };

        stats.forEach(function (stat) {
            stat.report(report);
        })

        var period_rotations = report.rotations - lastrotations;
        var period_rotationtime = report.rotationtime - lastrotationtime;
        var period_written = report.written - lastwritten;
        var period_queued = report.queued - lastqueued;

        lastrotations = report.rotations;
        lastrotationtime = report.rotationtime;
        lastwritten = report.written;
        lastqueued = report.queued;
        lastrecordtime = Date.now();

        report.period_rotations = period_rotations;
        report.period_rotationtime = period_rotationtime;
        report.period_averagerotation = period_rotationtime / period_rotations;
        report.period_written = period_written;
        report.period_queued = period_queued;

        base.emit('report', report);

    }, 10000);

    return extend({}, {
        addStream: addStream
    }, base);
}

function expandCombinations() {
    var combi = Combinatorics.cartesianProduct(
        ['1h', '1d', 'X'],
        [0, 1, '1m', '10m'],
        [0, 10],
        [0, '10m'],
        [true, false],
        ['basic.log', 'withinsert-%N-file.log', 'datestamped-%Y-%m-%d.log', 'datestampinsterted-%Y-%m-%d-%N-file.log', 'timestamped-%Y-%m-%d-%H-%M-%S.log', 'timestampinserted-%Y-%m-%d-%H-%M-%S-%N-file.log']
    );

    var streams = [];
    var dedupe = {};
    combi.toArray().forEach(function (streamdef) {
        var name = streamdef.join('-');

        dedupe[name] = 1;

        var config = {
            path: 'testlogs/stress/' + name,
            period: streamdef[0] === 'X' ? 0 : streamdef[0],
            threshold: streamdef[1],
            totalFiles: streamdef[2],
            totalSize: streamdef[3],
            gzip: streamdef[4]
        };

        if (validConfig(config)) {
            var stream = {
                    type: 'raw',
                    level: 'debug',
                    stream: RotatingFileStream(config)
            };

            streams.push(stream);
        }

    });

    return streams;
}


function hardcodedStreams() {
    return [{
        type: 'raw',
        level: 'debug',
        stream: RotatingFileStream({
            path: 'testlogs/stress/X-1-10-0-true-datestamped-%Y-%m-%d.log',
            period: 0,          // daily rotation
            threshold: 1,
            totalFiles: 10,
            totalSize: 0,
            gzip: true
        })
    }]
}

var log;

var multiplier = 4.0;

function slowdown() {
    multiplier *= 1.015;
}

function speedup() {
    multiplier *= 0.99;
}

var i = 0;

var active = true;
function debugLogger() {
    setTimeout(function () {
        log.debug({source: "debugLogger", i: i, data: uuid.v4()});
        i += 1;
        active && debugLogger();
    }, (Math.random() * 100) + 500 * multiplier);
}


function infoLogger() {
    setTimeout(function () {
        log.info({source: "infoLogger", i: i, data: uuid.v4()});
        i += 1;
        active && infoLogger();
    }, (Math.random() * 1000) + 1000 * multiplier);
}

function warningLogger() {
    setTimeout(function () {
        log.warn({source: "warningLogger", i: i, data: uuid.v4()});
        i += 1;
        active && warningLogger();
    }, (Math.random() * 5000) + 10000 * multiplier);
}

function errorLogger() {
    setTimeout(function () {
        log.error({source: "errorLogger", i: i, data: uuid.v4()});
        i += 1;
        active && errorLogger();
    }, (Math.random() * 5000) + 10000 * multiplier);
}

mkdirp('testlogs/stress', function () {
    var streams = expandCombinations();
    // var streams = hardcodedStreams();

    var perfMon = PerfMon();
    streams.forEach(function (stream) {
        perfMon.addStream(stream.stream);
    });

    perfMon.on('report', function (report) {
        report.multiplier = multiplier;

        var outputpath = 'testlogs/stress';

        async.waterfall([
            function getFiles(callback) {
                fs.readdir(outputpath, callback);
            },
            function buildPathsOnFiles(files, callback) {
                async.map(files, function (file, callback) {
                    callback(null, path.join(outputpath,file));
                }, callback);
            },
            function statEachFile(files, callback) {
                async.map(files, function (item, callback) {
                    fs.stat(item, function (err, stat) {
                        if (err) {
                            if (err.code === 'ENOENT') {
                                callback(null, {size: 0});
                            } else {
                                callback(err);
                            }
                        } else {
                            callback(null, stat);
                        }
                    })
                }, callback);
            },
            function generateStatistics(filestats, callback) {
                async.reduce(filestats, {count: 0, size: 0}, function (memo, item, callback) {
                    memo.count += 1;
                    memo.size += item.size;
                    callback(null, memo);
                }, callback);
            }
        ], function (err, result) {

            if (err) {
                console.log('results', arguments);
                report.files = 0;
                report.filesize = 0;
                report.err = err;
            } else {
                report.files = result.count;
                report.filesize = result.size;
                report.err = null;
            }

            console.log(report);
        });


        if (report.period_queued > 100) {
            slowdown();
        }

        if (report.period_queued > 1000) {
            slowdown();
        }

        if (report.queued > 10000 && report.period_queued > -100) {
            slowdown();
        }

        if (report.queued > 20000 && report.period_queued > -100) {
            slowdown();
        }

        if (report.min_queued > 100 && report.period_queued > -100) {
            slowdown();
        }

        if (report.queued < 1000) {
            speedup();
        }

        if (report.period_queued < -1000) {
            speedup();
        }

        if (report.max_queued < 5) {
            speedup();
        }
    });

    log  = bunyan.createLogger({
        name: 'foo',
        streams: streams
    });

    debugLogger();
    infoLogger();
    warningLogger();
    errorLogger();

});
