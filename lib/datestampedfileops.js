var fs = require('fs');
var async = require('async');
var path = require('path');
var strftime = require('strftime');
var _ = require('lodash');

var _DEBUG = false;

function DateStampedFileOps(logpath, totalFiles, totalSize, gzip) {

    var filenameTimestamp = new Date();
    var nonce = 0;

    var parsedPath = path.parse(logpath);

    function getFilesInLogDirectory(next) {
        fs.readdir(path.resolve(parsedPath.dir), function (err, files) {
            if (err) throw err;

            next(null, files);
        });
    }

    function filterJustOurLogFiles(files, next) {
        var logfiles = _.filter(files, function (file) {
            var parsedFile = path.parse(
                                path.resolve(
                                    path.join(
                                        parsedPath.dir,
                                        file
                                    )
                                )
                            );

            if (parsedFile.ext === '.gz') {
                var splitname = parsedFile.name.split('.');
                parsedFile.ext = splitname.slice(-1).join('');
                parsedFile.name = splitname.slice(0, -1).join('');
            }

            var prefix = parsedPath.name.split('%').slice(0, 1).join('');
            return (parsedFile.name.indexOf(prefix) === 0 &&
                    parsedFile.ext === parsedPath.ext);
        });

        next(null, logfiles);
    }

    function statEachFile(logfiles, next) {
        async.map(logfiles, function (logfile, next) {
            var fullpath = path.resolve(path.join(parsedPath.dir, logfile));
            fs.stat(fullpath, function (err, stat) {
                next(err, {
                    stat,
                    path: fullpath
                });
            });
        }, function (err, stats) {
            next(err, stats);
        });
    }

    function sortFilesByModifiedTime(logstats, next) {
        async.sortBy(logstats, function (logstat, next) {
            next(null, -logstat.stat.mtime);
        }, next);
    }

    function deleteFilesAfterCountBreach(logstats, next) {
        var currentCount = 0;
        var toDelete = [];
        var toContinue = [];
        logstats.forEach(function (logstat) {
            currentCount += 1;
            if (totalFiles && currentCount > totalFiles) {
                toDelete.push(logstat);
            } else {
                toContinue.push(logstat);
            }
        });

        async.each(toDelete, function (logstat, next) {
            fs.unlink(logstat.path, next);
        }, function (err) {
            next(err, toContinue);
        });
    }

    function deleteFilesAfterSizeBreach(logstats, next) {
        var currentSize = 0;
        var toDelete = [];
        var toContinue = [];
        logstats.forEach(function (logstat) {
            currentSize += logstat.stat.size;
            if (totalSize && currentSize > totalSize) {
                toDelete.push(logstat);
            } else {
                toContinue.push(logstat);
            }
        });

        async.each(toDelete, function (logstat, next) {
            fs.unlink(logstat.path, next);
        }, function (err) {
            next(err, toContinue);
        });
    }

    function getSortedLogFiles(next) {
        async.waterfall([
            getFilesInLogDirectory,
            filterJustOurLogFiles,
            statEachFile,
            sortFilesByModifiedTime
        ], function (err, logfiles) {
            next(err, logfiles);
        });

    }

    function deleteFiles(next) {
        async.waterfall([
            getSortedLogFiles,
            deleteFilesAfterCountBreach,
            deleteFilesAfterSizeBreach
        ], function (err) {
            next(err);
        });
    };

    function moveIntermediateFiles(next) {
        setImmediate(function () { next(); });
    };

    function internalGetStreamFilepath(gzipped, nonce) {
        var result = Object.assign({}, parsedPath);

        result.name = strftime(parsedPath.name, filenameTimestamp);

        if (nonce != 0) {
            result.name += '.' + String(nonce);
        }

        if (gzipped) {
            result.ext += '.gz';
        }

        result.base = result.name + result.ext;

        return path.resolve(path.format(result));
    }

    function getStreamFilepath(gzipped) {
        return internalGetStreamFilepath(gzipped, nonce);
    }

    function findUnusedFile(nonce, next) {
        var filepath = internalGetStreamFilepath(false, nonce);
        var filepathgz = internalGetStreamFilepath(true, nonce);

        async.each([
            filepath,
            filepathgz
        ], function (potentialpath, pathresult) {
            fs.stat(potentialpath, function (err, stats) {
                if (err && err.code === 'ENOENT') {
                    // File doesn't already exist, this is good
                    pathresult();
                } else if (err) {
                    // Something else failed
                    pathresult(err);
                } else {
                    // Path existed, use something else
                    pathresult('inuse');
                }
            })
        }, function (err) {
            if (err && err === 'inuse') {
                findUnusedFile(nonce + 1, next);
            } else if (err) {
                next(err);
            } else {
                // Open the file exclusively to ensure we own it
                fs.open(filepath, 'wx', function (err, fd) {
                    if (err && err.code === 'EEXIST') {
                        findUnusedFile(nonce + 1, next);
                    } else if (err) {
                        return next(err);
                    } else {
                        fs.close(fd, function () {
                            next(null, filepath, nonce);
                        });
                    }
                });
            }
        })

    }

    function createNewFile(next) {
        findUnusedFile(0, function (err, filepath, foundnonce) {
            nonce = foundnonce || 0;
            next(err, filepath);
        });
    }

    function newStreamFilepath(triggerinfo, next) {
        filenameTimestamp = new Date(triggerinfo.date || Date.now());

        var startNewFile = triggerinfo.hasOwnProperty('startNewFile') &&
                           !triggerinfo.startNewFile;

        if (startNewFile) {
            getSortedLogFiles(function (err, logfiles) {
                if (err) {
                    return next(err);
                }

                if (logfiles.length === 0) {
                    return createNewFile(next);
                } else {
                    next(null, logfiles[0].path);
                }
            });
        } else {
            createNewFile(next);
        }

    }

    return {
        getStreamFilepath,
        newStreamFilepath,
        deleteFiles,
        moveIntermediateFiles
    };
}

DateStampedFileOps.isDateStamped = function (logpath) {
    var parsed = path.parse(logpath);
    var withoutN = parsed.name.replace('%N', '');
    return (withoutN !== strftime(withoutN));
}

module.exports = DateStampedFileOps;
