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

    function writer(s, callback) {
        var str = JSON.stringify(s, bunyan.safeCycles()) + '\n';

        stream.write(str, function (err) {
            if (err) {
                base.emit('error', err);
            } else {
                base.emit('data', { bytesWritten: stream.bytesWritten });
            }

            callback();
        });
    }

    var writeQueue = LimitedQueue(writer);

    writeQueue.pause();
    rotator.initialise(function (err, newstream, filePath) {
        if (err) {
            base.emit('error', err);
        }

        writeQueue.resume();
    });

    rotator.on('error', function (err) {
        base.emit('error', err);
    });

    rotator.on('newfile', function (newfile) {
        stream = newfile.stream;
        base.emit('newfile', { path: newfile.path });
    });

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
        stream.destroy();
        base.emit('shutdown');
    };

    function destroySoon(s) {
        writeQueue.pause();
        stream.destroySoon();
        base.emit('shutdown');
    };

    return _.extend({}, {
        stream,
        rotate,
        write,
        end,
        destroy,
        destroySoon
    }, base);
}

module.exports = RotatingFileStream;
