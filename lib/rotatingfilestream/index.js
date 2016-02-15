// Utility to orchestrate the rotating file system object and its triggers.
'use strict';

var RotatingFileStream = require('./rfs');
var PeriodTrigger = require('./periodtrigger');
var ThresholdTrigger = require('./thresholdtrigger');
var TriggerAdapter = require('./triggeradapter');

function RotatingFileStreamFactory(options) {
    var rfs = new RotatingFileStream(options);

    if (options.period) {
        var periodTrigger = new PeriodTrigger(options);
        var periodTriggerAdapter = new TriggerAdapter(periodTrigger, rfs);
    }

    if (options.threshold) {
        var thresholdTrigger = new ThresholdTrigger(options);
        var thresholdTriggerAdapter = new TriggerAdapter(thresholdTrigger, rfs);
    }

    return rfs;
}

module.exports = RotatingFileStreamFactory;
