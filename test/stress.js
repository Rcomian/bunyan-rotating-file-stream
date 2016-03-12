var RotatingFileStream = require('../index');
var bunyan = require('bunyan');
var uuid = require('uuid');
var mkdirp = require('mkdirp');

var _ = require('lodash');
var Combinatorics = require('js-combinatorics');

var combinations = {
    level: ['debug', 'info', 'warn', 'error', 'fatal'],
    period: ['1m', '1h', '1d', '1m', ''],
    threshold: [0, 1, 10240, '100k', '1m', '1g'],
    totalFiles: [0, 1, 2, 5, 10, 20],
    totalSize: [0, '100k', '1m', '10m', '100m', '1g'],
    rotateExisting: [true, false],
    startNewFile: [true, false],
    gzip: [true, false]
};

function validConfig(config) {
    var valid =
        (config.totalFiles != 0 || config.totalSize != 0) &&
        (config.threshold != 1 || config.totalFiles != 0) &&
        (config.period != 0 || config.threshold != 0);

    return valid;
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

            stream.stream.on('losingdata', slowdown);
            stream.stream.on('caughtup', speedup);

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

var multiplier = 1.0;

function slowdown() {
    multiplier *= 2;
    console.log('slowdown', multiplier);
}

function speedup() {
    multiplier /= 2;
    console.log('speedup', multiplier);
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



var child = 0;

function doChildLogger() {

    if (!active) return;

    child += 1;

    var clog = log.child({child: 'log' + child, childid: uuid.v4()});
    var childactive = true;

    function debugLogger() {
        setTimeout(function () {
            clog.debug({source: "debugLogger", i: i, data: uuid.v4()});
            i += 1;
            childactive && debugLogger();
        }, (Math.random() * 10) + 100 * multiplier);
    }

    function infoLogger() {
        setTimeout(function () {
            clog.info({source: "infoLogger", i: i, data: uuid.v4()});
            i += 1;
            childactive && infoLogger();
        }, (Math.random() * 100) + 500 * multiplier);
    }

    function warningLogger() {
        setTimeout(function () {
            clog.warn({source: "warningLogger", i: i, data: uuid.v4()});
            i += 1;
            childactive && warningLogger();
        }, (Math.random() * 500) + 5000 * multiplier);
    }

    function errorLogger() {
        setTimeout(function () {
            clog.error({source: "errorLogger", i: i, data: uuid.v4()});
            i += 1;
            childactive && errorLogger();
        }, (Math.random() * 500) + 5000 * multiplier);
    }

    debugLogger();
    infoLogger();
    warningLogger();
    errorLogger();

    setTimeout(function () {
        childactive = false;

        setTimeout(function () {
            doChildLogger();
        }, (Math.random() * 60000) + 120000 * multiplier);

    }, (Math.random() * 60000) + 10000);
}

mkdirp('testlogs/stress', function () {
    log  = bunyan.createLogger({
        name: 'foo',
        streams: expandCombinations()
        //streams: hardcodedStreams()
    });

    debugLogger();
    infoLogger();
    warningLogger();
    errorLogger();

    doChildLogger();
    doChildLogger();
});
