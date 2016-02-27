'use strict';

var fs = require('fs');
var EventEmitter = require('events').EventEmitter;
var _ = require('lodash');
var optionParser = require('./optionParser');

function ThresholdTrigger(options) {
    var base = new EventEmitter();

    var threshold = 10485760; // 10 MB

    var initialFileSize = 0;

    var firstFile = true;

    function newFile(data) {
        initialFileSize = 0;

        if (firstFile) {
            firstFile = false;

            // The first file may be an existing file
            // so we need to know how big it is so
            // that we can rollover at the right time
            fs.stat(data.path, function (err, stats) {
                if (err && err.code !== 'ENOENT') {
                    base.emit('error', err);
                } else if (stats) {
                    initialFileSize = stats.size;
                }
            });
        }
    }

    function logWrite(data) {
        if (initialFileSize + data.bytesWritten > threshold) {
            base.emit('rotate');
        }
    }

    function shutdown() {

    }

    threshold = optionParser.parseSize(options.threshold);

    return _.extend({}, {newFile, logWrite, shutdown}, base);
}

module.exports = ThresholdTrigger;
