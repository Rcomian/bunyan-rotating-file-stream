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

    var rotatingoldfiles = true;

    function shutdown() {
    }

    function checkIfRotationNeeded(ctime, now) {
        var nextRot = ctime;
        var lastRot = nextRot;
        while (nextRot < now) {
            lastRot = nextRot;
            nextRot = nextRotTime(lastRot, periodScope, periodNum);
        }

        return { needsRotation: lastRot != ctime, rotateTo: lastRot };
    }

    function newFile(data) {
        if (rotatingoldfiles) {
            // First setup, see if the file is old and needs rotating
            rotatingoldfiles = false;
            var rotation = checkIfRotationNeeded(data.path, Date.now());
            if (rotation.needsRotation) {
                // The current file is old enough to need a rotation.
                base.emit('rotate', {date: rotation.rotateTo});
            }
        }
    }

    function logWrite() {
        // Do nothing
    }

    var parsed = optionParser.parsePeriod(options.period);
    periodScope = parsed.periodScope;
    periodNum = parsed.periodNum;

    return _.extend({}, {
        newFile: newFile,
        logWrite: logWrite,
        shutdown: shutdown,
        checkIfRotationNeeded: checkIfRotationNeeded},
    base);
};

module.exports = InitialPeriodRotateTrigger;
