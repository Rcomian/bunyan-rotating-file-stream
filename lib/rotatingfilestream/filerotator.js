'use strict';

// Provides a stream to write to.
// When rotate is called, a new stream is provisioned.
// The original stream is closed and the file archived
// according to the archival rules.

var fs = require('fs');
var async = require('async');
var _ = require('lodash');
var zlib = require('zlib');

var _DEBUG = false;

function FileRotator(path, totalFiles, totalSize, gzip) {

    var stream;
    var streamPath;

    function getNumberedFile(n, zipped) {
        var result = '';
        if (n === 0) {
            result = path;
        } else {
            result = path + '.' + String(n);
        }

        if (zipped) {
            result += '.gz';
        }

        return result;
    }

    function ignoreFileNotFound(next) {
        return function (err) {
            if (!err || err.code === 'ENOENT') {
                next();
            } else {
                next(err);
            }
        };
    }

    function shutdownCurrentStream(next) {
        stream.end(next);
        stream = null;
    };

    function gzipCurrentFile(next) {
        if (!gzip) {
            return next();
        }

        const unzippedPath = getNumberedFile(0, false);
        const zippedPath = getNumberedFile(0, true);

        fs.createReadStream(unzippedPath)
        .pipe(zlib.createGzip())
        .pipe(fs.createWriteStream(zippedPath))
        .on('finish', function () {
            fs.unlink(unzippedPath, next);
        })
        .on('error', function (err) {
            base.emit('error', err);
        });
    }

    function recursiveFindFilesToDelete(
        currentFileNumber, cumulativeSize, foundFiles, next
    ) {
        var fileToFind = getNumberedFile(currentFileNumber, gzip);
        fs.stat(fileToFind, function (err, stat) {
            if (err && err.code === 'ENOENT') {
                next(null, foundFiles);
            } else if (err) {
                next(err);
            } else {
                cumulativeSize += stat.size;

                if ((totalSize > 0 && cumulativeSize > totalSize) ||
                    (totalFiles > 0 && currentFileNumber > totalFiles)
                ) {
                    foundFiles.push(fileToFind);
                }
                recursiveFindFilesToDelete(
                    currentFileNumber + 1,
                    cumulativeSize,
                    foundFiles,
                    next
                );
            }
        });
    }

    function findFilesToDelete(next) {
        var foundFiles = [];

        recursiveFindFilesToDelete(1, 0, foundFiles, next);
    }

    function deleteFiles(next) {
        findFilesToDelete(function (err, foundFiles) {
            if (err) {
                next(err);
            } else {
                async.eachSeries(
                    foundFiles,
                    function (toDel, callback) {
                        if (_DEBUG) console.log('rm %s', toDel);

                        fs.unlink(toDel, ignoreFileNotFound(callback));
                    },
                    next
                );
            }
        });
    };

    function recursiveFindFilesToMove(currentFileNumber, foundFiles, next) {
        var fileToFind = getNumberedFile(currentFileNumber, gzip);
        fs.stat(fileToFind, function (err, stat) {
            if (err && err.code === 'ENOENT') {
                next(null, foundFiles);
            } else if (err) {
                next(err);
            } else {
                foundFiles.unshift(currentFileNumber);
                recursiveFindFilesToMove(
                    currentFileNumber + 1,
                    foundFiles,
                    next
                );
            }
        });
    }

    function moveFile(numberToMove, next) {
        var before = getNumberedFile(numberToMove, gzip);
        var after = getNumberedFile(numberToMove+1, gzip);
        fs.rename(before, after, ignoreFileNotFound(next));
    }

    function moveIntermediateFiles(next) {
        var toMove = [];
        recursiveFindFilesToMove(0, toMove, function (err) {
            if (err) {
                return next(err);
            }

            async.eachSeries(
                toMove,
                moveFile,
                next
            );
        });
    };

    function initialiseNewFile(next) {
        var filePath = getNumberedFile(0, false)
        if (_DEBUG) console.log('[pid %s] open %s', process.pid, filePath);

        stream = fs.createWriteStream(filePath,
            {flags: 'a', encoding: 'utf8'});

        streamPath = filePath;

        if (next) {
            next();
        }
    };

    // Calling rotate gives us a new stream
    // Once called, the previous stream is not valid and
    // you won't get another one until the callback has been called.
    function rotate(callback) {
        async.series([
            shutdownCurrentStream,
            gzipCurrentFile,
            moveIntermediateFiles,
            deleteFiles,
            initialiseNewFile
        ], function (err) {
            callback(err, stream, streamPath);
        });
    }

    // This gives us an initial stream.
    // If a file already exists, we'll just append to it.
    function initialise(callback) {
        async.series([
            deleteFiles,
            initialiseNewFile
        ], function (err) {
            callback(err, stream, streamPath);
        });
    }

    return _.extend({}, { initialise, rotate });
}

module.exports = FileRotator;
