// Utility to orchestrate the rotating file system object and its triggers.
'use strict';

var RotatingFileStream = require('./lib/rotatingfilestream');
var PeriodTrigger = require('./lib/periodtrigger');
var ThresholdTrigger = require('./lib/thresholdtrigger');
var TriggerAdapter = require('./lib/triggeradapter');

function RotatingFileStreamFactory(options) {
    var rfs = RotatingFileStream(options);

    if (options.period) {
        var periodTrigger = PeriodTrigger(options);
        TriggerAdapter(periodTrigger, rfs);
    }

    if (options.threshold) {
        var thresholdTrigger = ThresholdTrigger(options);
        TriggerAdapter(thresholdTrigger, rfs);
    }

    return rfs;
}

module.exports = RotatingFileStreamFactory;
