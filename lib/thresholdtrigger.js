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

            var log = JSON.parse(data.logstr);

            base.emit('rotate', {date: log.time});
        } else {
            bytesWritten += data.logSize;
        }
    }

    function shutdown() {

    }

    threshold = optionParser.parseSize(options.threshold);

    return _.extend({}, {newFile, logWrite, shutdown}, base);
}

module.exports = ThresholdTrigger;
