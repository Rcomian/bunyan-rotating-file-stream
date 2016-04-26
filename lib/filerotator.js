'use strict';

// Provides a stream to write to.
// When rotate is called, a new stream is provisioned.
// The original stream is closed and the file archived
// according to the archival rules.

var fs = require('fs');
var async = require('async');
var _ = require('lodash');
var zlib = require('zlib');
var EventEmitter = require('events').EventEmitter;
var NumberedFileOps = require('./numberedfileops');
var DateStampedFileOps = require('./datestampedfileops');

var _DEBUG = false;

function FileRotator(logpath, totalFiles, totalSize, gzip) {

    var base = new EventEmitter();

    var stream;
    var streamPath;

    var fileops = null;

    if (DateStampedFileOps.isDateStamped(logpath)) {
        fileops = DateStampedFileOps(logpath, totalFiles, totalSize, gzip);
    } else {
        fileops = NumberedFileOps(logpath, totalFiles, totalSize, gzip);
    }

    function gzipCurrentFile(next) {
        if (!gzip) {
            return next();
        }

        var unzippedPath = fileops.getStreamFilepath(false);
        var zippedPath = fileops.getStreamFilepath(true);

        fs.createReadStream(unzippedPath)
        .on('error', function (err) {
            base.emit('error', err);
            next();
        })
        .pipe(zlib.createGzip())
        .pipe(fs.createWriteStream(zippedPath))
        .on('finish', function () {
            fs.unlink(unzippedPath, next);
        })
    }

    function streamErrorHandler(err) {
        base.emit('error', err);
    };

    function initialiseNewFile(triggerinfo) {
        return function (next) {
            triggerinfo = triggerinfo || {};
            fileops.newStreamFilepath(triggerinfo, function (err, filePath) {
                if (err) {
                    return next(err);
                }

                stream = fs.createWriteStream(filePath,
                    {flags: 'a', encoding: 'utf8'});

                streamPath = filePath;

                stream.on('error', streamErrorHandler);

                stream.once('open', function () {
                    fs.stat(filePath, function (err, stats) {
                        if (err) {
                            base.emit('error', err);
                        } else {
                            base.emit('newfile', {
                                stream: stream,
                                logpath: streamPath,
                                stats: stats
                            });
                        }

                        if (next) {
                            next();
                        }
                    });
                });
            });
        };
    }

    function shutdownCurrentStream(next) {
        base.emit('closefile');
        if (stream) {
            var streamCopy = stream;
            stream.end(function () {
                streamCopy.removeListener('error', streamErrorHandler);
                if (next) {
                    next();
                }
            });
            stream = null;
        }
    };

    // Calling rotate gives us a new stream
    // Once called, the previous stream is not valid and
    // you won't get another one until the callback has been called.
    function rotate(triggerinfo, callback) {
        async.series([
            shutdownCurrentStream,
            gzipCurrentFile,
            fileops.moveIntermediateFiles,
            fileops.deleteFiles,
            initialiseNewFile(triggerinfo)
        ], function (err) {
            callback(err, stream, streamPath);
        });
    }

    // This gives us an initial stream.
    // If a file already exists, we'll just append to it.
    var initialised = false;
    function initialise(startNewFile, callback) {
        if (!initialised) {
            initialised = true;

            async.series([
                fileops.deleteFiles,
                initialiseNewFile({ startNewFile: startNewFile })
            ], function (err) {
                callback(err, stream, streamPath);
            });
        } else {
            callback();
        }
    }

    return _.extend({}, {
        initialise: initialise,
        rotate: rotate,
        end: shutdownCurrentStream
    }, base);
}

module.exports = FileRotator;
