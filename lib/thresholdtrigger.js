'use strict';

var fs = require('fs');
var EventEmitter = require('events').EventEmitter;
var _ = require('lodash');
var optionParser = require('./optionParser');

function ThresholdTrigger(options) {
    var base = new EventEmitter();

    var threshold = 10485760; // 10 MB

    var bytesWritten = 0;

    function newFile(data) {
        bytesWritten = data.stats.size;
    }

    function logWrite(data) {
        if ((bytesWritten > 0) && (bytesWritten + data.logSize > threshold)) {

            var date = null;
            try {
                var log = JSON.parse(data.logstr);
                date = log.time;
            } catch (e) {}

            base.emit('rotate', {date: date});
        } else {
            bytesWritten += data.logSize;
        }
    }

    function shutdown() {

    }

    threshold = optionParser.parseSize(options.threshold);

    return _.extend({}, {
        newFile: newFile,
        logWrite: logWrite,
        shutdown: shutdown
    }, base);
}

module.exports = ThresholdTrigger;
