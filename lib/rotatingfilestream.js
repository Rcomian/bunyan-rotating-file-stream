// A rotating file stream will just
// stream to a file and rotate the files when told to

'use strict';

var EventEmitter = require('events').EventEmitter;
var fs = require('fs');
var iopath = require('path');
var async = require('async');
var _ = require('lodash');

var optionParser = require('./optionParser');
var LimitedQueue = require('./limitedqueue');
var FileRotator = require('./filerotator');

var bunyan = require('bunyan');

var _DEBUG = false;

function RotatingFileStream(options) {
    var base = new EventEmitter();

    const gzip = Boolean(options.gzip);
    const totalSize = optionParser.parseSize(options.totalSize);
    const totalFiles = options.totalFiles;
    const path = options.path;
    const shared = options.shared;

    var rotator = FileRotator(path, totalFiles, totalSize, gzip);

    var stream = null;
    var streambytesWritten = 0;

    // Copied from bunyan source
    function safeCycles() {
        var seen = [];
        return function (key, val) {
            if (!val || typeof (val) !== 'object') {
                return val;
            }
            if (seen.indexOf(val) !== -1) {
                return '[Circular]';
            }
            seen.push(val);
            return val;
        };
    }

    function nullJsonify(textlog) {
        return textlog;
    }

    function fastJsonify(rawlog) {
        return JSON.stringify(rawlog, safeCycles()) + '\n';
    }

    function fastUnsafeJsonify(rawlog) {
        return JSON.stringify(rawlog) + '\n';
    }

    function orderedJsonify(rawlog) {
        var log = {};

        for (var fieldsortindex = 0; options.fieldOrder && fieldsortindex < options.fieldOrder.length; fieldsortindex += 1) {
            if (rawlog.hasOwnProperty(options.fieldOrder[fieldsortindex])) {
                log[options.fieldOrder[fieldsortindex]] = rawlog[options.fieldOrder[fieldsortindex]];
            }
        }

        for (var k in rawlog) {
            log[k] = rawlog[k];
        }

        return JSON.stringify(log, safeCycles()) + '\n';
    }

    function chooseJsonify(log) {
        if (typeof (log) === 'string' && options.fieldOrder) {
            base.emit('error', 'Can only set fieldOrder with the stream set to "raw"');
        }

        if (typeof (log) === 'string') {
            jsonify = nullJsonify;
        } else if (options.fieldOrder) {
            jsonify = orderedJsonify;
        } else if (options.noCyclesCheck) {
            jsonify = fastUnsafeJsonify;
        } else {
            jsonify = fastJsonify;
        }

        return jsonify(log);
    };

    var jsonify = chooseJsonify;

    function writer(logs, callback) {
        var written = -1; // the index of the last successful write
        for (var i = 0; stream && i < logs.length; i += 1) {
            var str = jsonify(logs[i]);

            var writeBuffer = new Buffer(str, 'utf8');

            streambytesWritten += writeBuffer.byteLength;

            base.emit('data', { bytesWritten: streambytesWritten });

            if (stream) {
                try {
                    stream.write(writeBuffer, function (err) {
                        if (err) {
                            base.emit('error', err);
                        }
                    });
                } catch (err) {
                    base.emit('error', err);
                }

                written = i;
            }
        }

        // If we didn't get all the way through the array, unshift the remaining
        // records back onto our queue in reverse order
        for (var rollback = logs.length -1; rollback > written; rollback -= 1) {
            writeQueue.unshift(logs[rollback]);
        }

        setImmediate(function () {
            callback();
        });
    }

    var writeQueue = LimitedQueue(writer);

    writeQueue.pause();

    writeQueue.on('losingdata', function () {
        base.emit('losingdata');
    });

    writeQueue.on('caughtup', function () {
        base.emit('caughtup');
    });

    rotator.on('error', function (err) {
        base.emit('error', err);
    });

    rotator.on('closefile', function () {
        writeQueue.pause();
        stream = null;
    });

    rotator.on('newfile', function (newfile) {
        stream = newfile.stream;
        streambytesWritten = 0;
        base.emit('newfile', { path: newfile.path });
        writeQueue.resume();
    });

    function initialise() {
        rotator.initialise(function (err, newstream, filePath) {
            if (err) {
                base.emit('error', err);
            }
        });
    }

    function rotateActual() {

        rotateFunction = function () {};

        async.parallel([
            function waitForWrite(next) {
                rotator.once('newfile', function () {
                    if (writeQueue.isEmpty()) {
                        // No logs to write, so we're all clear to allow
                        // rotations again
                        next();
                    } else {
                        // We've got some logs to write, ensure we get at least
                        // one log record into the file before allowing
                        // another rotation
                        base.once('data', function (info) {
                            next();
                        });
                    }
                });
            },
            function doRotation(next) {
                rotator.rotate(next);
            }
        ], function allowRotationsAgain(err) {
            if (err) {
                base.emit('error', err);
            }

            rotateFunction = rotateActual;
        });
    }

    var rotateFunction = rotateActual;

    function rotate() {
        rotateFunction();
    }

    function write(s, callback) {
        writeQueue.push(s, callback);
    }

    function end(s) {
        writeQueue.pause();
        rotator.end(function () {
            base.emit('shutdown');
        });
    };

    function destroy(s) {
        writeQueue.pause();
        rotator.end();
        base.emit('shutdown');
    };

    function destroySoon(s) {
        writeQueue.pause();
        rotator.end();
        base.emit('shutdown');
    };

    function join(cb) {
        writeQueue.join(function () {
            rotator.end(function () {
                base.emit('shutdown');
                if (cb) {
                    cb();
                }
            });
        });
    }

    return _.extend({}, {
        stream,
        initialise,
        rotate,
        write,
        end,
        destroy,
        destroySoon,
        join,
        shared
    }, base);
}

module.exports = RotatingFileStream;
