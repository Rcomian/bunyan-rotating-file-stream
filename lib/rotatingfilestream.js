// A rotating file stream will just
// stream to a file and rotate the files when told to

'use strict';

var EventEmitter = require('events').EventEmitter;
var fs = require('fs');
var async = require('async');
var _ = require('lodash');

var optionParser = require('./optionParser');
var LimitedQueue = require('./limitedqueue');
var FileRotator = require('./filerotator');

var bunyan = require('bunyan');

var _DEBUG = false;

function RotatingFileStream(options) {
    var base = new EventEmitter();

    if (typeof (options.path) !== 'string') {
        throw new Error('Must provide a string for path');
    }

    const gzip = Boolean(options.gzip);
    const totalSize = optionParser.parseSize(options.totalSize);
    const totalFiles = options.totalFiles;
    const path = options.path;

    var rotator = FileRotator(path, totalFiles, totalSize, gzip);

    var stream = null;
    var streambytesWritten = 0;

    function writer(logs, callback) {
        for (var i = 0; i < logs.length; i += 1) {
            if (stream) {

                var str;
                if (typeof (logs[i]) === 'string') {
                    str = logs[i];
                } else {
                    str = JSON.stringify(logs[i], bunyan.safeCycles()) + '\n';
                }

                var writeBuffer = new Buffer(str, 'utf8');

                stream.write(writeBuffer, function (err) {
                    if (err) {
                        base.emit('error', err);
                    }
                });

                streambytesWritten += writeBuffer.byteLength;
                base.emit('data', { bytesWritten: stream.bytesWritten });
            } else {
                // We suddenly don't have a stream, we'll have to save this log for later
                writeQueue.unshift(logs[i]);
            }

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
        stream = null;
    });

    rotator.on('newfile', function (newfile) {
        stream = newfile.stream;
        streambytesWritten = 0;
        base.emit('newfile', { path: newfile.path });
    });

    function initialise() {
        rotator.initialise(function (err, newstream, filePath) {
            if (err) {
                base.emit('error', err);
            }

            writeQueue.resume();
        });
    }

    function rotate() {
        if (writeQueue.paused()) {
            return;
        } else {
            writeQueue.pause();
        }

        rotator.rotate(function (err, newstream, filePath) {
            if (err) {
                base.emit('error', err);
            }

            writeQueue.resume();
        });
    }

    function write(s, callback) {
        writeQueue.push(s, callback);
    }

    function end(s) {
        stream.end();
    };

    function destroy(s) {
        writeQueue.pause();
        if (stream) {
            stream.destroy();
        }
        base.emit('shutdown');
    };

    function destroySoon(s) {
        writeQueue.pause();
        if (stream) {
            stream.destroy();
        }
        base.emit('shutdown');
    };

    function join(cb) {
        writeQueue.join(cb);
    }

    return _.extend({}, {
        stream,
        initialise,
        rotate,
        write,
        end,
        destroy,
        destroySoon,
        join
    }, base);
}

module.exports = RotatingFileStream;
