var fs = require('fs');
var async = require('async');

var _DEBUG = false;


function NumberedFileOps(logpath, totalFiles, totalSize, gzip) {
    function getNumberedFile(n, zipped) {
        var result = '';
        if (n === 0) {
            result = logpath
                     .replace('.%N', '')
                     .replace('_%N', '')
                     .replace('-%N', '')
                     .replace('%N', '');
        } else if (logpath.indexOf('%N') >= 0) {
            result = logpath.replace('%N', String(n));
        } else {
            result = logpath + '.' + String(n);
        }

        if (zipped) {
            result += '.gz';
        }

        return result;
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

    function ignoreFileNotFound(next) {
        return function (err) {
            if (!err || err.code === 'ENOENT') {
                next();
            } else {
                next(err);
            }
        };
    }

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

    function getStreamFilepath(gzipped) {
        return getNumberedFile(0, gzipped);
    }

    function newStreamFilepath(gzipped) {
        return getNumberedFile(0, gzipped);
    }

    return {
        getStreamFilepath,
        newStreamFilepath,
        deleteFiles,
        moveIntermediateFiles
    };
}

module.exports = NumberedFileOps;