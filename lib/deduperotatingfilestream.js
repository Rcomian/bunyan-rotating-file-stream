// Utility to ensure we've only got one rotator against each file
'use strict';

var RotatingFileStream = require('./rotatingfilestream');

var path = require('path');

var existingFilesStreams = {};

function DedupeRotatingFileStream(options) {
    if (typeof (options.path) !== 'string') {
        throw new Error('Must provide a string for path');
    }

    options.path = path.resolve(options.path);

    if (!existingFilesStreams[options.path]) {
        var rfs = RotatingFileStream(options);
        existingFilesStreams[options.path] = rfs;

        rfs.once('shutdown', function () {
            existingFilesStreams[options.path] = null;
        });
    } else if (options.shared !== true || existingFilesStreams[options.path].shared !== true) {
        throw new Error('You should not create multiple rotating file ' +
         'streams against the same file: ' + options.path);
    }

    return existingFilesStreams[options.path];
}

module.exports = DedupeRotatingFileStream;
