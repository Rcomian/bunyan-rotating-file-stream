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

    function checkIfRotationNeeded(ctime) {
        var nextRot = nextRotTime(ctime, periodScope, periodNum);
        if (nextRot < Date.now()) {
            // The current file old enough to need a rotation.
            base.emit('rotate', {date: nextRot});
        }
    }

    function newFile(data) {
        if (active) {
            // First setup, see if the file is old and needs rotating
            active = false;
            checkIfRotationNeeded(data.path);
        }
    }

    function logWrite() {
        // Do nothing
    }

    var parsed = optionParser.parsePeriod(options.period);
    periodScope = parsed.periodScope;
    periodNum = parsed.periodNum;

    return _.extend({}, {
        newFile,
        logWrite,
        shutdown,
        checkIfRotationNeeded},
    base);
};

module.exports = InitialPeriodRotateTrigger;
