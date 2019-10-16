// Utility to orchestrate the rotating file system object and its triggers.
'use strict';

var RotatingFileStream = require('./lib/rotatingfilestream');
var PeriodTrigger = require('./lib/periodtrigger');
var InitialPeriodTrigger = require('./lib/initialperiodtrigger');
var ThresholdTrigger = require('./lib/thresholdtrigger');
var TriggerAdapter = require('./lib/triggeradapter');
var _ = require('lodash');

var path = require('path');

var existingFilesStreams = {};

function RotatingFileStreamFactory(options) {
    // options_in might be readonly, copy so that we can modify as needed
    var options_copy = _.extend({}, options);

    if (typeof (options_copy.path) !== 'string') {
        throw new Error('Must provide a string for path');
    }

    options_copy.path = path.resolve(options_copy.path);

    var rfs = existingFilesStreams[options_copy.path];

    if (!rfs) {
        rfs = RotatingFileStream(options_copy);

        existingFilesStreams[options_copy.path] = rfs;

        rfs.once('shutdown', function () {
            existingFilesStreams[options_copy.path] = null;
        });

        if (options_copy.period) {
            var periodTrigger = PeriodTrigger(options_copy);
            TriggerAdapter(periodTrigger, rfs);
        }

        if (options_copy.period && options_copy.rotateExisting) {
            var initialPeriodTrigger = InitialPeriodTrigger(options_copy);
            TriggerAdapter(initialPeriodTrigger, rfs);
        }

        if (options_copy.threshold) {
            var thresholdTrigger = ThresholdTrigger(options_copy);
            TriggerAdapter(thresholdTrigger, rfs);
        }

        rfs.initialise();

    } else if (options_copy.shared !== true ||
               existingFilesStreams[options_copy.path].shared !== true) {
        throw new Error('You should not create multiple rotating file ' +
         'streams against the same file: ' + options_copy.path);
    }

    return rfs;
}

module.exports = RotatingFileStreamFactory;
