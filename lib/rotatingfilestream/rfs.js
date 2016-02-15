// A rotating file stream will just
// stream to a file and rotate the files when told to

'use strict';

var EventEmitter = require('events').EventEmitter;
var fs = require('fs');
var async = require('async');
var _ = require('lodash');

var parseSize = require('./sizeParser');
var LimitedQueue = require('./limitedqueue');
var FileRotator = require('./filerotator');

var bunyan = require('bunyan');

var _DEBUG = false;

function RotatingFileStream(options) {
    if (this instanceof RotatingFileStream !== true) {
        return new RotatingFileStream(options);
    }

    var base = new EventEmitter();

    if (typeof (options.path) !== 'string') {
        throw new Error('Must provide a string for path');
    }

    if (typeof (options.totalFiles) !== 'number' &&
        typeof (options.totalSize) === 'undefined') {
        throw new Error(
            'Must provide a value for totalFiles and/or totalSize'
        );
    }

    const gzip = Boolean(options.gzip);
    const totalSize = parseSize(options.totalSize);
    const totalFiles = options.totalFiles;
    const path = options.path;

    var rotator = new FileRotator(path, totalFiles, totalSize, gzip);

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

    var writeQueue = new LimitedQueue(writer);

    writeQueue.pause();
    rotator.initialise(function (err, newstream, filePath) {
        if (err) {
            base.emit('error', err);
        }

        stream = newstream;
        base.emit('newfile', {path: filePath});

        writeQueue.resume();
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

            stream = newstream;
            base.emit('newfile', {path: filePath});

            writeQueue.resume();
        });
    }

    function end(s) {
        this.stream.end();
    };

    function destroy(s) {
        this.stream.destroy();
    };

    function destroySoon(s) {
        this.stream.destroySoon();
    };

    return Object.seal(_.extend({}, {
        stream,
        rotate,
        write: writeQueue.push,
        end,
        destroy,
        destroySoon
    }, base));
}

module.exports = RotatingFileStream;
