'use strict';

var fs = require('fs');
var EventEmitter = require('events').EventEmitter;
var _ = require('lodash');
var optionParser = require('./optionParser');

function ThresholdTrigger(options) {
    var base = new EventEmitter();

    var threshold = 10485760; // 10 MB

    var initialFileSize = 0;

    function reset(data) {
        // Since we've got a new file:
        //  check it's current size before we start writing
        try {
            var stats = fs.statSync(data.path);
            initialFileSize = stats.size;
        } catch (e) {
            if (e.code !== 'ENOENT') {
                throw e;
            } else {
                // File doesn't exist - it'll be made in time.
                initialFileSize = 0;
            }
        }
    }

    function check(data) {
        if (initialFileSize + data.bytesWritten > threshold) {
            base.emit('rotate');
        }
    }

    function shutdown() {

    }

    threshold = optionParser.parseSize(options.threshold);

    return _.extend({}, {reset, check, shutdown}, base);
}

module.exports = ThresholdTrigger;
