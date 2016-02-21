// Utility to orchestrate the rotating file system object and its triggers.
'use strict';

var DedupeRotatingFileStream = require('./lib/deduperotatingfilestream');
var PeriodTrigger = require('./lib/periodtrigger');
var InitialPeriodTrigger = require('./lib/initialperiodtrigger');
var ThresholdTrigger = require('./lib/thresholdtrigger');
var TriggerAdapter = require('./lib/triggeradapter');

function RotatingFileStreamFactory(options) {
    var rfs = DedupeRotatingFileStream(options);

    if (options.period) {
        var periodTrigger = PeriodTrigger(options);
        TriggerAdapter(periodTrigger, rfs);
    }

    if (options.period && options.rotateExisting) {
        var initialPeriodTrigger = InitialPeriodTrigger(options);
        TriggerAdapter(initialPeriodTrigger, rfs);
    }

    if (options.threshold) {
        var thresholdTrigger = ThresholdTrigger(options);
        TriggerAdapter(thresholdTrigger, rfs);
    }

    rfs.initialise();

    return rfs;
}

module.exports = RotatingFileStreamFactory;
