// Utility to orchestrate the rotating file system object and its triggers.
'use strict';

var RotatingFileStream = require('./lib/rotatingfilestream');
var PeriodTrigger = require('./lib/periodtrigger');
var InitialPeriodTrigger = require('./lib/initialperiodtrigger');
var ThresholdTrigger = require('./lib/thresholdtrigger');
var TriggerAdapter = require('./lib/triggeradapter');

var path = require('path');

var existingFilesStreams = {};


function RotatingFileStreamFactory(options) {
    if (typeof (options.path) !== 'string') {
        throw new Error('Must provide a string for path');
    }

    options.path = path.resolve(options.path);

    var rfs = existingFilesStreams[options.path];

    if (!rfs) {
        rfs = RotatingFileStream(options);

        existingFilesStreams[options.path] = rfs;

        rfs.once('shutdown', function () {
            existingFilesStreams[options.path] = null;
        });

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

    } else if (options.shared !== true ||
               existingFilesStreams[options.path].shared !== true) {
        throw new Error('You should not create multiple rotating file ' +
         'streams against the same file: ' + options.path);
    }

    return rfs;
}

module.exports = RotatingFileStreamFactory;
