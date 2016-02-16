// Just emits "rotate" events at the right time.
// Does not know about a rotating file stream.
'use strict';

var assert = require('assert');
var EventEmitter = require('events').EventEmitter;
var _ = require('lodash');
var fs = require('fs');

var optionParser = require('./optionParser');
var nextRotTime = require('./nextrotationtime');

var _DEBUG = false;

function InitialPeriodRotateTrigger(options) {
    var base = new EventEmitter;

    var periodNum = 1;
    var periodScope = 'd';

    var active = true;

    function shutdown() {
    }

    function setInitialTimeSeed(path) {
        fs.stat(path, function (err, stat) {
            if (err) {
                base.emit('error', err);
            } else {
                checkIfRotationNeeded(stat.ctime.getTime());
            }
        });
    }

    function checkIfRotationNeeded(ctime) {
        var nextRot = nextRotTime(ctime, periodScope, periodNum);
        if (nextRot < Date.now()) {
            // The current file old enough to need a rotation.
            base.emit('rotate');
        }
    }

    function reset(data) {
        if (active) {
            // First setup, see if the file is old and needs rotating
            active = false;
            setInitialTimeSeed(data.path);
        }
    }

    function check() {
        // Do nothing
    }

    var parsed = optionParser.parsePeriod(options.period);
    periodScope = parsed.periodScope;
    periodNum = parsed.periodNum;

    return _.extend({}, {reset, check, shutdown, checkIfRotationNeeded}, base);
};

module.exports = InitialPeriodRotateTrigger;
